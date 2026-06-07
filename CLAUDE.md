# auranest-app-template — Claude Development Guide

## 這個 repo 是什麼

AuraNest **V2 架構**的 app 範本。每個業務 app 從這個 template fork 出去，完全獨立部署，不依賴其他 app。

### 版本沿革

| 版本 | 架構 | 位置 |
|------|------|------|
| **V0** | 單體式，自建 auth | `AuraNest/v0/`（本機，gitignored） |
| **V1** | Turborepo monorepo，8 個 NestJS backend 共用 `business_db`，shared packages（`@auranest/auth`、`@auranest/ui` 等） | `AuraNest` repo，tag `v1-snapshot`；`AuraNest/v1/`（本機，gitignored） |
| **V2（此 template）** | 各 app 獨立 repo，各自獨立 DB，auth 由 `AUTH_MODE` env 切換 | 每個 app fork 此 repo |

V1 source 可在 `AuraNest/v1/apps/` 查閱實作細節。V0 可在 `AuraNest/v0/` 查閱。

---

## Project Layout

```
backend/                    NestJS 11 + Prisma 6
  .env                      本地開發用（Prisma + NestJS 讀這裡，與根目錄 .env 分開）
  pnpm-workspace.yaml       pnpm 11 allowBuilds（bcrypt、prisma、@nestjs/core 等）
  src/
    auth/
      strategies/
        local.strategy.ts   AUTH_MODE=local：HS256 JWT（payload: sub/email/name/role）
        oidc.strategy.ts    AUTH_MODE=oidc：JWKS 驗 token
      guards/
        jwt.guard.ts              JwtAuthGuard — 驗 Bearer token
        jwt-or-api-key.guard.ts   JwtOrApiKeyGuard — composite guard，API key 優先，fallback JWT
        roles.guard.ts            RolesGuard — 依 JWT role 檢查權限層級
        scope.guard.ts            ScopeGuard — 依 @Scopes() decorator 限制 API key 存取範圍
      decorators/
        roles.decorator.ts  @Roles(UserRole.ADMIN) 裝飾器
        scopes.decorator.ts @Scopes("users:read") 裝飾器（僅限制 API key，JWT user 直接放行）
      auth.module.ts        根據 AUTH_MODE 動態掛 strategy + controller
      auth.controller.ts    只在 local 模式：POST /auth/register、/auth/login、GET /auth/me
    users/
      users.controller.ts   CRUD /users（全需 ADMIN）
      users.service.ts      findAll/findById/create/update/updateRole/remove
      dto/user.dto.ts       CreateUserDto、UpdateUserDto、UpdateRoleDto
    api-keys/
      api-key.guard.ts            ApiKeyGuard — 驗 X-Api-Key header，hash 比對，rate limit
      api-key-rate-limiter.ts     in-memory per-key rate limiter（預設 60 req/min，含 TTL eviction）
      api-keys.service.ts         key 生成（an_live_ 前綴）、CRUD、scope 驗證
      api-keys.controller.ts      POST/GET/PATCH/DELETE /api-keys（全部需要 JWT ADMIN）
      dto/api-key.dto.ts          CreateApiKeyDto、UpdateApiKeyDto、CreateApiKeyResponse
    prisma/                 PrismaService（Global）
    common/filters/         GlobalExceptionFilter（統一 error shape）
    health/                 GET /health（Terminus）
  prisma/schema.prisma      User model + ApiKey model（含 UserRole enum: ADMIN/USER）
  prisma/seed.ts            建立預設 ADMIN 帳號（讀 SEED_USER_* env vars，upsert 不重複）

frontend/                   Next.js 16 + Tailwind v4 + shadcn/ui
  messages/
    zh-TW.json              繁中翻譯（sidebar / auth / nav / users / welcome / pages / common）
    en.json                 英文翻譯
  src/
    app/(main)/
      auth/login/           local：RHF 表單；oidc：SSO 按鈕
      auth/callback/        OIDC PKCE callback
      dashboard/
        layout.tsx          Sidebar + Header（含 Breadcrumb、LocaleSwitcher、LayoutControls、ThemeSwitcher）
        page.tsx            歡迎頁（個人化問候 + 快速存取卡片）
        users/
          page.tsx          Users 管理頁（data table、搜尋、skeleton loading）
          _components/
            create-user-dialog.tsx  建立用戶（RHF + Zod）
            edit-user-dialog.tsx    編輯 name + role（RHF + Zod）
            delete-user-dialog.tsx  刪除確認（AlertDialog）
    components/
      app-breadcrumb.tsx    路徑麵包屑（自動從 pathname 產生，支援 i18n）
      locale-switcher.tsx   語言切換 dropdown（cookie 持久化）
      ui/                   shadcn/ui 元件
    config/app-config.ts    ⚠️ Fork 後修改：app 名稱、meta title/description
    i18n/
      config.ts             locale 清單（locales、defaultLocale、Locale type）
      messages.ts           靜態 import 所有翻譯檔
      provider.tsx          I18nProvider（React Context）+ useTranslations() + useLocale()
    lib/
      auth.ts               token 管理、loginLocal()、redirectToOidc()、decodeToken()
      api.ts                apiFetch()（自動帶 Bearer token）+ usersApi
    hooks/use-current-user  從 JWT decode 當前使用者（useEffect 讀 localStorage，避免 hydration mismatch）
    navigation/sidebar/
      sidebar-items.ts      ⚠️ Fork 後加業務頁面 — title 用 i18n key（對應 messages.sidebar）
    server/server-actions.ts  getPreference()、setLocale() 等 server actions
    providers/              QueryProvider（TanStack Query）
    scripts/theme-boot.tsx  Pre-hydration theme boot script（export 字串，layout 直接注入）

docker-compose.yml          db + backend + frontend，完全自包含
.env                        Docker Compose 用（POSTGRES_* / AUTH_MODE / SEED_USER_* 等）
backend/.env                本地開發用（DATABASE_URL / AUTH_MODE / SEED_USER_* 等）
pnpm-workspace.yaml         pnpm 11 allowBuilds 設定（biome）
backend/pnpm-workspace.yaml  pnpm 11 allowBuilds（bcrypt、prisma、@nestjs/core 等）
frontend/pnpm-workspace.yaml  pnpm 11 allowBuilds（biome + sharp + msw + @parcel/watcher + @swc/core）
```

---

## Tech Stack

| 層 | 技術 |
|---|---|
| Backend | NestJS 11 · Prisma 6 · TypeScript 5.7 · pnpm 11 |
| Frontend | Next.js 16 · Tailwind CSS v4 · shadcn/ui · TanStack Query · TanStack Table · React Hook Form · Zod · Zustand · next-intl（移除，改用自製 I18nProvider） |
| Auth | Passport JWT（local: HS256 / oidc: RS256 JWKS）· RBAC（UserRole enum：ADMIN / USER） |
| i18n | 自製 React Context（`src/i18n/provider.tsx`）· 翻譯檔在 `messages/`（zh-TW / en） |
| Lint | Biome（root 1.9.x，frontend 2.x） |
| Dev | concurrently（root dev 腳本） |

---

## Auth 模式

`.env` 裡切換，不動程式碼：

```env
# Standalone（預設，不需要 Keycloak）
AUTH_MODE=local
JWT_SECRET=...

# SSO（Keycloak 或任何 OIDC provider）
AUTH_MODE=oidc
OIDC_JWKS_URL=https://keycloak.example.com/realms/app/protocol/openid-connect/certs
OIDC_ISSUER=https://keycloak.example.com/realms/app
OIDC_AUDIENCE=account
```

`local` 模式：backend 提供 `/auth/register` `/auth/login`，frontend 顯示表單。
`oidc` 模式：backend 只驗 JWKS，不掛 AuthController；frontend 顯示 SSO 按鈕。

---

## API Key（M2M）

供 n8n、AI Agent 等第三方系統使用，不依賴 JWT session。

**認證方式：** `X-Api-Key: an_live_<hex>` header  
**Guard 鏈：** `JwtOrApiKeyGuard`（API key 優先，fallback JWT）→ `RolesGuard` → `ScopeGuard`

**Key 設計：**
- 格式：`an_live_<32位 hex>`，DB 只存 SHA-256 hash
- `role: ADMIN | USER`：認證時注入等效 user context
- `scopes: string[]`：模組層級，e.g. `["users:read", "employees:*"]`。`"*"` 全放行
- `rateLimit`：per-key，預設 60 req/min（in-memory）
- `createdBy`：建立者 email snapshot，純字串，無 FK

**Scope 規則（ScopeGuard）：**
- 無 `@Scopes()` decorator → 放行
- JWT user → 放行（scope 只限制 API key）
- API key + `*` → 放行；`x:*` match `x:read`/`x:write`；不符合 → 403

**Controller 新增 scope 限制範例：**

```ts
@Get()
@Scopes("employees:read")
findAll() { ... }
```

**管理 endpoint（全部需要 JWT ADMIN）：**
```
POST   /api-keys
GET    /api-keys
GET    /api-keys/:id
PATCH  /api-keys/:id
DELETE /api-keys/:id
```

**Fork 後注意：** Key 前綴 `an_live_` 可依 app 修改（在 `api-keys.service.ts` 的 `KEY_PREFIX` 常數）。

---

## RBAC

JWT payload 包含 `role: UserRole`（ADMIN / USER）。

```
RolesGuard：ADMIN(100) > USER(10)
@Roles(UserRole.ADMIN) → 只有 ADMIN 可存取

Users API 全部需要 ADMIN：
  POST   /users          建立用戶
  GET    /users          列出所有用戶
  GET    /users/:id      取得單一用戶
  PATCH  /users/:id      更新 name / isActive
  PATCH  /users/:id/role 更新角色
  DELETE /users/:id      刪除用戶
```

Seed 帳號預設為 ADMIN。Frontend sidebar 的 Admin 群組僅 ADMIN 可見（`useCurrentUser()` 讀 JWT role）。

---

## i18n

自製輕量 React Context，**不需要 next-intl plugin**：

```
messages/zh-TW.json   繁中（預設）
messages/en.json      英文

src/i18n/config.ts    locales = ["zh-TW", "en"]、defaultLocale
src/i18n/messages.ts  靜態 import 兩份翻譯，export allMessages
src/i18n/provider.tsx I18nProvider + useTranslations(namespace) + useLocale()
```

`layout.tsx` 從 cookie 讀 `locale`，靜態取 messages，傳給 `<I18nProvider>`。  
切換語言由 `LocaleSwitcher` 呼叫 `setLocale()` server action 寫 cookie 後 reload。

**加新翻譯的方式（fork 後）：**
1. 在 `messages/zh-TW.json` 和 `messages/en.json` 加 key
2. 在 component 用 `const t = useTranslations("namespace")` 取用

**sidebar 選單 i18n：** `sidebar-items.ts` 的 `title`/`label` 填 translation key（對應 `messages.sidebar`），`nav-main.tsx` 自動用 `t()` 解析。

---

## Naming Conventions

V1 慣例延續：

- **Files:** kebab-case（`leave-request.controller.ts`）
- **Classes / types:** PascalCase（`LeaveRequestController`）
- **Functions / vars:** camelCase（`createLeaveRequest`）
- **Constants:** SCREAMING_SNAKE_CASE（`MAX_RETRY`）
- **Env vars:** SCREAMING_SNAKE_CASE（`DATABASE_URL`、`JWT_SECRET`）
- **Never hardcode `localhost`** — 全用 env var

## Prisma Conventions

V2 與 V1 的差異：**沒有 multi-schema，沒有 `@@schema()`**，每個 app 有自己的 Postgres 實例。

- Model name: PascalCase singular（`User`）
- Table name: snake_case plural via `@@map("users")`
- Field: camelCase → `@map("snake_case")`
- No cross-app FK（app 之間透過 event 或 API 溝通）
- Prisma client output: 預設路徑（`node_modules/@prisma/client`），**不使用自訂 output**

## Frontend UI 元件規範

建表單或 UI 前，**必須先查閱 `frontend/src/components/ui/`**，優先使用範本已有的 shadcn 元件，不直接用 HTML 原生控制項。

| 用途 | 使用元件 |
|------|----------|
| 日期選擇 | `DatePicker`（`components/ui/date-picker.tsx`）|
| 時間選擇 | `TimePicker`（`components/ui/time-picker.tsx`，24 小時制，HH:mm）|
| 日期範圍 | `DateRangePicker`（`components/ui/date-range-picker.tsx`）|
| 下拉選單（靜態 options）| `Select`（`components/ui/select.tsx`）|
| 下拉選單（動態 options）| `AppSelect`（`components/ui/app-select.tsx`）|
| 核取方塊 | `Checkbox`（`components/ui/checkbox.tsx`）|
| 開關切換 | `Switch`（`components/ui/switch.tsx`）|
| 多行文字 | `Textarea`（`components/ui/textarea.tsx`）|

凡 `<input type="date">` 、`<select>`、`<input type="checkbox">` 等 HTML 原生控制項，都應替換為上表對應的 shadcn 元件以確保視覺一致性。

**`Select` vs `AppSelect` 的選擇規則：**

- **靜態 options**（inline 常數陣列，如性別、層級、關係）→ 用 `Select` + `<SelectValue />`
- **動態 options**（從 API query 載入，如員工清單、部門清單）→ 一律用 `AppSelect`

`AppSelect` 的原因：Radix UI 的 `<SelectValue />` 需要 `SelectItem` 在 context 裡 register 才能顯示 label；動態 options 載入時序不固定，用 `AppSelect` 可透過 `options.find()` 直接算出顯示文字，完全避開這個問題。

> ⚠️ **`<SelectItem value="">` 是非法值**：Radix UI 不允許空字串作為 SelectItem 的 value，會造成 runtime error。需要「無選擇」選項時，用 `nullable` prop（AppSelect）或 `"__none__"` sentinel（原生 Select）。

```tsx
// ✅ 靜態 options → Select
<Select value={watch("gender")} onValueChange={(v) => setValue("gender", v)}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="MALE">男</SelectItem>
    <SelectItem value="FEMALE">女</SelectItem>
  </SelectContent>
</Select>

// ✅ 動態 options（從 API 載入）→ AppSelect
const employeeOptions = employees.map(e => ({ value: e.id, label: `${e.employeeNumber} — ${e.name}` }));

<AppSelect
  value={watch("employeeId") || null}
  onValueChange={(v) => setValue("employeeId", v ?? "")}
  options={employeeOptions}
  placeholder="選擇員工"
/>

// nullable（可清空）→ 加 nullable prop
<AppSelect
  value={watch("headId") ?? null}
  onValueChange={(v) => setValue("headId", v)}
  options={headOptions}
  nullable
/>
```

---

## Error Response Shape

與 V1 相同（`GlobalExceptionFilter` inline 在 `common/filters/`）：

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "traceId": "abc-123",
  "timestamp": "2026-06-02T10:30:00Z",
  "path": "/users"
}
```

---

## 新增一個業務模組的標準流程

每次新增 CRUD 功能（如員工管理、組織部門）都照以下順序進行。

### 1. Backend — Schema

```prisma
// backend/prisma/schema.prisma

/// Brief English description of what this enum represents.
enum MyStatus {
  ACTIVE   // optional per-value doc
  INACTIVE
}

/// English description of the model and its business purpose.
model MyModel {
  id        String    @id @default(cuid())
  /// Field-level description: business meaning, constraints, examples.
  name      String
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  @@map("my_models")
}
```

> **`///` doc comments are mandatory** — they feed into three AI-agent metadata layers (see *AI Agent Metadata* section below).

> ⚠️ **停掉 dev server** 再執行 generate / migrate（避免 Windows DLL 鎖定）

```bash
npx prisma generate
npx prisma migrate dev --name add_my_model
```

### 2. Backend — Module

依序建立：

```
backend/src/my-module/
  dto/my-model.dto.ts        # Zod schema + TypeScript type
  my-module.service.ts       # findAll / findOne / create / update / remove
  my-module.controller.ts    # @Controller + @UseGuards + ZodValidationPipe
  my-module.module.ts
```

- `findAll` 使用 `paginationQuerySchema` + `paginate()` / `toPrismaPage()` / `toPrismaOrderBy()`（來自 `common/pagination`）
- Controller 一律加 `JwtAuthGuard` + `RolesGuard`
- 在 `app.module.ts` imports 陣列加入新 module

```bash
npx tsc --noEmit   # 確認無型別錯誤
```

### 3. Frontend — API

```
frontend/src/lib/my-model-api.ts
```

- export `MyModel` interface（與 backend response 欄位對應）
- export `myModelApi.list / get / create / update / remove`
- list 函式接受 `ListQuery`，回傳 `PaginatedResult<MyModel>`

> ⚠️ **`limit` 上限是 100**：後端 `paginationQuerySchema` 設有 `max(100)`，傳超過 100 的值會得到 400 error。下拉選單用的「撈全部」查詢請用 `limit: 100`。

### 4. Frontend — i18n

在 `frontend/messages/zh-TW.json` 和 `en.json` 同步加入：

```json
{
  "sidebar": { "myModule": "顯示名稱" },
  "pages":   { "myModule": "顯示名稱" },
  "myModule": {
    "title": "...", "newItem": "...",
    "searchPlaceholder": "...", "noItems": "..."
    // CRUD 動作、欄位標籤、enum 對應文字…
  }
}
```

### 5. Frontend — Sidebar

`frontend/src/navigation/sidebar/sidebar-items.ts`：

```ts
{
  title: "myModule",          // 對應 messages.sidebar.myModule
  url: "/dashboard/my-module",
  icon: SomeIcon,
}
```

若新路由 segment 需要出現在麵包屑，同步更新 `app-breadcrumb.tsx` 的 `TRANSLATABLE_SEGMENTS`（對應 `messages.pages`）。

### 6. Frontend — 頁面

```
frontend/src/app/(main)/dashboard/my-module/
  page.tsx                   # 列表（TanStack Table + server-side 搜尋/排序/分頁）
  new/page.tsx               # 新增
  [id]/edit/page.tsx         # 編輯（見下方 Form 資料載入模式）
  _components/
    my-model-form.tsx        # 共用表單（RHF + Zod，欄位多時用獨立頁面）
    delete-my-model-dialog.tsx
```

**欄位多（> 8 個）→ 獨立頁面；欄位少 → Dialog 即可。**

**Form 資料載入模式（依情境選擇，禁止亂用 `useEffect + reset`）：**

**① Edit 獨立頁面** — `isLoading` 遮擋後 form 才 mount，直接用 `defaultValues`：

```tsx
// edit/page.tsx
const { data, isLoading } = useQuery({ queryKey: [...], queryFn: () => api.get(id) });

{isLoading ? <Skeleton /> : <MyModelForm defaultValues={data} />}

// my-model-form.tsx — 不需要 useEffect + reset
const form = useForm({
  defaultValues: defaultValues
    ? { name: defaultValues.name, ... }
    : { name: "" },
});
```

**② Edit Dialog（資料從 prop 同步取得）** — 在 `onOpenChange` 裡直接 reset：

```tsx
<Dialog onOpenChange={(o) => { setOpen(o); if (o) reset({ name: row.name, ... }); }}>
  ...
</Dialog>
```

**③ Edit Dialog（需 fetch fresh 資料）** — 加 `initialized` state，避免 async race：

```tsx
const [initialized, setInitialized] = useState(false);
const { data: fresh, isLoading } = useQuery({ enabled: open && mode === "edit" });

useEffect(() => {
  if (fresh) { reset({ ... }); setInitialized(true); }
  else if (!open) { setInitialized(false); }
}, [fresh, open]);

// 等兩者都就緒才顯示表單
{(isLoading || !initialized) ? <p>{tc("loading")}</p> : <form>...</form>}
```

> ⚠️ **`useEffect + reset` 配合 `defaultValues` prop 是危險反模式**：TanStack Query 在背景 refetch 後 data 產生新 reference，effect 重跑，會蓋掉使用者正在編輯的欄位。模式①②③都不需要這個寫法。

### 7. TypeScript 驗證

前後端都要通過，有錯要先修再繼續。

```bash
pnpm -C backend tsc --noEmit
pnpm -C frontend tsc --noEmit
```

### 8. 瀏覽器驗證

啟動開發伺服器（若還沒跑的話）：

```bash
pnpm dev   # backend :PORT + frontend :FRONTEND_PORT（見 .env）
```

用 `/run` 讓 Claude 開啟瀏覽器逐一驗證：

- **Golden path**：新增、列表、編輯、刪除的完整流程
- **邊界情境**：空資料、欄位驗證錯誤、API 錯誤提示
- **回歸確認**：確認現有功能（登入、Users 頁、API Keys 頁）未受影響

> ⚠️ **瀏覽器 token 可能過期**：若出現 401 或 API 回傳 P2025（User not found），重新登入即可取得正確 token。JWT 的 `sub` 與 DB 的 User ID 不符時，通常是 DB re-seed 後 token 沒更新所致。

### 9. Code Review

用 `/code-review` 讓 Claude 以多角度掃描本次 diff，重點檢查：

```
/code-review
```

或用 Opus 做更深度審查（較慢但更全面）：

```
/code-review ultra
```

常見問題清單（優先確認）：
- **IDOR**：每個 controller method 是否都驗證資源屬於當前 spaceId / userId
- **Auth guard**：`@UseGuards(JwtAuthGuard)` 是否掛在 controller class 層級
- **Fire-and-forget**：`void asyncFn()` 應改為 `.catch(err => console.error(...))`，避免錯誤消失
- **Prisma N+1**：迴圈內有 `findUnique/findFirst` 時考慮改成 `findMany` + Map
- **Direct dependency**：`main.ts` 或任何 source 直接 `require()` 的套件，必須在 `package.json` 宣告為 direct dependency（pnpm strict mode 不繼承 transitive deps）

### 10. 修正 Review 問題

逐一套用 review 找到的問題，每修完一批相關問題就再跑一次 typecheck 確認：

```bash
pnpm -C backend tsc --noEmit && pnpm -C frontend tsc --noEmit
```

### 11. Commit & Push

Commit message 遵循 Conventional Commits，格式：

```
<type>(<scope>): <簡短描述>

[選填：補充說明]
```

常用 type：
- `feat` — 全新功能
- `fix` — Bug 修正
- `chore` — 非功能性調整（依賴、設定）
- `refactor` — 重構（不影響行為）

```bash
git add <相關檔案>   # 不用 git add -A，避免意外加入 .env 或 binary
git commit -m "feat(my-module): add CRUD for MyModel"
git push
```

> **後端重啟注意**：若後端是從 `dist/` 直接執行（`node dist/src/main`），改完 source 後必須重新 build 再重啟：
> ```bash
> pnpm -C backend build   # 重新編譯
> # 然後重啟後端 process
> ```
> 用 `pnpm -C backend dev`（`nest start --watch`）開發時不需手動 build，watch mode 會自動重新編譯。

---

## AI Agent Metadata

Three layers expose schema knowledge to AI agents. **All descriptions must be in English** to minimise token usage.

### Layer 1 — Prisma `///` doc comments (source of truth)

Write `///` above every enum, model, and non-obvious field. Use single-line English sentences.

```prisma
/// Brief description of the enum's business purpose.
enum EmploymentStatus {
  ACTIVE      // currently employed
  RESIGNED    // voluntary separation
}

/// Description of the model and its role in the domain.
model EmployeeProfile {
  /// Company-assigned ID, e.g. "EMP-001". Must be unique.
  employeeNumber String @unique @map("employee_number")
}
```

### Layer 2 — `GET /meta/schema` (runtime)

Returns a JSON payload of all models + fields + enum values with their `///` documentation.
Requires `Authorization: Bearer <ADMIN token>` **or** an `X-Api-Key` with ADMIN role.

```json
{
  "generatedAt": "...",
  "models": [{ "name": "EmployeeProfile", "documentation": "...", "fields": [...] }],
  "enums":  [{ "name": "EmploymentStatus", "documentation": "...", "values": [...] }],
  "availableScopes": ["users:read", "users:write", "users:*", "employees:read", ...]
}
```

`availableScopes` 從 `Prisma.dmmf` 動態推導（`{dbTable}:read|write|*`），`@internal` model 自動排除。
AI agents 可呼叫此 endpoint 取得 schema 結構與合法 API key scope 清單。

### Layer 3 — `docs/data-dictionary.md` (design-time)

Auto-generated Markdown consumed by AI agents during design or code-review sessions.

```bash
pnpm -C backend schema:docs   # regenerate after any schema change
```

**Workflow rule:** After every `prisma migrate dev`, run `schema:docs` and commit the updated `docs/data-dictionary.md` together with the migration.

---

## Fork 一個新 app 的步驟

1. Fork / copy 此 repo → 重命名（e.g. `auranest-hr`）
2. 修改 `frontend/src/config/app-config.ts` — app 名稱、meta title / description
3. 修改 `frontend/src/navigation/sidebar/sidebar-items.ts` — 加業務頁面（title 用 i18n key）
4. 在 `messages/zh-TW.json` 和 `messages/en.json` 加對應翻譯（`sidebar`、`pages` namespace）
5. 修改 `backend/prisma/schema.prisma` — 加業務 model
6. 在 `backend/src/` 建立業務模組（參考 Users 模組結構）
7. 在 `frontend/src/app/(main)/dashboard/` 建立業務頁面（參考 users/ 目錄結構）
8. 更新 port（避免和其他 app 衝突）：
   - `.env.example`：`PORT` / `BACKEND_PORT` / `FRONTEND_PORT`
   - `frontend/package.json`：`dev` / `start` script 的 `-p` 參數
   - `frontend/.env.local`：`NEXT_PUBLIC_API_URL=http://localhost:<PORT>`
9. 設定 `SEED_USER_*` → 執行 `pnpm -C backend prisma:seed` 建立初始 ADMIN 帳號

---

## Quick Start

**本地開發**

```bash
cp .env.example .env          # 填 POSTGRES_PASSWORD、JWT_SECRET、SEED_USER_*

# Frontend 需要知道 backend URL（Next.js 從 frontend/ 目錄讀 .env.local）
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > frontend/.env.local

pnpm install                  # root dev tools
pnpm -C backend install
pnpm -C frontend install

docker compose up db -d
pnpm -C backend prisma:migrate   # 建立 schema
pnpm -C backend prisma:seed      # 建立預設 ADMIN 帳號（SEED_USER_* 設定在根目錄 .env）
pnpm dev                         # backend :3000 + frontend :3001
```

**全端 Docker 部署**

```bash
cp .env.example .env          # 填 POSTGRES_PASSWORD、JWT_SECRET、SEED_USER_*
docker compose up -d          # backend 啟動時自動執行 prisma migrate deploy
docker compose exec backend node_modules/.bin/prisma db seed   # 建立預設 ADMIN 帳號（第一次）
```

> `prisma migrate deploy` 在 backend container 啟動時自動執行，不需手動操作。seed 只需第一次部署時跑一次。

> **`.env` 的分工**
> - 根目錄 `.env` — **唯一主要設定檔**，backend scripts 皆以 `dotenv -e ../.env` 讀取，不需要 `backend/.env`
> - `frontend/.env.local` — Next.js 從 `frontend/` 目錄讀，設定 `NEXT_PUBLIC_API_URL`（已 gitignored）
> - `PORT` — NestJS 本地 dev server 監聽的 port；`BACKEND_PORT` — Docker host port mapping（兩個預設都是 3000）

---

## Ask vs Act

**Self-decide:** 建檔、安裝已知 deps、boilerplate CRUD、`pnpm typecheck` / `pnpm check`。

**Stop and ask:** 新增不在 spec 的外部 deps、auth 模式設計變更、docker / infra 修改、任何 push / deploy 動作。
