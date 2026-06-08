# Data Dictionary

> Auto-generated from Prisma schema on 2026-06-08.
> Do not edit manually — run `pnpm -C backend schema:docs` to regenerate.

---

## Enums

### PermissionPolicy

> Default policy controlling how permission checks behave for a role. DENY_ALL: only explicitly granted permissions pass (default for all new roles). READ_ALL: all *_READ permissions pass automatically; writes/deletes require explicit grants. ALLOW_ALL: every permission check passes — custom ADMIN-level bypass for non-system roles.

| Value | Description |
|-------|-------------|
| `DENY_ALL` |  |
| `READ_ALL` |  |
| `ALLOW_ALL` |  |

### Permission

> Granular permission assignable to a custom Role. ADMIN bypasses all checks; these values are only evaluated for non-ADMIN roles. Embedded in the JWT at login.

| Value | Description |
|-------|-------------|
| `USERS_READ` |  |
| `USERS_CREATE` |  |
| `USERS_UPDATE` |  |
| `USERS_DELETE` |  |
| `API_KEYS_READ` |  |
| `API_KEYS_CREATE` |  |
| `API_KEYS_DELETE` |  |
| `CHAT_CHANNEL_READ` |  |
| `CHAT_CHANNEL_CREATE` |  |
| `CHAT_CHANNEL_DELETE` |  |
| `CHAT_MESSAGE_DELETE` | Delete any user's message (admin moderation). |

## Models

### Role

> System role or custom role. ADMIN and USER are seeded system roles and cannot be deleted. @internal Marked @internal so MetaService excludes it from the API-key scope catalog.

**DB table:** `roles`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `name` | String | ✓ | ✓ | Unique machine name, e.g. "ADMIN", "USER", "EDITOR". Used in JWT roleName field. |
| `displayName` | String | ✓ |  | Human-readable label shown in UI. |
| `isSystem` | Boolean | ✓ |  | System roles (ADMIN / USER) cannot be deleted or renamed. |
| `permissionPolicy` | PermissionPolicy | ✓ |  | Default deny; explicit permissions in RolePermission are additive on top of the policy. |
| `createdAt` | DateTime | ✓ |  |  |
| `updatedAt` | DateTime | ✓ |  |  |

### RolePermission

> Junction table between Role and Permission enum values. @internal Marked @internal so MetaService excludes it from the auto-derived scope catalog.

**DB table:** `role_permissions`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `roleId` | String | ✓ |  |  |
| `permission` | Permission | ✓ |  |  |

### UserRole

> Junction table supporting many-to-many User ↔ Role assignment. @internal

**DB table:** `user_roles`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `userId` | String | ✓ |  |  |
| `roleId` | String | ✓ |  |  |
| `createdAt` | DateTime | ✓ |  |  |

### User

> System user account. Used for authentication in local-auth mode. In OIDC mode the password field is unused; identity is verified via JWKS.

**DB table:** `users`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `email` | String | ✓ | ✓ | Login email, must be unique across the system. |
| `password` | String | ✓ |  |  |
| `name` | String |  |  | Display name shown in UI; optional. |
| `isActive` | Boolean | ✓ |  | Soft-disable without deleting — preserves audit history. |
| `pushEnabled` | Boolean | ✓ |  | Whether the user has opted into web push notifications globally. |
| `createdAt` | DateTime | ✓ |  |  |
| `updatedAt` | DateTime | ✓ |  |  |

### Channel

> Public or private chat channel. Members can post messages and threads.

**DB table:** `chat_channels`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `name` | String | ✓ |  | Display name, e.g. "general", "engineering". |
| `slug` | String | ✓ | ✓ | URL-safe identifier, unique across non-archived channels. Archived channels rename slug to "<slug>:archived:<id>". |
| `description` | String |  |  |  |
| `topic` | String |  |  | Short topic shown in the channel header. |
| `isPrivate` | Boolean | ✓ |  | Private channels are only visible to their members. |
| `createdById` | String | ✓ |  |  |
| `lastMessageAt` | DateTime |  |  | Denormalized timestamp of the last message; used to sort channels in the sidebar. |
| `archivedAt` | DateTime |  |  | Set when the channel is soft-archived. |
| `createdAt` | DateTime | ✓ |  |  |
| `updatedAt` | DateTime | ✓ |  |  |

### ChannelMember

> Membership record linking a user to a channel with a role.

**DB table:** `chat_channel_members`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `channelId` | String | ✓ |  |  |
| `userId` | String | ✓ |  |  |
| `role` | String | ✓ |  | OWNER: can manage channel settings and members. MEMBER: can post messages. |
| `joinedAt` | DateTime | ✓ |  |  |

### DirectConversation

> 1-on-1 direct message conversation between exactly two users.

**DB table:** `chat_direct_conversations`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `participantsHash` | String | ✓ | ✓ | SHA-256 of the two participant IDs sorted and joined by ":". Ensures uniqueness without a separate unique index. |
| `lastMessageAt` | DateTime |  |  |  |
| `createdAt` | DateTime | ✓ |  |  |

### DmParticipant

> Participant record in a direct conversation.

**DB table:** `chat_dm_participants`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `conversationId` | String | ✓ |  |  |
| `userId` | String | ✓ |  |  |

### Message

> A chat message in a channel or a DM. parentId makes it a thread reply (max one level deep).

**DB table:** `chat_messages`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `type` | String | ✓ |  | USER: regular message. BOT: posted by an incoming webhook. SYSTEM: automated notification. |
| `content` | String | ✓ |  |  |
| `senderId` | String | ✓ |  |  |
| `botName` | String |  |  | Display name override for bot/webhook messages. When set, shown instead of sender.name. |
| `channelId` | String |  |  | Belongs to a channel XOR a DM. Enforced at app layer + DB CHECK constraint in migration. |
| `dmId` | String |  |  |  |
| `parentId` | String |  |  | Parent message ID for thread replies. null = top-level message. Max one level: parent.parentId must be null. |
| `replyCount` | Int | ✓ |  | Denormalized count of thread replies for the thread preview badge. |
| `clientNonce` | String |  |  | Client-generated idempotency key. Nullable — only USER messages use it; NULL is not unique-constrained. |
| `editedAt` | DateTime |  |  |  |
| `deletedAt` | DateTime |  |  |  |
| `createdAt` | DateTime | ✓ |  |  |

### MessageRevision

> Immutable snapshot of a message saved before each edit for audit purposes.

**DB table:** `chat_message_revisions`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `messageId` | String | ✓ |  |  |
| `content` | String | ✓ |  |  |
| `editedAt` | DateTime | ✓ |  |  |
| `editorId` | String | ✓ |  |  |

### Mention

> @mention extracted from message content on send.

**DB table:** `chat_mentions`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `messageId` | String | ✓ |  |  |
| `mentionedUserId` | String |  |  | Mentioned user id. null for @here or @channel. |
| `mentionType` | String | ✓ |  | USER | HERE | CHANNEL |

### ChannelRead

> Tracks the last read message per user per channel. Single source of truth for channel unread counts.

**DB table:** `chat_channel_reads`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `channelId` | String | ✓ |  |  |
| `userId` | String | ✓ |  |  |
| `lastReadMessageId` | String |  |  |  |
| `lastReadAt` | DateTime | ✓ |  |  |

### DmRead

> Tracks the last read message per user per DM conversation. Single source of truth for DM unread counts.

**DB table:** `chat_dm_reads`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `conversationId` | String | ✓ |  |  |
| `userId` | String | ✓ |  |  |
| `lastReadMessageId` | String |  |  |  |
| `lastReadAt` | DateTime | ✓ |  |  |

### Reaction

> Emoji reaction on a message. Composite PK prevents a user from reacting with the same emoji twice.

**DB table:** `chat_reactions`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `messageId` | String | ✓ |  |  |
| `userId` | String | ✓ |  |  |
| `emoji` | String | ✓ |  |  |
| `createdAt` | DateTime | ✓ |  |  |

### Attachment

> File attached to a message. Uploaded before message creation; linked on send.

**DB table:** `chat_attachments`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `messageId` | String |  |  | Null until the owning message is created (pre-upload state). |
| `filename` | String | ✓ |  | Original filename as uploaded by the client. |
| `mimetype` | String | ✓ |  |  |
| `size` | Int | ✓ |  | File size in bytes. |
| `url` | String | ✓ |  | Relative URL path served by the backend, e.g. "/uploads/abc123.jpg". |

### IncomingWebhook

> Incoming webhook token that allows external systems (n8n, AI agents) to post messages to a channel.

**DB table:** `chat_incoming_webhooks`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `channelId` | String | ✓ |  |  |
| `name` | String | ✓ |  | Human-readable label, e.g. "n8n alert". |
| `prefix` | String | ✓ |  | First 16 chars of the raw token for display (e.g. "awh_a1b2c3d4e5f6g7"). |
| `tokenHash` | String | ✓ | ✓ | SHA-256 hash of the raw token. Raw token is shown once and never stored. |
| `createdById` | String | ✓ |  | The user who created this webhook; their account is used as the message sender. |
| `isActive` | Boolean | ✓ |  |  |
| `createdAt` | DateTime | ✓ |  |  |

### PushSubscription

> Web Push subscription for a user's browser/device.

**DB table:** `push_subscriptions`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `userId` | String | ✓ |  |  |
| `endpoint` | String | ✓ | ✓ | Push endpoint URL provided by the browser. |
| `p256dh` | String | ✓ |  | ECDH public key (base64url) for payload encryption. |
| `auth` | String | ✓ |  | Authentication secret (base64url). |
| `createdAt` | DateTime | ✓ |  |  |

### ApiKey

> Machine-to-machine API key for external integrations (n8n, AI agents). Created by ADMIN only. Raw key is shown once at creation and never stored. @internal

**DB table:** `api_keys`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✓ | ✓ |  |
| `name` | String | ✓ |  | Human-readable label, e.g. "n8n production" or "AI agent read-only". |
| `prefix` | String | ✓ |  | First 16 chars of the raw key, shown in lists for identification (e.g. "an_live_a1b2c3d4"). |
| `hashedKey` | String | ✓ | ✓ | SHA-256 hash of the raw key. The raw key is never persisted. |
| `roleId` | String | ✓ |  | Role this key authenticates as; FK to roles table. |
| `scopes` | String[] | ✓ |  | Module-level scopes, e.g. ["users:read","users:*"]. "*" = all scopes. Empty = deny all. |
| `rateLimit` | Int |  |  | Requests per minute. null = system default (60). |
| `isActive` | Boolean | ✓ |  | Whether this key can be used. Set false to revoke without deleting. |
| `expiresAt` | DateTime |  |  | Optional expiry. null = never expires. |
| `createdBy` | String |  |  | Email of the ADMIN who created this key. Snapshot string, no FK. |
| `lastUsedAt` | DateTime |  |  | Timestamp of last successful authentication with this key. |
| `createdAt` | DateTime | ✓ |  |  |
| `updatedAt` | DateTime | ✓ |  |  |
