# MCP Server 實作規劃

**日期：** 2026-06-07  
**狀態：** 草稿  
**適用版本：** MCP Protocol 2025-03-26

---

## 背景與目標

每個由 `auranest-app-template` fork 出去的 App（HR、Calendar、Drive、Wiki 等）都應該內建 MCP Server，讓 AI agent（Claude、n8n、任何 MCP client）可以透過標準化的 tool interface 直接操作 App 的資料與功能，無需手刻 REST API 整合。

**設計原則：**
- Fork 後不做任何設定，自動得到所有 Prisma model 的 CRUD tools（零配置）
- 需要語意操作時，用 decorator 在 Service method 上標記（最小侵入）
- 認證沿用現有 API Key 機制，無需新建 auth 流程
- 新增 Prisma model 後，對應 MCP tools 自動出現，無需手動更新

---

## 架構概覽：兩層設計

```
┌────────────────────────────────────────────────────────┐
│                    McpModule (NestJS)                  │
│                                                        │
│  Layer 1: Auto CRUD Tools                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  CrudToolFactory                                 │  │
│  │  掃 Prisma DMMF → 每個 model 生成 5 個 tools     │  │
│  │  list_* / get_* / create_* / update_* / delete_* │  │
│  │  描述從 /// doc comment 自動抽取                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Layer 2: Custom Semantic Tools                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  @McpTool() decorator                            │  │
│  │  Service method → named tool with custom schema  │  │
│  │  由各 App fork 自行擴充                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  McpToolRegistry    收集兩層的 tools，dedup by name    │
│  McpController      POST /mcp  (Streamable HTTP)       │
│                     GET  /mcp/sse  (SSE transport)     │
└────────────────────────────────────────────────────────┘
         │
         ▼ auth
  ApiKeyGuard (X-Api-Key header)
  existing scopes + role 機制自動套入
```

---

## Layer 1：DMMF 自動 CRUD Tools

### 1.1 掃描邏輯

啟動時，`CrudToolFactory` 讀取 `Prisma.dmmf.datamodel.models`，跳過 doc comment 含 `@internal` 或 `@mcp-exclude` 的 model，為其餘每個 model 生成 5 個 tools。

### 1.2 Tool 命名規則

| Tool name | 對應操作 | Prisma 等效 |
|-----------|---------|------------|
| `list_{dbTable}` | 列表（含分頁、排序、搜尋） | `findMany` |
| `get_{dbTable}` | 取得單筆 | `findUnique` |
| `create_{dbTable}` | 新增 | `create` |
| `update_{dbTable}` | 更新 | `update` |
| `delete_{dbTable}` | 刪除 | `delete` |

`dbTable` 來自 `@@map("table_name")`（e.g. `EmployeeProfile` → `employee_profiles`）。

**範例（HR App 的 `EmployeeProfile` model）：**

```
list_employee_profiles   → { page, limit, search, orderBy, orderDir }
get_employee_profiles    → { id }
create_employee_profiles → { employeeNumber, name, email, ... }
update_employee_profiles → { id, name, email, ... }  (所有欄位可選)
delete_employee_profiles → { id }
```

### 1.3 Input Schema 生成規則

從 DMMF field 對應到 JSON Schema type：

| Prisma type | JSON Schema type |
|-------------|-----------------|
| `String` | `string` |
| `Int` / `Float` | `number` |
| `Boolean` | `boolean` |
| `DateTime` | `string` (format: date-time) |
| `Enum` | `string` (enum values from DMMF) |
| `Json` | `object` |

生成規則：
- `create` tool：`isRequired && !hasDefault` 的欄位為 required，其餘 optional
- `update` tool：`id` 為 required，其餘全部 optional（partial update）
- `list` tool：固定 schema `{ page?, limit?, search?, orderBy?, orderDir? }`
- `id` / `createdAt` / `updatedAt` 排除在 create/update input 之外（由系統管理）
- Relation fields（`kind: "object"`）排除（關聯透過 FK ID 欄位操作）

### 1.4 Tool Description

從 Prisma `///` doc comment 自動抽取：

```prisma
/// Core HR record. Stores employment details, compensation, and schedule assignment.
model EmployeeProfile { ... }
```

生成的 `list_employee_profiles` description：
```
List employee_profiles with pagination and search.
Core HR record. Stores employment details, compensation, and schedule assignment.
```

若無 doc comment，fallback 到通用描述：`List {model} records.`

### 1.5 執行層：CrudExecutor

`CrudToolFactory` 只生成 schema 定義，執行層由 `CrudExecutor` 動態呼叫 PrismaService：

```typescript
// 偽碼
async execute(toolName: string, args: unknown): Promise<unknown> {
  const { operation, dbTable } = parseToolName(toolName);
  const model = this.prisma[camelCase(dbTable)]; // e.g. prisma.employeeProfile
  switch (operation) {
    case 'list': return this.executeList(model, args);
    case 'get':  return model.findUnique({ where: { id: args.id } });
    // ...
  }
}
```

---

## Layer 2：@McpTool Decorator（語意操作）

### 2.1 Decorator API

```typescript
@McpTool({
  name: 'check_calendar_availability',
  description: 'Check available time slots for a user within a date range.',
  inputSchema: z.object({
    userId: z.string(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    durationMinutes: z.number().int().default(30),
  }),
})
async checkAvailability(args: { userId: string; startDate: string; endDate: string; durationMinutes: number }) {
  // 實際業務邏輯
}
```

### 2.2 Registration 機制

採用 **NestJS Multi-Provider pattern**（最簡單，無需 reflection 掃描）：

```typescript
// 各 App 的 CalendarModule
@Module({
  providers: [
    CalendarService,
    {
      provide: MCP_TOOL_PROVIDERS,  // multi-provider token
      useClass: CalendarMcpTools,   // 集中放 @McpTool 方法的 class
      multi: true,
    },
  ],
})
export class CalendarModule {}
```

`McpToolRegistry` 在 `onModuleInit()` 注入所有 `MCP_TOOL_PROVIDERS`，掃描 `@McpTool` metadata，收集 tool 定義與對應 handler。

**Layer 1 與 Layer 2 同名時，Layer 2 優先**（custom tool 覆蓋 auto-generated CRUD）。

### 2.3 各 App 的語意 Tool 範例

**auranest-calendar：**
```typescript
class CalendarMcpTools {
  @McpTool({ name: 'check_availability', description: '...' })
  checkAvailability(args) { ... }

  @McpTool({ name: 'list_upcoming_events', description: '...' })
  listUpcomingEvents(args: { userId: string; days: number }) { ... }
}
```

**auranest-wiki：**
```typescript
class WikiMcpTools {
  @McpTool({ name: 'search_wiki', description: 'Full-text search across all wiki pages.' })
  searchWiki(args: { query: string; spaceId?: string; limit?: number }) { ... }

  @McpTool({ name: 'get_page_with_content', description: 'Get a wiki page including its full Tiptap content.' })
  getPageWithContent(args: { pageId: string }) { ... }
}
```

**auranest-hr：**
```typescript
class HrMcpTools {
  @McpTool({ name: 'get_reporting_chain', description: 'Get the full management reporting chain for an employee.' })
  getReportingChain(args: { employeeId: string }) { ... }

  @McpTool({ name: 'list_org_unit_members', description: 'List all employees in an org unit, optionally including sub-units.' })
  listOrgUnitMembers(args: { orgUnitId: string; recursive?: boolean }) { ... }
}
```

**auranest-drive：**
```typescript
class DriveMcpTools {
  @McpTool({ name: 'list_folder_tree', description: 'Get the full folder hierarchy of a space.' })
  listFolderTree(args: { spaceId: string }) { ... }

  @McpTool({ name: 'get_file_download_url', description: 'Get a pre-signed download URL for a file.' })
  getFileDownloadUrl(args: { fileId: string; expiresInSeconds?: number }) { ... }
}
```

---

## Transport 與 Auth

### Transport：Streamable HTTP（MCP 2025-03-26）

```
POST /mcp           → Streamable HTTP（主要 endpoint，request + response 合一）
GET  /mcp/sse       → SSE（給需要 server-initiated messages 的 client）
GET  /mcp/health    → 健康檢查，回傳 serverInfo + tool count
```

使用 `@modelcontextprotocol/sdk` 的 `StreamableHTTPServerTransport`。

### Auth

沿用現有 `ApiKeyGuard`，MCP endpoint 要求 `X-Api-Key` header：

```
X-Api-Key: an_live_<hex>
```

**Scope 對應：**
- `*` → 所有 MCP tools
- `employee_profiles:read` → 只能呼叫 `list_employee_profiles` / `get_employee_profiles`
- `employee_profiles:write` → 另加 create / update / delete
- `employee_profiles:*` → read + write

Custom semantic tools 沒有自動 scope 對應，預設需要 `*` 或 key 上明確列出的 scope。可在 `@McpTool` 加 `requiredScope` 欄位收緊。

### Client 設定範例（Claude Desktop）

```json
{
  "mcpServers": {
    "auranest-hr": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "X-Api-Key": "an_live_xxxxxxxxxxxx"
      }
    }
  }
}
```

---

## 檔案結構

```
backend/src/mcp/
  mcp.module.ts              NestJS module，匯入 McpController + McpService + McpToolRegistry
  mcp.controller.ts          POST /mcp、GET /mcp/sse、GET /mcp/health
  mcp.service.ts             MCP protocol handler（initialize、tools/list、tools/call）
  mcp-tool.registry.ts       收集 Layer 1 auto tools + Layer 2 custom tools
  mcp-tool.decorator.ts      @McpTool() decorator + MCP_TOOL_PROVIDERS token
  auto/
    crud-tool.factory.ts     從 DMMF 生成 CRUD tool definitions
    crud-executor.ts         動態執行 Prisma CRUD 操作
    input-schema.builder.ts  Prisma field type → JSON Schema
  types.ts                   McpToolDefinition、McpToolProvider interface
```

**app.module.ts 加入：**
```typescript
import { McpModule } from './mcp/mcp.module';
// ...
@Module({
  imports: [..., McpModule],
})
```

---

## 實作階段

### Phase 1：Template 基礎建設（auto CRUD）

目標：Template 啟動後 `/mcp` 就能用，自動暴露所有 model 的 CRUD tools。

1. 安裝 `@modelcontextprotocol/sdk`
2. 建立 `types.ts`（McpToolDefinition interface）
3. 建立 `input-schema.builder.ts`（Prisma type → JSON Schema）
4. 建立 `crud-tool.factory.ts`（掃 DMMF，生成 tool definitions）
5. 建立 `crud-executor.ts`（動態 Prisma CRUD）
6. 建立 `mcp-tool.registry.ts`（收集 Layer 1 tools）
7. 建立 `mcp.service.ts`（MCP protocol：initialize、tools/list、tools/call）
8. 建立 `mcp.controller.ts`（POST /mcp endpoint + ApiKeyGuard）
9. 建立 `mcp.module.ts`，加入 `app.module.ts`
10. 在 Template 的 `User` / `ApiKey` model 上用 `///` 補齊 doc comments
11. TypeScript typecheck + 手動測試（curl / MCP Inspector）

**驗收標準：**
- `GET /mcp/health` 回傳 tool 清單
- `tools/list` 回傳 `list_users`, `get_users`, `create_users` 等
- `tools/call list_users` 回傳 User 列表（需有效 API Key）
- `@internal` model 不出現在 tool 清單

### Phase 2：Decorator 擴充機制

目標：建立 `@McpTool()` decorator 與 registry 整合，讓 fork App 可以加 custom tools。

1. 建立 `mcp-tool.decorator.ts`（`@McpTool()` + `MCP_TOOL_PROVIDERS` token）
2. 更新 `mcp-tool.registry.ts` 支援 Layer 2 providers
3. 更新 `mcp.module.ts` 支援 `forFeature()` 或 `useValue` 注入 custom providers

**驗收標準：**
- 在 Template 的 `users` module 加一個 dummy `@McpTool` 方法
- `tools/list` 裡出現該 custom tool
- 同名 custom tool 覆蓋 auto CRUD tool

### Phase 3：HR App 驗證

目標：在 `auranest-hr` 實作並驗證真實語意 tools。

1. 同步 Phase 1/2 的 McpModule 到 auranest-hr
2. 建立 `HrMcpTools` class（`get_reporting_chain`、`list_org_unit_members`）
3. 在 `CalendarsModule` / `EmployeesModule` 加 `MCP_TOOL_PROVIDERS`
4. 端到端測試：用 MCP Inspector 或 Claude Desktop 呼叫全部 tools

### Phase 4：同步其他 App

Calendar、Drive、Wiki 依序套用相同模式，各加對應語意 tools（見 2.3 節）。

---

## 依賴套件

```bash
pnpm -C backend add @modelcontextprotocol/sdk
```

無其他新依賴（JSON Schema 自建，不引入 ajv 等）。

---

## 備忘

- `list_*` tool 預設 `limit` 最大值沿用後端 pagination 上限（100），避免 AI agent 一次 dump 整個 table
- Relation 欄位（`kind: "object"`）不暴露在 MCP tool input，僅透過 FK ID 欄位操作
- `DriveFile` 的實際檔案內容透過 `get_file_download_url` custom tool 取得 presigned URL，不走 MCP stream
- Wiki 的 Tiptap JSON content 在 `list_wiki_pages` 裡預設截斷（`contentPreview`），`get_page_with_content` custom tool 才回傳全文
- Phase 1 完成後同步更新 `CLAUDE.md` 的「新增業務模組標準流程」，加入 MCP 相關步驟
