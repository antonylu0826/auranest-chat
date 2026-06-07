# AuraNest Chat — 系統設計計畫

> 版本：1.0（V2 standalone）
> 撰寫日期：2026-06-08
> 參考：V0 `apps/chat`、V1 `apps/chat`
> 狀態：規劃中

---

## 概覽

基於 `auranest-app-template`（V2 架構）建置 Slack-like 即時通訊應用程式。完全獨立部署，不依賴其他 AuraNest app。支援 Channel（公開/私有頻道）與 DM（1 對 1 直接訊息），搭配 Socket.IO 即時推送。

### 設計理念

- **Channel 為核心**：類 Slack 的 `channel → message → thread` 三層結構
- **即時優先**：Socket.IO WebSocket gateway，訊息傳送後立即廣播，不 polling
- **最後寫入覆蓋（last-write-wins）**：訊息編輯以最後一次為準，舊版本留 revision 記錄
- **內部人員使用**：無多租戶需求，所有登入用戶同屬一個 org
- **不做即時協作**：Phase 1 只做訊息，Bots / Push 移到 Phase 2

---

## 技術棧

| 層 | 技術 |
|---|---|
| Backend | NestJS 11 · Prisma 6 · TypeScript · pnpm 11 |
| Database | PostgreSQL（chat_db）|
| 即時通訊 | Socket.IO（NestJS WebSocketGateway）|
| Frontend | Next.js 16 · Tailwind CSS v4 · shadcn/ui · TanStack Query · Zustand |
| Auth | Template 內建 JWT（local HS256 / OIDC RS256）|
| Ports | Backend **3040** · Frontend **3041** |

---

## 核心概念

```
User（template）
  ├── Channel（公開/私有頻道）
  │     ├── ChannelMember（OWNER / MEMBER）
  │     └── Message（訊息）
  │           ├── Message（Thread 回覆，parentId）
  │           ├── Reaction（emoji）
  │           └── Mention（@user）
  └── DirectConversation（1 對 1 DM）
        ├── DmParticipant
        └── Message（同上）
```

---

## V0 → V2 架構差異

| 項目 | V0 | V2（此 app）|
|------|-----|------------|
| 用戶參照 | `UserRef` 獨立 model（從 central auth 同步） | 直接 FK 到本地 `User` table |
| Auth verify | `@auranest/auth-verify` shared package | Template 內建 `JwtOrApiKeyGuard` |
| WebSocket auth | 外部 `AUTH_VERIFIER` inject | 用 `JwtService.verify()` 直接驗 |
| 水平擴展 | V1 有 Redis IO adapter | Phase 1 單機，跳過 Redis |
| Bot 支援 | Phase 1 實作 | Phase 2 |
| Push 通知 | Phase 1 實作 | Phase 2 |

---

## 資料模型

```prisma
// ─── Chat Permissions（加入 Permission enum）────────────────────────────────

enum Permission {
  // ...（template 現有）
  CHAT_CHANNEL_READ
  CHAT_CHANNEL_CREATE
  CHAT_CHANNEL_DELETE
  CHAT_MESSAGE_DELETE   // 刪除他人訊息（管理員）
}

// ─── Channels ───────────────────────────────────────────────────────────────

/// Public or private chat channel. Members can post messages and threads.
model Channel {
  id            String    @id @default(cuid())
  /// Display name, e.g. "general", "engineering".
  name          String
  /// URL-safe identifier, unique across all channels.
  slug          String    @unique
  description   String?
  /// Short topic shown in channel header.
  topic         String?
  /// Private channels are only visible to members.
  isPrivate     Boolean   @default(false) @map("is_private")
  createdById   String    @map("created_by_id")
  createdBy     User      @relation("ChannelCreator", fields: [createdById], references: [id])
  /// Denormalized timestamp of the last message; used for sidebar sort.
  lastMessageAt DateTime? @map("last_message_at")
  /// Set when the channel is archived (soft-disabled).
  archivedAt    DateTime? @map("archived_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  members  ChannelMember[]
  messages Message[]

  @@map("chat_channels")
}

/// Membership record linking a user to a channel.
model ChannelMember {
  channelId String  @map("channel_id")
  userId    String  @map("user_id")
  /// OWNER: can manage channel settings and members. MEMBER: can post messages.
  role      String  @default("MEMBER") // OWNER | MEMBER
  channel   Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user      User    @relation("ChannelMemberships", fields: [userId], references: [id])
  joinedAt  DateTime  @default(now()) @map("joined_at")
  lastReadAt DateTime? @map("last_read_at")

  @@id([channelId, userId])
  @@map("chat_channel_members")
}

// ─── Direct Messages ─────────────────────────────────────────────────────────

/// 1-on-1 direct message conversation between two users.
model DirectConversation {
  id               String   @id @default(cuid())
  /// SHA-256 of sorted participantIds joined by ":"; ensures uniqueness.
  participantsHash String   @unique @map("participants_hash")
  lastMessageAt    DateTime? @map("last_message_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  participants DmParticipant[]
  messages     Message[]

  @@map("chat_direct_conversations")
}

/// Participant record in a direct conversation.
model DmParticipant {
  conversationId String             @map("conversation_id")
  userId         String             @map("user_id")
  conversation   DirectConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User               @relation("DmParticipations", fields: [userId], references: [id])

  @@id([conversationId, userId])
  @@map("chat_dm_participants")
}

// ─── Messages ────────────────────────────────────────────────────────────────

/// A chat message, either in a channel or a DM. parentId makes it a thread reply.
model Message {
  id          String    @id @default(cuid())
  /// USER: regular user message.
  type        String    @default("USER") // USER | SYSTEM
  content     String
  senderId    String    @map("sender_id")
  sender      User      @relation("MessageSender", fields: [senderId], references: [id])
  /// Belongs to a channel XOR a DM (enforced at app layer).
  channelId   String?   @map("channel_id")
  dmId        String?   @map("dm_id")
  /// Parent message id for thread replies; null = top-level message.
  parentId    String?   @map("parent_id")
  /// Denormalized reply count for thread preview.
  replyCount  Int       @default(0) @map("reply_count")
  /// Client-generated idempotency key to prevent duplicate sends.
  clientNonce String?   @map("client_nonce")
  editedAt    DateTime? @map("edited_at")
  deletedAt   DateTime? @map("deleted_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  channel  Channel?            @relation(fields: [channelId], references: [id])
  dm       DirectConversation? @relation(fields: [dmId], references: [id])
  parent   Message?            @relation("Thread", fields: [parentId], references: [id])
  replies  Message[]           @relation("Thread")
  reactions  Reaction[]
  mentions   Mention[]
  revisions  MessageRevision[]

  @@index([channelId, createdAt(sort: Desc)])
  @@index([dmId, createdAt(sort: Desc)])
  @@index([parentId])
  @@unique([senderId, clientNonce], name: "unique_nonce")
  @@map("chat_messages")
}

/// Immutable snapshot of a message saved before each edit.
model MessageRevision {
  id        String   @id @default(cuid())
  messageId String   @map("message_id")
  content   String
  editedAt  DateTime @default(now()) @map("edited_at")
  editorId  String   @map("editor_id")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@map("chat_message_revisions")
}

/// @mention extracted from message content.
model Mention {
  id              String  @id @default(cuid())
  messageId       String  @map("message_id")
  /// Mentioned user id; null for @here / @channel.
  mentionedUserId String? @map("mentioned_user_id")
  /// USER | HERE | CHANNEL
  mentionType     String  @map("mention_type")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([mentionedUserId])
  @@map("chat_mentions")
}

// ─── Read State ──────────────────────────────────────────────────────────────

/// Tracks the last read message per user per channel (for unread badge).
model ChannelRead {
  channelId         String   @map("channel_id")
  userId            String   @map("user_id")
  lastReadMessageId String?  @map("last_read_message_id")
  lastReadAt        DateTime @default(now()) @map("last_read_at")

  @@id([channelId, userId])
  @@map("chat_channel_reads")
}

/// Tracks the last read message per user per DM conversation.
model DmRead {
  conversationId    String   @map("conversation_id")
  userId            String   @map("user_id")
  lastReadMessageId String?  @map("last_read_message_id")
  lastReadAt        DateTime @default(now()) @map("last_read_at")

  @@id([conversationId, userId])
  @@map("chat_dm_reads")
}

// ─── Reactions ───────────────────────────────────────────────────────────────

/// Emoji reaction on a message. Composite PK prevents duplicate reactions.
model Reaction {
  messageId String   @map("message_id")
  userId    String   @map("user_id")
  emoji     String
  createdAt DateTime @default(now()) @map("created_at")

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation("MessageReactions", fields: [userId], references: [id])

  @@id([messageId, userId, emoji])
  @@index([messageId])
  @@map("chat_reactions")
}
```

---

## API 設計

所有 endpoint 加 `/api` 前綴（NestJS `setGlobalPrefix('api')`）。

### Channels

| Method | Path | Guard | 說明 |
|--------|------|-------|------|
| GET | `/channels` | JWT | 列出可見頻道（公開 + 已加入的私有）|
| POST | `/channels` | JWT | 建立頻道（自動加 creator 為 OWNER）|
| GET | `/channels/:id` | JWT | 取得頻道詳情 |
| PATCH | `/channels/:id` | JWT + OWNER | 更新頻道（name / description / topic）|
| DELETE | `/channels/:id` | JWT + OWNER | 封存頻道（soft archive）|

### Channel Members

| Method | Path | Guard | 說明 |
|--------|------|-------|------|
| GET | `/channels/:id/members` | JWT + member | 列出成員 |
| POST | `/channels/:id/members` | JWT + OWNER | 加入成員 |
| DELETE | `/channels/:id/members/:userId` | JWT + OWNER 或自己 | 移除成員 |

### Messages（REST，用於初次載入）

| Method | Path | Guard | 說明 |
|--------|------|-------|------|
| GET | `/channels/:id/messages` | JWT + access | cursor-based 分頁（before, limit）|
| GET | `/dms/:id/messages` | JWT + participant | cursor-based 分頁 |
| GET | `/messages/:id/thread` | JWT + access | 取得 thread 回覆列表 |

### DMs

| Method | Path | Guard | 說明 |
|--------|------|-------|------|
| GET | `/dms` | JWT | 列出我的 DM 對話 |
| POST | `/dms` | JWT | 開啟 / 取得 DM（傳 `targetUserId`，已存在則回傳既有對話）|
| GET | `/dms/:id` | JWT + participant | 取得對話詳情 |

### Read State

| Method | Path | Guard | 說明 |
|--------|------|-------|------|
| POST | `/read/channel/:channelId` | JWT | 標記已讀（`lastMessageId`）|
| POST | `/read/dm/:conversationId` | JWT | 標記已讀 |
| GET | `/read/unread-counts` | JWT | 取得所有未讀數（badge 用）|

---

## WebSocket 事件（Socket.IO）

### 連線驗證

```
handshake.auth.token = <JWT>
```

連線時自動 join：
- `channel:<channelId>` — 所有已加入的頻道
- `dm:<conversationId>` — 所有 DM 對話

### Client → Server

| Event | Payload | 說明 |
|-------|---------|------|
| `channel:join` | `{ channelId }` | 加入頻道 room |
| `channel:leave` | `{ channelId }` | 離開頻道 room |
| `thread:join` | `{ parentId }` | 加入 thread room |
| `thread:leave` | `{ parentId }` | 離開 thread room |
| `message:send` | `{ channelId?, dmId?, parentId?, content, clientNonce? }` | 送出訊息 |
| `message:edit` | `{ id, content }` | 編輯訊息 |
| `message:delete` | `{ id }` | 刪除訊息（soft）|
| `reaction:add` | `{ messageId, emoji }` | 新增 reaction |
| `reaction:remove` | `{ messageId, emoji }` | 移除 reaction |
| `typing:start` | `{ channelId?, dmId? }` | 開始輸入 |
| `typing:stop` | `{ channelId?, dmId? }` | 停止輸入 |
| `read:mark` | `{ channelId?, dmId?, lastMessageId? }` | 標記已讀 |

### Server → Client

| Event | Payload | 說明 |
|-------|---------|------|
| `message:new` | `Message` | 新訊息（含 thread 廣播）|
| `message:updated` | `Message` | 訊息已編輯 |
| `message:deleted` | `{ id }` | 訊息已刪除 |
| `reaction:updated` | `{ messageId, reactions[] }` | reaction 變化 |
| `typing` | `{ userId, isTyping, channelId?, dmId? }` | 輸入狀態 |

---

## 前端架構

```
frontend/src/
├── app/
│   └── (main)/
│       └── dashboard/
│           ├── layout.tsx              # 改為 chat layout（sidebar + 主內容）
│           ├── page.tsx                # 導向 /dashboard/channels/general
│           ├── channels/
│           │   └── [channelId]/
│           │       └── page.tsx        # Channel 訊息頁
│           └── dms/
│               └── [conversationId]/
│                   └── page.tsx        # DM 訊息頁
├── components/
│   └── chat/
│       ├── message-list.tsx            # 訊息列表（虛擬捲動）
│       ├── message-item.tsx            # 單則訊息（含 reaction、thread 入口）
│       ├── message-input.tsx           # 輸入框（@mention、送出）
│       ├── thread-panel.tsx            # 右側 thread 側欄
│       ├── channel-header.tsx          # 頻道標題列
│       └── typing-indicator.tsx        # "A 正在輸入..."
└── lib/
    ├── chat-api.ts                     # Channel / DM / Message REST API
    └── socket.ts                       # Socket.IO client singleton
```

### Zustand Stores

```
stores/
  socket-store.ts     # socket 連線狀態
  messages-store.ts   # { [roomKey]: Message[] }，socket 事件寫入
  typing-store.ts     # { [roomKey]: userId[] }，typing indicator
  unread-store.ts     # { [channelId | dmId]: number }，未讀計數
```

### 即時訊息流程

```
使用者送出訊息
  → socket.emit('message:send', payload)
  → Server 存 DB → emit EventEmitter 'message.created'
  → Gateway @OnEvent 接收 → server.to(room).emit('message:new', message)
  → 前端 messages-store 收到 → append 到對應 room 的訊息列表
  → React re-render
```

---

## Phase 計畫

| Phase | 描述 | 預估 |
|-------|------|------|
| **P1（目前）** | Backend：Channel / DM / Message CRUD + Socket.IO gateway + Reactions + Read state；Frontend：Channel 頁 + DM 頁 + 即時訊息 + Thread 側欄 | 8–10 天 |
| **P2** | Mention 解析 + 未讀 badge + typing indicator + 搜尋 | 3–4 天 |
| **P3** | Bots / Webhook + Web Push 推播 | 4–5 天 |
| **P4（選做）** | 附件上傳、Redis IO adapter（水平擴展）、Slash commands | — |

---

## 技術風險

| 風險 | 緩解 |
|------|------|
| Socket.IO 連線數過多 | Phase 1 單機可支援數百連線；Phase 4 加 Redis adapter |
| 訊息順序 | `createdAt` index + cursor pagination；gateway 用 EventEmitter 確保 DB 寫入後才廣播 |
| clientNonce 重複送出 | `@@unique([senderId, clientNonce])` 由 DB 層 unique constraint 擋住 |
| typing 事件過於頻繁 | 前端 debounce 1 秒後送 typing:start；4 秒無輸入送 typing:stop |
| Thread room 洩漏 | thread:join / thread:leave 由客戶端管理；連線斷開 Socket.IO 自動清理 rooms |

---

## 與 V0 的差異摘要

1. **無 UserRef**：V0 有 `UserRef`（跨 app 同步的使用者快照），V2 直接用 `User` FK
2. **無 ChatBot（P1）**：Bot model + webhook 移到 Phase 3
3. **無 PushSubscription（P1）**：Web Push 移到 Phase 3
4. **無 Attachment（P1）**：附件上傳移到 Phase 4
5. **無 Redis**：Phase 1 單機，不需要 Redis IO adapter
6. **Permission enum 加 CHAT_* 項目**：整合進 template RBAC
