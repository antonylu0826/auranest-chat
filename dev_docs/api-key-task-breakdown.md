# API Key — Task Breakdown

> 參考計畫：[api-key-implementation-plan.md](./api-key-implementation-plan.md)
> 每個 task 預估 15–30 分鐘。完成後執行 `npx tsc --noEmit` checkpoint。

---

## Backend

| # | Task | 檔案 | 狀態 |
|---|------|------|------|
| B1 | schema.prisma 新增 `ApiKey` model（無 FK、無 User 反向關聯）；停 dev server；`prisma generate` + `migrate dev --name add_api_keys`；`schema:docs` 更新 data-dictionary.md | `backend/prisma/schema.prisma`<br>`docs/data-dictionary.md` | [ ] |
| B2 | 建立 `meta.service.ts`：將 `buildMeta()` 及介面定義從 controller 移入，新增 `getAvailableScopes()`（過濾 `@internal`，flatMap `dbTable` scopes），`buildMeta()` 回傳加入 `availableScopes` 欄位 | `backend/src/meta/meta.service.ts` | [ ] |
| B3 | `meta.controller.ts` 改為注入 `MetaService`；`meta.module.ts` 加 `provide` + `export MetaService` | `backend/src/meta/meta.controller.ts`<br>`backend/src/meta/meta.module.ts` | [ ] |
| B4 | 建立 `@Scopes()` decorator（`SCOPES_KEY` + `SetMetadata`） | `backend/src/auth/decorators/scopes.decorator.ts` | [ ] |
| B5 | 建立 `ScopeGuard`：無 `@Scopes()` → 放行；非 `isApiKey` → 放行；wildcard match（`x:*` / 單獨 `*`）；不符合 → `ForbiddenException` | `backend/src/auth/guards/scope.guard.ts` | [ ] |
| B6 | 建立 in-memory rate limiter：per-key fixed-window（default 60/min），含 stale bucket TTL eviction，超限回傳 `{ allowed: false, retryAfter: number }` | `backend/src/api-keys/api-key-rate-limiter.ts` | [ ] |
| B7 | 建立 `ApiKeyGuard`：讀 `X-Api-Key` header（absent → `false`）；SHA-256 hash；AND query（`hashedKey` + `isActive` + `expiresAt`）；rate limit check（429 + `Retry-After`）；fire-and-forget `lastUsedAt`；注入 `request.user = { sub: key.id, role, scopes, isApiKey: true }` | `backend/src/api-keys/api-key.guard.ts` | [ ] |
| B8 | 建立 `JwtOrApiKeyGuard`（composite）：`ApiKeyGuard` 優先，`false` 時 fallback `JwtAuthGuard`；將 `users.controller.ts` 的 `@UseGuards` 改用新 guard | `backend/src/auth/guards/jwt-or-api-key.guard.ts`<br>`backend/src/users/users.controller.ts` | [ ] |
| B9 | 建立 Zod DTO：`CreateApiKeyDto`（name / role / scopes[] / rateLimit? / expiresAt?）；`UpdateApiKeyDto`（partial）；`CreateApiKeyResponse` type | `backend/src/api-keys/dto/api-key.dto.ts` | [ ] |
| B10 | 建立 `ApiKeysService`：`generateRawKey()`（`an_live_<32 hex>`）；`prefix` 取前 16 字；SHA-256 hash；`create()` 驗 scopes（`MetaService.getAvailableScopes()` + `"*"`）；從 JWT `req.user.email` 取 `createdBy`；`findAll`（pagination）/ `findOne` / `update` / `remove` | `backend/src/api-keys/api-keys.service.ts` | [ ] |
| B11 | 建立 `ApiKeysController`：`POST /api-keys`（回傳明文 key）/ `GET` / `GET :id` / `PATCH :id` / `DELETE :id`（204）；全部 `@UseGuards(JwtOrApiKeyGuard, RolesGuard)` + `@Roles(ADMIN)`；`ZodValidationPipe` | `backend/src/api-keys/api-keys.controller.ts` | [ ] |
| B12 | 建立 `ApiKeysModule`（import `MetaModule`，provide service / guard / limiter）；加入 `app.module.ts` imports | `backend/src/api-keys/api-keys.module.ts`<br>`backend/src/app.module.ts` | [ ] |
| B13 | `npx tsc --noEmit`（backend）確認無型別錯誤 | — | [ ] |

---

## Frontend

| # | Task | 檔案 | 狀態 |
|---|------|------|------|
| F1 | 建立 `api-keys-api.ts`：`ApiKey` / `CreateApiKeyResult` / `CreateApiKeyDto` / `UpdateApiKeyDto` 介面；`apiKeysApi.list / get / create / update / remove`；`getAvailableScopes()` helper（呼叫 `GET /meta/schema` 取 `availableScopes`） | `frontend/src/lib/api-keys-api.ts` | [ ] |
| F2 | `messages/zh-TW.json` 新增：`sidebar.apiKeys`、`pages.apiKeys`、`apiKeys.*` namespace（title / newKey / searchPlaceholder / noItems / keyCreatedOnce / copyKey / copied / fields.* / rateLimit.* / actions.*） | `frontend/messages/zh-TW.json` | [ ] |
| F3 | `messages/en.json` 同步新增 F2 所有 keys | `frontend/messages/en.json` | [ ] |
| F4 | `sidebar-items.ts` Admin 群組加 `{ title: "apiKeys", url: "/dashboard/api-keys", icon: KeyRound }` | `frontend/src/navigation/sidebar/sidebar-items.ts` | [ ] |
| F5 | `app-breadcrumb.tsx` 的 `TRANSLATABLE_SEGMENTS` 加 `"api-keys"` → `pages.apiKeys` | `frontend/src/components/app-breadcrumb.tsx` | [ ] |
| F6 | 建立列表頁：TanStack Table（server-side 搜尋/排序/分頁）；columns：prefix / name / role / scopes / createdBy / isActive / expiresAt / lastUsedAt / createdAt；skeleton loading；三個 action buttons | `frontend/src/app/(main)/dashboard/api-keys/page.tsx` | [ ] |
| F7 | 建立 `ScopeSelector`：呼叫 `getAvailableScopes()`；依 table name 分組 checkbox；選 `x:*` 自動取消 `x:read` / `x:write`；支援全域 `*`；loading state | `frontend/src/app/(main)/dashboard/api-keys/_components/scope-selector.tsx` | [ ] |
| F8 | 建立 `CreateApiKeyDialog`：RHF + Zod（name / role Select / ScopeSelector / rateLimit? / DatePicker expiresAt?）；成功後顯示明文 key + copy button + 「僅顯示一次」警告；copy 確認前鎖定關閉 | `frontend/src/app/(main)/dashboard/api-keys/_components/create-api-key-dialog.tsx` | [ ] |
| F9 | 建立 `EditApiKeyDialog`：RHF + Zod 編輯 name / role / scopes / rateLimit / isActive / expiresAt；使用 Dialog pattern ②（`onOpenChange` reset） | `frontend/src/app/(main)/dashboard/api-keys/_components/edit-api-key-dialog.tsx` | [ ] |
| F10 | 建立 `DeleteApiKeyDialog`：AlertDialog 確認刪除（參考 `delete-user-dialog.tsx`） | `frontend/src/app/(main)/dashboard/api-keys/_components/delete-api-key-dialog.tsx` | [ ] |
| F11 | `npx tsc --noEmit`（frontend）確認無型別錯誤 | — | [ ] |

---

## 執行順序

```
B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10 → B11 → B12 → B13
                                                                      ↓
F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F11
```

B13 通過後才進 Frontend。
