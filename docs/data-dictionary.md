# Data Dictionary

> Auto-generated from Prisma schema on 2026-06-04.
> Do not edit manually — run `pnpm -C backend schema:docs` to regenerate.

---

## Enums

### UserRole

> System role controlling access level. ADMIN has full CRUD access; USER has read-only access.

| Value | Description |
|-------|-------------|
| `ADMIN` |  |
| `USER` |  |

## Models

### User

> System user account. Used for authentication in local-auth mode. In OIDC mode the password field is unused; identity is verified via JWKS.

**DB table:** `users`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `email` | String | ✓ | ✓ | Login email, must be unique across the system. |
| `password` | String | ✓ |  |  |
| `name` | String |  |  | Display name shown in UI; optional. |
| `role` | UserRole | ✓ |  |  |
| `isActive` | Boolean | ✓ |  | Soft-disable without deleting — preserves audit history. |
| `createdAt` | DateTime | ✓ |  |  |
| `updatedAt` | DateTime | ✓ |  |  |

### ApiKey

> Machine-to-machine API key for external integrations (n8n, AI agents). Created by ADMIN only. Raw key is shown once at creation and never stored. @internal

**DB table:** `api_keys`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `name` | String | ✓ |  | Human-readable label, e.g. "n8n production" or "AI agent read-only". |
| `prefix` | String | ✓ |  | First 16 chars of the raw key, shown in lists for identification (e.g. "an_live_a1b2c3d4"). |
| `hashedKey` | String | ✓ | ✓ | SHA-256 hash of the raw key. The raw key is never persisted. |
| `role` | UserRole | ✓ |  | Role this key authenticates as when calling the API. |
| `scopes` | String[] | ✓ |  | Module-level scopes, e.g. ["users:read","employees:*"]. "*" = all scopes. Empty = deny all. |
| `rateLimit` | Int |  |  | Requests per minute. null = system default (60). |
| `isActive` | Boolean | ✓ |  | Whether this key can be used. Set false to revoke without deleting. |
| `expiresAt` | DateTime |  |  | Optional expiry. null = never expires. |
| `createdBy` | String |  |  | Email of the ADMIN who created this key. Snapshot string, no FK. |
| `lastUsedAt` | DateTime |  |  | Timestamp of last successful authentication with this key. |
| `createdAt` | DateTime | ✓ |  |  |
| `updatedAt` | DateTime | ✓ |  |  |
