# MCP Server 任務分解（Opus 審查後）

**日期：** 2026-06-07  
**審查模型：** Claude Opus  
**執行模型：** Claude Sonnet  
**前置文件：** `dev_docs/mcp-server-plan.md`

---

## Opus 審查發現（重要問題）

Sonnet 執行前必須讀懂以下問題，避免踩雷。

### A. Auth 模型與規劃描述不符（最高優先）

規劃誤以為仍是 `role: ADMIN | USER` enum，但實際 codebase **已是 RBAC**：

- `ApiKeyGuard` 設定的 `request.user` 形狀為 `{ sub, roleNames, permissionPolicy, permissions, scopes, isApiKey }`，**沒有 `role` 欄位**。
- Scope 判斷一律走 `user.scopes` + `matchScope` 演算法，禁止引入 role enum。
- `availableScopes` 已由 `MetaService.getAvailableScopes()` 動態產生，MCP 直接複用，不要另造一套。

### B. MCP SDK 與 NestJS 整合的陷阱

1. **Body 已被 Express json parser 消費**：`transport.handleRequest` 的第三參數必須傳 `req.body`，否則 SDK 讀空 stream 而卡住。
2. **response 所有權**：MCP controller method 必須用 `@Res({ passthrough: false })`，讓 SDK 完全接管 response 寫入，Nest 不再處理。
3. **採用 stateless per-request transport**：`sessionIdGenerator: undefined`，每個 POST 建新 `McpServer` + `StreamableHTTPServerTransport`，避免多副本部署的 session 共享問題。
4. **Phase 1 只做 `POST /mcp` + `GET /mcp/health`**，`GET /mcp/sse` 降為可選延後。

### C. ApiKeyGuard + per-tool scope 檢查

- Guard 在路由層只做「有無合法 API key」的認證，**不做 per-tool scope**。
- Per-tool scope 必須在 **dispatch 時**逐一檢查：複用 ScopeGuard 的演算法，抽成純函式 `matchScope(granted, required)`。
- MCP endpoint **只接受 API key（M2M）**，不接受 JWT。

### D. DMMF schema 生成細節修正

1. **Phase 1 不實作 auto search**（避免全欄位 OR 掃大表），`list_*` 只支援 `page/limit/sortField/sortOrder`。
2. **sortField default fallback**：先找 `createdAt`，沒有才用 `id`（不是每個 model 都有 `createdAt`）。
3. **Prisma 動態存取用 model name 的 camelCase**（`prisma.employeeProfile`），不是 dbTable（snake_case）。`camelCase('EmployeeProfile') → 'employeeProfile'`。
4. **無單一主鍵的 model**（複合主鍵）：只產 `list_` / `create_`，跳過 get/update/delete 並記 log。
5. **type 對應加 fallback**：`BigInt/Decimal/Bytes` 等未知 scalar 一律 fallback `string` 並 log。
6. **enum 值來源**：`kind === 'enum'` 時從 DMMF `enums` 陣列 join 取值。
7. **dbTable 推導**：`m.dbName ?? m.name.toLowerCase()`，與 MetaService 完全一致，確保 tool scope 與 `availableScopes` 對得上。

### E. Multi-Provider 生命週期問題

1. **預設空陣列**：`McpModule` 必須給 `{ provide: MCP_TOOL_PROVIDERS, useValue: [] }`，否則沒有任何 provider 時 DI 報錯。
2. **handler `this` 綁定**：`method.bind(instance)`，否則 `this.prisma` 為 undefined。
3. **zod → JSON Schema**：用 zod v4 原生 `z.toJSONSchema()`，**不要加 `zod-to-json-schema` 依賴**（本專案 zod `^4.4.3` 支援）。

### F. 其他

- Tool 執行錯誤必須轉成 MCP `{ isError: true, content }` 回傳，**不讓它流到 `GlobalExceptionFilter`**。
- `delete_*` auto tool 預設需要 `{dbTable}:write` scope，CLAUDE.md 提醒可用 `@mcp-exclude` 關閉敏感 model。
- `@modelcontextprotocol/sdk` 是新 direct dep，安裝後確認 `package.json` 有宣告（pnpm strict mode）。

---

## 關鍵參考檔案

| 檔案 | 用途 |
|------|------|
| `backend/src/meta/meta.service.ts` | dbTable/scope 推導源頭，複用 `m.dbName ?? m.name.toLowerCase()` |
| `backend/src/auth/guards/scope.guard.ts` | `matchScope` 演算法來源 |
| `backend/src/api-keys/api-key.guard.ts` | `request.user` 形狀（`scopes`, `isApiKey`, `roleNames`） |
| `backend/src/common/pagination.ts` | list tool 分頁/排序邏輯複用 |
| `backend/src/app.module.ts` | 掛載點 |
| `backend/prisma/schema.prisma` | `@internal` 判準、需補 doc comments |

---

## 任務清單

> 每完成一批執行 `pnpm -C backend tsc --noEmit` 確認無型別錯誤。

### Phase 1：Template 基礎建設（auto CRUD）

- [ ] **Task 1 — 安裝 MCP SDK**
  - 在 `backend/` 執行 `pnpm add @modelcontextprotocol/sdk`
  - 確認 `backend/package.json` dependencies 出現該套件
  - 驗收：`pnpm -C backend install` 無錯

- [ ] **Task 2 — 建立 `backend/src/mcp/types.ts`**
  - 定義以下介面（純型別，無 runtime code）：
    - `McpCallContext`：`{ scopes: string[]; isApiKey: boolean; roleNames: string[] }`
    - `McpToolDefinition`：`{ name: string; description: string; inputSchema: object; requiredScopes: string[]; handler: (args: unknown, ctx: McpCallContext) => Promise<unknown>; }`
    - `McpToolProvider`：標記介面（空 interface 或帶 `getMcpToolInstances?` 可選方法）
  - 驗收：typecheck 通過

- [ ] **Task 3 — 建立 `backend/src/mcp/auto/input-schema.builder.ts`**
  - `prismaFieldToJsonSchema(field, enumsMap: Map<string, string[]>)`：
    - `String` → `{ type: 'string' }`
    - `Int/Float` → `{ type: 'number' }`
    - `Boolean` → `{ type: 'boolean' }`
    - `DateTime` → `{ type: 'string', format: 'date-time' }`
    - `Json` → `{ type: 'object' }`
    - `Enum` (`kind === 'enum'`) → `{ type: 'string', enum: [...values] }`
    - `BigInt/Decimal/Bytes` 及未知 → fallback `{ type: 'string' }`，印 log
    - 加上 `description` 來自 field.documentation（若有）
  - `buildListSchema()`：固定回傳 `{ page?, limit?, sortField?, sortOrder? }` JSON Schema，**不含 search**
  - `buildCreateSchema(model, enumsMap)`：排除 `id/createdAt/updatedAt` 及 `kind:'object'` 欄位；`isRequired && !hasDefaultValue` 的欄位放 required
  - `buildUpdateSchema(model, enumsMap)`：id 為 required，其餘全 optional，同樣排除系統欄位
  - 驗收：對 `User` model 欄位呼叫，輸出合法 JSON Schema；typecheck 通過

- [ ] **Task 4 — 建立 `backend/src/mcp/auto/crud-tool.factory.ts`**
  - `CrudToolFactory`（`@Injectable()`），方法 `buildToolDefinitions(): Omit<McpToolDefinition, 'handler'>[]`
  - 讀 `Prisma.dmmf.datamodel`，建 `enumsMap: Map<string, string[]>`（enum name → value names）
  - 對每個 model：
    - 跳過 doc comment 含 `@internal` 或 `@mcp-exclude`
    - `dbTable = m.dbName ?? m.name.toLowerCase()`（與 MetaService 一致）
    - 找單一 `isId === true` 欄位；有 → 產 5 tools；無 → 只產 list + create，log 跳過原因
    - 每個 tool 設 `requiredScopes`：`list_/get_` → `['{dbTable}:read']`；`create_/update_/delete_` → `['{dbTable}:write']`
    - description：`List {dbTable}. {model.documentation ?? ''}`（以此類推）
    - handler 欄位暫留空 placeholder（後由 registry 注入）
  - 驗收：對現有 schema 回傳正確 tool 清單；`@internal` model 不出現；typecheck 通過

- [ ] **Task 5 — 建立 `backend/src/mcp/auto/crud-executor.ts`**
  - `CrudExecutor`（`@Injectable()`），注入 `PrismaService`
  - `execute(modelName: string, operation: 'list'|'get'|'create'|'update'|'delete', args: unknown)`
    - `prismaDelegate = this.prisma[lcFirst(modelName)]`（`lcFirst('EmployeeProfile') → 'employeeProfile'`）
    - `list`：用 pagination 工具（`toPrismaPage`/`toPrismaOrderBy`），default orderBy：有 `createdAt` 欄位用之，否則用 `id asc`；allowedFields = model scalar 欄位名稱集合
    - `get`：`findUnique({ where: { id: args.id } })`
    - `create`：剝除系統欄位後 `create({ data: sanitized })`
    - `update`：`update({ where: { id: args.id }, data: sanitized })`
    - `delete`：`delete({ where: { id: args.id } })`
    - 所有 Prisma 錯誤 catch，回傳 `{ error: true, message: string }` 結構，**不 throw**
  - 驗收：對 `Role` model 能 list/get；typecheck 通過

- [ ] **Task 6 — 建立 `backend/src/mcp/mcp-tool.registry.ts`（Layer 1）**
  - `McpToolRegistry`（`@Injectable()`, implements `OnModuleInit`），注入 `CrudToolFactory` + `CrudExecutor`
  - `toolMap: Map<string, McpToolDefinition>`
  - `onModuleInit()`：從 factory 取 definitions，為每個綁定 `(args, ctx) => executor.execute(modelName, operation, args)` 當 handler，存入 `toolMap`
  - `listTools(ctx: McpCallContext): McpToolDefinition[]`：過濾出 `requiredScopes` 全在 `matchScope` 允許範圍內的 tools
  - `getTool(name): McpToolDefinition | undefined`
  - `matchScope(grantedScopes: string[], requiredScope: string): boolean`：
    - `*` 在 granted → true
    - `x:*` 在 granted 且 required 為 `x:read` 或 `x:write` → true
    - granted 包含 required → true
    - 否則 false
    （複用 `scope.guard.ts` 的演算法，抽成純函式）
  - 驗收：scope `['users:read']` 只看到 list/get users tools；scope `['*']` 看到全部；typecheck 通過

- [ ] **Task 7 — 建立 `backend/src/mcp/mcp.service.ts`**
  - `McpService`（`@Injectable()`），注入 `McpToolRegistry`
  - `createServer(ctx: McpCallContext): McpServer`：
    - `new McpServer({ name: process.env.npm_package_name ?? 'auranest-app', version: process.env.npm_package_version ?? '1.0.0' })`
    - 取 `registry.listTools(ctx)`，對每個用 `server.tool(name, description, jsonSchema, async (args) => { ... })` 註冊
    - handler 內：呼叫 tool.handler；若回傳 `{ error: true }` 則回 `{ isError: true, content: [{ type: 'text', text: message }] }`；否則回 `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`
  - 驗收：傳入 `{ scopes: ['*'], isApiKey: true, roleNames: [] }` ctx 能建出含全部 tools 的 server；typecheck 通過

- [ ] **Task 8 — 建立 `backend/src/mcp/mcp.controller.ts`**
  - `@Controller('mcp')`，class 層 `@UseGuards(ApiKeyGuard)`
  - `POST ''`：
    - `@Req() req: Request, @Res({ passthrough: false }) res: Response`
    - 從 `(req as any).user` 組 `McpCallContext`：`{ scopes: user.scopes ?? [], isApiKey: user.isApiKey ?? false, roleNames: user.roleNames ?? [] }`
    - `const server = this.mcpService.createServer(ctx)`
    - `const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`
    - `await server.connect(transport)`
    - `res.on('close', () => { transport.close(); server.close(); })`
    - `await transport.handleRequest(req, res, req.body)`
  - `GET 'health'`：`@UseGuards()` 覆蓋（不需 auth），回 `{ status: 'ok', serverInfo: { name, version }, toolCount: registry.listTools({ scopes: ['*'], ... }).length }`
  - 驗收：typecheck 通過；`curl -X POST /mcp -H 'X-Api-Key: ...' -d '{"jsonrpc":"2.0","method":"initialize",...}'` 回 200；無 key 回 401

- [ ] **Task 9 — 建立 `backend/src/mcp/mcp.module.ts`，掛進 app**
  - `McpModule`：
    - imports: `PrismaModule`, `ApiKeysModule`
    - providers: `CrudToolFactory`, `CrudExecutor`, `McpToolRegistry`, `McpService`, `ApiKeyRateLimiter`（若 ApiKeyGuard 需要）
    - controllers: `McpController`
    - exports: `McpToolRegistry`（供其他 module 注入 custom tools 用）
  - 在 `backend/src/app.module.ts` 的 imports 加入 `McpModule`
  - 驗收：`pnpm -C backend dev` 啟動無 DI 錯誤；`GET /mcp/health` 回 tool count；typecheck 通過

- [ ] **Task 10 — 補 Prisma model doc comments**
  - 審閱 `backend/prisma/schema.prisma`：確認系統/敏感 model（如 `User`, `ApiKey`, `RolePermission`）都帶 `@internal` 或加 `@mcp-exclude`；為業務 model（如果有）補 `///` English doc comment
  - 執行 `pnpm -C backend schema:docs` 確認無錯
  - 驗收：`GET /mcp/health` 顯示的 toolCount 符合預期（非 internal model 才出現）

- [ ] **Task 11 — Phase 1 整合測試與 CLAUDE.md 更新**
  - `pnpm -C backend tsc --noEmit` 通過
  - 用 MCP Inspector 或 curl JSON-RPC 驗證：
    - `tools/list`：只顯示有 read scope 的 tools（用 read-only key）
    - `tools/call list_roles`：回傳列表
    - `tools/call delete_roles` 用 read-only key：回 scope error
    - `@internal` model 的 tools 不出現
  - 更新 `CLAUDE.md`，在適當位置加「MCP Server」章節，涵蓋：endpoint URL、auth 方式、`@internal` / `@mcp-exclude` 用法、`GET /mcp/health` 說明

---

### Phase 2：Decorator 擴充機制（Layer 2）

- [ ] **Task 12 — 建立 `backend/src/mcp/mcp-tool.decorator.ts`**
  - `export const MCP_TOOL_PROVIDERS = 'MCP_TOOL_PROVIDERS'`（injection token，字串常數）
  - `interface McpToolOptions { name: string; description: string; inputSchema: ZodType; requiredScopes?: string[] }`
  - `export function McpTool(options: McpToolOptions): MethodDecorator`：用 `Reflect.defineMetadata('mcp:tool', options, target, propertyKey)` 儲存 metadata
  - 驗收：decorator 可掛在 method 上、metadata 可被 `Reflect.getMetadata` 讀回；typecheck 通過

- [ ] **Task 13 — 更新 `backend/src/mcp/mcp-tool.registry.ts` 支援 Layer 2**
  - constructor 加 `@Optional() @Inject(MCP_TOOL_PROVIDERS) private readonly customProviders: object[]`（`@Optional()` 避免無 provider 時 DI 報錯）
  - `McpModule` 加 `{ provide: MCP_TOOL_PROVIDERS, useValue: [] }` 作預設（multi: true 預設空陣列）
  - `onModuleInit()` 末尾掃 `customProviders`：
    - 對每個 provider instance，掃 prototype methods 找有 `mcp:tool` metadata 的
    - 取 metadata，`z.toJSONSchema(options.inputSchema)` 轉 JSON Schema
    - handler = `method.bind(instance)`
    - **同名時 Layer 2 覆蓋 Layer 1**（`toolMap.set(name, ...)` 直接覆寫）
  - 驗收：Layer 2 tool 出現在 `listTools`；同名時 Layer 2 勝；typecheck 通過

- [ ] **Task 14 — 在 UsersModule 加 dummy custom tool 驗證**
  - 建立 `backend/src/users/users-mcp.tools.ts`，注入 `UsersService`，加一個 `@McpTool({ name: 'count_active_users', description: '...', inputSchema: z.object({}) })` 方法
  - 在 `backend/src/users/users.module.ts` 加 `{ provide: MCP_TOOL_PROVIDERS, useClass: UsersMcpTools, multi: true }`
  - 驗收：`tools/list` 出現 `count_active_users`；呼叫成功；typecheck 通過

- [ ] **Task 15 — Phase 2 收尾與文件**
  - 確認 dummy tool 保留或移除（視作 example 保留較佳）
  - 更新 `CLAUDE.md` MCP Server 章節，加「Layer 2 擴充語意 tool」說明（`@McpTool` 用法、`MCP_TOOL_PROVIDERS` multi-provider 註冊範例、`z.toJSONSchema` 用法）
  - `pnpm -C backend tsc --noEmit` 通過

---

### Phase 3：HR App 驗證

- [ ] **Task 16 — 同步 McpModule 到 auranest-hr**
  - 將 `backend/src/mcp/` 目錄複製到 `auranest-hr/backend/src/mcp/`
  - 安裝 `@modelcontextprotocol/sdk` dep
  - 在 `auranest-hr/backend/src/app.module.ts` 加入 `McpModule`
  - 驗收：HR backend 啟動；`GET /mcp/health` 顯示 HR model 的 auto tools

- [ ] **Task 17 — 建立 HR 語意 tools**
  - 建立 `auranest-hr/backend/src/employees/employees-mcp.tools.ts`（注入 `EmployeesService`、`OrgUnitsService`）
  - 實作：
    - `get_reporting_chain`：`inputSchema: z.object({ employeeId: z.string() })`，`requiredScopes: ['employee_profiles:read']`
    - `list_org_unit_members`：`inputSchema: z.object({ orgUnitId: z.string(), recursive: z.boolean().optional() })`，`requiredScopes: ['employee_profiles:read']`
  - 在 `EmployeesModule` 用 multi-provider 註冊
  - 驗收：兩個 custom tool 在 `tools/list` 出現並能回正確資料

- [ ] **Task 18 — HR 端到端測試**
  - 用真實 API key（對應不同 scope）跑全流程：
    - read-only key：能 list employees，不能 create
    - write key：能 create/update/delete
    - 兩個 custom tools 都能呼叫
    - `@internal` model 的 tools 不出現
  - 驗收：全流程通過；現有 REST API（Users、ApiKeys）未受影響

---

### Phase 4：其他 App 同步

- [ ] **Task 19 — Calendar 語意 tools**
  - 同步 McpModule 到 `auranest-calendar`
  - 實作 `check_calendar_availability`、`list_upcoming_events`
  - 驗收：tools 出現並可呼叫

- [ ] **Task 20 — Drive 語意 tools**
  - 同步 McpModule 到 `auranest-drive`
  - 實作 `list_folder_tree`、`get_file_download_url`（presigned URL，不走 MCP stream）
  - `DriveFile` 的 auto list 考慮加 `@mcp-exclude` 或截斷 content 欄位
  - 驗收：tools 出現並可呼叫

- [ ] **Task 21 — Wiki 語意 tools**
  - 同步 McpModule 到 `auranest-wiki`
  - 實作 `search_wiki`、`get_page_with_content`（回傳完整 Tiptap JSON content）
  - `list_wiki_pages` auto tool 截斷 content 欄位（在 CrudExecutor 加欄位黑名單機制或用 `@mcp-exclude` field marker）
  - 驗收：tools 出現並可呼叫；search 能回相關頁面

---

## 給 Sonnet 的關鍵提醒總覽

| 問題 | 正確做法 |
|------|---------|
| Auth user 形狀 | `user.scopes`（陣列），沒有 `user.role` |
| Prisma 動態存取 | `prisma[lcFirst(modelName)]`（model name camelCase，非 dbTable） |
| dbTable / scope 推導 | `m.dbName ?? m.name.toLowerCase()`（與 MetaService 一致） |
| Transport | stateless per-request，`sessionIdGenerator: undefined` |
| Body 傳遞 | `transport.handleRequest(req, res, req.body)` 第三參數必填 |
| Response 控制 | `@Res({ passthrough: false })`，不讓 Nest 攔截 |
| zod → JSON Schema | `z.toJSONSchema(schema)` zod v4 原生，不加新 dep |
| 錯誤處理 | catch 後回 `{ isError: true, content }` MCP 格式，不 throw |
| Phase 1 list tool | 不含 search，只有 `page/limit/sortField/sortOrder` |
| sortField default | 先找 `createdAt`，沒有用 `id` |
| 無單一主鍵 model | 只產 list + create，跳過 get/update/delete |
