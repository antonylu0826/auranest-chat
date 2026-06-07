# API Key 實作計畫

## 目標

提供機器對機器（M2M）存取能力，支援 n8n、AI Agent 等第三方系統以 API Key 呼叫後端，不依賴使用者 JWT session。

## 設計摘要

| 項目 | 設計決策 |
|------|----------|
| Key 格式 | `an_live_<32位隨機hex>`（明文只在建立時回傳一次） |
| Key prefix | 前 16 字元，用於 UI 識別顯示 |
| 存儲 | DB 存 SHA-256 hash，明文不落地 |
| Owner 關聯 | **不設 FK**。改用 `createdBy String?`（snapshot email，無 relation） |
| Role | `ADMIN \| USER`，在 key 上直接設定，不依賴 owner |
| Scope 粒度 | 模組層級：`{dbTable}:read \| write \| *`，或單獨 `*` 全放行 |
| Scope 來源 | 從 `Prisma.dmmf` 動態推導，`@internal` model 排除在外 |
| Rate limit | 預設 60 req/min，可 per-key override（1–600），in-memory 實作 |
| 認證方式 | `X-Api-Key` header，通過後注入等效 user context |
| Guard 策略 | `JwtOrApiKeyGuard`（composite），API key 優先，fallback JWT |

---

## 架構圖

```
Request
  ├── X-Api-Key header → ApiKeyGuard
  │     ├── sha256 hash → query DB
  │     ├── 驗 isActive、expiresAt
  │     ├── rate limit check（429 + Retry-After on exceed）
  │     ├── 更新 lastUsedAt
  │     └── 注入 { sub: key.id, role, scopes, isApiKey: true }
  │
  └── Bearer token → JwtAuthGuard（Passport，fallback）
        └── 注入 { sub, role, isApiKey: undefined }

  ↓ (user context 已注入)
RolesGuard（檢查 user.role）
  ↓
ScopeGuard（無 @Scopes() decorator → 跳過；JWT user → 跳過；API key → 比對 scopes）
  ↓
Controller
```

---

## Prisma Schema

```prisma
/// Machine-to-machine API key for external integrations (n8n, AI agents).
/// Created by ADMIN only. Raw key is shown once and never stored. @internal
model ApiKey {
  id         String    @id @default(cuid())
  /// Human-readable label, e.g. "n8n production" or "AI agent read-only".
  name       String
  /// First 16 chars of the raw key, shown in lists for identification.
  prefix     String
  /// SHA-256 hash of the raw key. The raw key is never persisted.
  hashedKey  String    @unique @map("hashed_key")
  /// Role this key authenticates as. Set at creation; can be updated.
  role       UserRole  @default(USER)
  /// Module-level scopes, e.g. ["users:read","employees:*"]. "*" = all. Empty = deny all.
  scopes     String[]
  /// Requests per minute. null = system default (60).
  rateLimit  Int?      @map("rate_limit")
  /// Whether this key can be used. Set false to revoke without deleting.
  isActive   Boolean   @default(true) @map("is_active")
  /// Optional expiry. null = never expires.
  expiresAt  DateTime? @map("expires_at")
  /// Email of the ADMIN who created this key. Snapshot string, no FK.
  createdBy  String?   @map("created_by")
  /// Timestamp of last successful authentication with this key.
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  @@map("api_keys")
}
```

> `User` model **不需要**加反向關聯，沒有 FK。

執行：

```bash
npx prisma generate
npx prisma migrate dev --name add_api_keys
pnpm -C backend schema:docs
```

---

## Step 2 — MetaService（重構現有 meta.controller.ts）

將 `buildMeta()` 從 controller 抽出為可注入的 service，並新增 `getAvailableScopes()`：

```
backend/src/meta/
  meta.service.ts      ← 新增，抽出 buildMeta()，加 getAvailableScopes()
  meta.controller.ts   ← 改為注入 MetaService
  meta.module.ts       ← provide + export MetaService
```

`getAvailableScopes()` 邏輯：
- 過濾掉 `documentation` 含 `@internal` 的 model
- flatMap 成 `${m.dbTable}:read`, `${m.dbTable}:write`, `${m.dbTable}:*`
- scope 名稱依賴 `@@map` 的 table name（`m.dbName ?? m.name.toLowerCase()`）

`GET /meta/schema` response 新增 `availableScopes` 欄位：

```json
{
  "generatedAt": "...",
  "models": [...],
  "enums": [...],
  "availableScopes": ["users:read", "users:write", "users:*"]
}
```

> `@internal` model 仍出現在 `models` 陣列（供 AI agent schema 查詢），只排除在 `availableScopes` 外。

---

## Step 3 — ScopeGuard + @Scopes() Decorator

```
backend/src/auth/
  guards/scope.guard.ts
  decorators/scopes.decorator.ts
```

放行規則（優先序）：
1. Controller/method 無 `@Scopes()` decorator → **放行**
2. `request.user.isApiKey` 不為 true（JWT 使用者）→ **放行**
3. API key + scope `*` → **放行**
4. API key + scope `x:*` → match `x:read` / `x:write` → **放行**
5. 其餘不符合 → `ForbiddenException`

---

## Step 4 — ApiKey 模組

```
backend/src/api-keys/
  dto/api-key.dto.ts
  api-keys.service.ts
  api-keys.controller.ts
  api-keys.module.ts
  api-key.guard.ts         ← ApiKeyGuard
  api-key-rate-limiter.ts  ← in-memory rate limiter（含 TTL eviction）
```

**ApiKeyGuard 流程：**

```
1. 讀 X-Api-Key header；若無則 return false（交給 JWT fallback）
2. SHA-256 hash raw key
3. 查 DB：AND(hashedKey, isActive=true, OR(expiresAt=null, expiresAt > now))
4. rate limiter check → 429 + Retry-After header on exceed
5. 更新 lastUsedAt（fire-and-forget，不阻塞）
6. 注入 request.user = { sub: key.id, role: key.role, scopes: key.scopes, isApiKey: true }
```

**DTO：**

```ts
CreateApiKeyDto {
  name: string       // required
  role: UserRole     // required
  scopes: string[]   // required；在 service 層驗證（對比 MetaService.getAvailableScopes() + "*"）
  rateLimit?: number // optional, 1–600
  expiresAt?: string // optional ISO date string
}

UpdateApiKeyDto      // partial: name / role / scopes / rateLimit / isActive / expiresAt

// Response（只在 POST 時含明文 key）
CreateApiKeyResponse {
  id: string
  key: string        // 明文，僅此一次
  prefix: string
  name: string
  role: UserRole
  scopes: string[]
  createdAt: string
}
```

**Controller endpoints（全部 JWT ADMIN 才能呼叫）：**

```
POST   /api-keys        建立（回傳明文 key）
GET    /api-keys        列出（搜尋/排序/分頁）
GET    /api-keys/:id    取得單一
PATCH  /api-keys/:id    更新 name / role / scopes / rateLimit / isActive / expiresAt
DELETE /api-keys/:id    刪除（204）
```

---

## Step 5 — 複合 Guard（JwtOrApiKeyGuard）

NestJS 的 `AuthGuard('jwt')` 在 `canActivate` 裡直接執行 Passport strategy，沒有 Bearer token 就拋 `UnauthorizedException`，不會讓後面的 guard 有機會跑。因此需要建立 composite guard：

```
backend/src/auth/guards/jwt-or-api-key.guard.ts
```

```ts
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly jwtGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // API key 優先；ApiKeyGuard 回傳 false 表示「沒有 X-Api-Key header」，非錯誤
    const apiKeyPassed = await this.apiKeyGuard.canActivate(context);
    if (apiKeyPassed) return true;
    // fallback：標準 JWT
    return this.jwtGuard.canActivate(context) as Promise<boolean>;
  }
}
```

原本各 controller 的 `@UseGuards(JwtAuthGuard, RolesGuard)` 改為 `@UseGuards(JwtOrApiKeyGuard, RolesGuard)`。

---

## Step 6 — Frontend API Layer

```
frontend/src/lib/api-keys-api.ts
```

```ts
export interface ApiKey {
  id: string
  name: string
  prefix: string
  role: UserRole
  scopes: string[]
  rateLimit: number | null
  isActive: boolean
  expiresAt: string | null
  createdBy: string | null   // snapshot email，非 FK
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateApiKeyResult extends ApiKey {
  key: string  // 明文，只在建立時存在
}
```

---

## Step 7 — i18n

`messages/zh-TW.json` 和 `en.json` 同步新增：

```json
{
  "sidebar": { "apiKeys": "API 金鑰" },
  "pages":   { "apiKeys": "API 金鑰" },
  "apiKeys": {
    "title": "API 金鑰管理",
    "newKey": "建立金鑰",
    "searchPlaceholder": "搜尋名稱...",
    "noItems": "尚無 API 金鑰",
    "keyCreatedOnce": "金鑰只顯示一次，請立即複製並妥善保存",
    "copyKey": "複製金鑰",
    "copied": "已複製",
    "fields": {
      "name": "名稱",
      "role": "權限層級",
      "scopes": "存取範圍",
      "rateLimit": "速率限制（req/min）",
      "expiresAt": "到期日",
      "isActive": "啟用",
      "prefix": "金鑰前綴",
      "createdBy": "建立者",
      "lastUsedAt": "最後使用",
      "createdAt": "建立時間"
    },
    "rateLimit": {
      "default": "預設（60/min）",
      "custom": "自訂"
    },
    "actions": {
      "revoke": "撤銷",
      "revokeConfirm": "確定要撤銷此金鑰？此操作無法復原。"
    }
  }
}
```

---

## Step 8 — Frontend 頁面

欄位數 < 8，使用 Dialog 模式。

```
frontend/src/app/(main)/dashboard/api-keys/
  page.tsx
  _components/
    create-api-key-dialog.tsx   ← 建立後顯示「只出現一次」明文 key + copy button
    edit-api-key-dialog.tsx
    delete-api-key-dialog.tsx
    scope-selector.tsx          ← 從 /meta/schema availableScopes 動態載入，依模組分組
```

**`ScopeSelector`：**
- 呼叫 `GET /meta/schema` 取 `availableScopes`
- 依模組名分組（`users`, `employees` 等）
- 選 `x:*` 時自動取消同模組的 `x:read` / `x:write`
- 支援選單獨 `*`（全放行）

**app-breadcrumb.tsx** 需加 `api-keys` → `pages.apiKeys` 到 `TRANSLATABLE_SEGMENTS`。

**Sidebar：**

```ts
// sidebar-items.ts — Admin 群組
{ title: "apiKeys", url: "/dashboard/api-keys", icon: KeyRound }
```

---

## 不在本計畫範圍內

- Redis-based rate limiter（in-memory 先行，有多實例需求再換）
- API key audit log（呼叫記錄）
- Key rotation（刪掉重建即可）
- Webhook 觸發

---

## Task Breakdown

### Backend

```
[ ] B1  — schema.prisma: 新增 ApiKey model（無 FK，無 User 反向關聯）；執行 prisma generate + migrate dev --name add_api_keys；執行 schema:docs 更新 data-dictionary.md
[ ] B2  — meta/meta.service.ts: 建立 @Injectable MetaService，從 meta.controller.ts 移入 buildMeta()（含介面定義）；新增 getAvailableScopes()（過濾 @internal，flatMap dbTable scopes）；buildMeta() 回傳值加入 availableScopes 欄位
[ ] B3  — meta/meta.controller.ts: 改為注入 MetaService；meta.module.ts export MetaService
[ ] B4  — auth/decorators/scopes.decorator.ts: SCOPES_KEY + @Scopes(...string[]) via SetMetadata
[ ] B5  — auth/guards/scope.guard.ts: 讀 @Scopes metadata；無 decorator → 放行；非 isApiKey → 放行；API key → wildcard match（x:* / *）；不符合 → ForbiddenException
[ ] B6  — api-keys/api-key-rate-limiter.ts: in-memory per-key fixed-window（default 60/min）；含 stale bucket TTL eviction；超限回傳 { allowed: false, retryAfter: number }
[ ] B7  — api-keys/api-key.guard.ts: ApiKeyGuard — 讀 X-Api-Key header；absent → return false；sha256 hash；AND query（hashedKey + isActive + expiresAt）；rate limit check → 429 + Retry-After；fire-and-forget lastUsedAt；注入 request.user = { sub: key.id, role, scopes, isApiKey: true }
[ ] B8  — auth/guards/jwt-or-api-key.guard.ts: JwtOrApiKeyGuard composite — ApiKeyGuard 優先，false 時 fallback JwtAuthGuard；將 users.controller.ts 的 @UseGuards 改為 JwtOrApiKeyGuard + RolesGuard
[ ] B9  — api-keys/dto/api-key.dto.ts: Zod CreateApiKeyDto（name, role, scopes[], rateLimit?, expiresAt?）；UpdateApiKeyDto（partial）；CreateApiKeyResponse type
[ ] B10 — api-keys/api-keys.service.ts: generateRawKey（crypto.randomBytes(16).toString('hex') → an_live_ 前綴）；prefix 取前 16 字元；sha256 hash；create() 驗 scopes 合法性（MetaService + "*"）；從 req.user.email 取 createdBy；findAll（pagination）；findOne；update；remove；注入 PrismaService + MetaService
[ ] B11 — api-keys/api-keys.controller.ts: POST/GET/GET:id/PATCH/DELETE；全部 @UseGuards(JwtOrApiKeyGuard, RolesGuard) + @Roles(ADMIN)；ZodValidationPipe；POST 回傳明文 key；DELETE 回傳 204
[ ] B12 — api-keys/api-keys.module.ts: 組裝所有 providers；import MetaModule；加入 app.module.ts imports
[ ] B13 — npx tsc --noEmit（backend）確認無型別錯誤
```

### Frontend

```
[ ] F1  — frontend/src/lib/api-keys-api.ts: ApiKey / CreateApiKeyResult / CreateApiKeyDto / UpdateApiKeyDto 介面；apiKeysApi.list / get / create / update / remove；meta-api helper（getAvailableScopes from GET /meta/schema）
[ ] F2  — messages/zh-TW.json: 新增 sidebar.apiKeys / pages.apiKeys / apiKeys.* namespace
[ ] F3  — messages/en.json: 同步 F2
[ ] F4  — sidebar-items.ts: Admin 群組加 { title: "apiKeys", url: "/dashboard/api-keys", icon: KeyRound }
[ ] F5  — app-breadcrumb.tsx: TRANSLATABLE_SEGMENTS 加 "api-keys" → pages.apiKeys
[ ] F6  — dashboard/api-keys/page.tsx: TanStack Table（server-side 搜尋/排序/分頁）；columns: prefix / name / role / scopes / createdBy / isActive / expiresAt / lastUsedAt / createdAt；skeleton loading；create/edit/delete actions
[ ] F7  — _components/scope-selector.tsx: 呼叫 getAvailableScopes；依 table name 分組 checkbox；選 x:* 自動取消 x:read + x:write；支援全域 *；loading state
[ ] F8  — _components/create-api-key-dialog.tsx: RHF + Zod；欄位：name / role（Select）/ scopes（ScopeSelector）/ rateLimit（可選）/ expiresAt（DatePicker，可選）；成功後顯示明文 key + copy button + 「僅顯示一次」警告；確認複製後才能關閉
[ ] F9  — _components/edit-api-key-dialog.tsx: RHF + Zod；編輯 name / role / scopes / rateLimit / isActive / expiresAt；使用 Dialog pattern ②（prop 同步）或 ③（fetch fresh）
[ ] F10 — _components/delete-api-key-dialog.tsx: AlertDialog 確認刪除
[ ] F11 — npx tsc --noEmit（frontend）確認無型別錯誤
```
