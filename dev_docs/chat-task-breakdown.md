# AuraNest Chat — Task Breakdown

> 參考文件：`dev_docs/chat-system-plan.md`
> 架構：V2 standalone（NestJS 11 + Prisma 6 + Next.js 16，Socket.IO）
> Ports：Backend 3040 / Frontend 3041
> 複雜度：S = 半天內、M = 1–2 天、L = 3 天以上

---

## 已確認的設計決策

| # | 決議 |
|---|------|
| D1 | Slack-like：Channel → Message → Thread 三層，+ DM |
| D2 | 即時推送：Socket.IO WebSocket gateway，不 polling |
| D3 | 無 UserRef：直接 FK 到本地 User table |
| D4 | Channel 角色：OWNER / MEMBER；私有頻道成員才可見 |
| D5 | DM：participantsHash 保證唯一性（sorted userId + SHA-256）|
| D6 | Message soft delete：content 清空，deletedAt 標記 |
| D7 | clientNonce：DB unique constraint 防重複送出 |
| D8 | 未讀計數：ChannelRead / DmRead 追蹤 lastReadMessageId |
| D9 | Bot / Push / Attachment → Phase 2/3/4，P1 不做 |
| D10 | Redis IO adapter → Phase 4，P1 單機 |

---

## Phase 1 — 核心 Chat（預估 8–10 天）

> **目標**：Channel + DM CRUD、即時訊息（Socket.IO）、Thread、Reactions、Read State。

---

### 1.1 Backend — Schema 與 Permission

#### T1.1.1 Prisma schema — 新增 Chat models
- **複雜度**：M
- 停掉 dev server 再操作（避免 Windows DLL 鎖定）
- `backend/prisma/schema.prisma`：
  - 在 `Permission` enum 加：`CHAT_CHANNEL_READ`、`CHAT_CHANNEL_CREATE`、`CHAT_CHANNEL_DELETE`、`CHAT_MESSAGE_DELETE`
  - `User` model 加反向關係（ChannelCreator、ChannelMemberships、DmParticipations、MessageSender、MessageReactions）
  - 新增 models：`Channel`、`ChannelMember`、`DirectConversation`、`DmParticipant`、`Message`、`MessageRevision`、`Mention`、`ChannelRead`、`DmRead`、`Reaction`
- 執行 migrate：`npx dotenv -e ../.env -- npx prisma migrate dev --name add_chat`
- 執行 generate：`npx prisma generate`
- **DoD**：migrate 無錯誤；`pnpm -C backend tsc --noEmit` 通過

#### T1.1.2 seed.ts 更新
- **複雜度**：S
- 在 seed.ts 建立預設 `#general` 和 `#random` 頻道（createdById = admin user）
- **DoD**：`pnpm -C backend prisma:seed` 後 DB 有兩個 channel

---

### 1.2 Backend — Socket.IO Gateway

#### T1.2.1 安裝 Socket.IO 相關套件
- **複雜度**：S
- `pnpm -C backend add @nestjs/websockets @nestjs/platform-socket.io socket.io @nestjs/event-emitter`
- `backend/src/main.ts` 不需額外設定（`@WebSocketGateway` 自動掛）
- **DoD**：`pnpm -C backend tsc --noEmit` 通過

#### T1.2.2 ChatGateway
- **複雜度**：L
- `backend/src/gateway/chat.gateway.ts`
- 連線驗證：從 `handshake.auth.token` 或 `Authorization` header 取 JWT，用 `JwtService.verify()` 驗
- 連線後 auto-join：查 `ChannelMember` + `DmParticipant` → join 對應 rooms
- 實作事件：
  - `channel:join` / `channel:leave`
  - `thread:join` / `thread:leave`
  - `message:send` / `message:edit` / `message:delete`
  - `reaction:add` / `reaction:remove`
  - `typing:start` / `typing:stop`
  - `read:mark`
- `@OnEvent('message.created')` → `server.to(room).emit('message:new', message)`
- `@OnEvent('message.updated')` → `server.to(room).emit('message:updated', message)`
- `@OnEvent('message.deleted')` → `server.to(room).emit('message:deleted', { id })`
- `backend/src/gateway/gateway.module.ts`
- **DoD**：wscat / Postman WebSocket 可連線；send message 後收到 `message:new` 廣播

---

### 1.3 Backend — Channels Module

#### T1.3.1 ChannelsService + ChannelsController
- **複雜度**：M
- `backend/src/channels/`：`channels.module.ts`、`channels.service.ts`、`channels.controller.ts`、`dto/channel.dto.ts`
- DTO（Zod）：`CreateChannelDto: { name, slug, description?, topic?, isPrivate? }`、`UpdateChannelDto`
- Service：
  - `list(userId)` — 公開 + 已加入的私有頻道，按 lastMessageAt desc
  - `findOne(id, userId)` — 含私有頻道 access check
  - `create(dto, userId)` — 建立 + 自動加 creator 為 OWNER
  - `update(id, dto, userId)` — 驗 OWNER
  - `archive(id, userId)` — soft archive（archivedAt）
- Controller：`@RequirePermissions(Permission.CHAT_CHANNEL_READ/CREATE/DELETE)`
- **DoD**：`GET /api/channels`、`POST /api/channels`、`GET /api/channels/:id` 可用

#### T1.3.2 ChannelMembers（附屬在 ChannelsModule）
- **複雜度**：S
- `backend/src/channels/channel-members.service.ts`
- `GET /channels/:id/members`、`POST /channels/:id/members`、`DELETE /channels/:id/members/:userId`
- **DoD**：可加入、移除成員

---

### 1.4 Backend — Messages Module

#### T1.4.1 MessagesService
- **複雜度**：M
- `backend/src/messages/messages.service.ts`
- Methods：
  - `send(dto, senderId)` — channel XOR dm 驗證，存 DB，更新 lastMessageAt，emit EventEmitter
  - `list(dto, userId)` — cursor pagination（before + limit=50），支援 channelId / dmId / parentId（thread）
  - `edit(id, dto, userId)` — 存 revision，更新 content，emit updated
  - `softDelete(id, userId, isAdmin?)` — 清 content，設 deletedAt，emit deleted
- **DoD**：`pnpm -C backend tsc --noEmit` 通過

#### T1.4.2 MessagesController
- **複雜度**：S
- `GET /channels/:id/messages?before=&limit=`
- `GET /dms/:id/messages?before=&limit=`
- `GET /messages/:id/thread`
- **DoD**：REST 讀取訊息可用

---

### 1.5 Backend — DMs Module

#### T1.5.1 DmsService + DmsController
- **複雜度**：M
- `backend/src/dms/`：`dms.module.ts`、`dms.service.ts`、`dms.controller.ts`
- Service：
  - `list(userId)` — 列出我的所有 DM，按 lastMessageAt desc
  - `findOrCreate(userId, targetUserId)` — 用 participantsHash 找既有對話，無則建立
  - `findOne(id, userId)` — 含 participant access check
- `participantsHash`：`crypto.createHash('sha256').update([id1,id2].sort().join(':')).digest('hex')`
- **DoD**：`POST /api/dms { targetUserId }` 可建立或回傳既有對話

---

### 1.6 Backend — Reactions Module

#### T1.6.1 ReactionsService + ReactionsController
- **複雜度**：S
- `backend/src/reactions/`
- `add(messageId, emoji, userId)` — upsert（DB constraint 防重複）
- `remove(messageId, emoji, userId)`
- 回傳：`{ messageId, reactions: [{ emoji, count, users: userId[] }] }`
- Gateway 收到後 emit `reaction:updated`
- **DoD**：reaction add / remove 後即時廣播

---

### 1.7 Backend — Read State Module

#### T1.7.1 ReadStateService + ReadStateController
- **複雜度**：S
- `backend/src/read-state/`
- `markChannelRead(channelId, userId, lastMessageId?)`
- `markDmRead(conversationId, userId, lastMessageId?)`
- `getUnreadCounts(userId)` — 查各 channel 與 DM 未讀數（message 數 > lastReadMessageId）
- `POST /api/read/channel/:channelId`
- `POST /api/read/dm/:conversationId`
- `GET /api/read/unread-counts`
- **DoD**：標記已讀後 unread count 歸零

---

### 1.8 Frontend — Socket Client

#### T1.8.1 Socket.IO client + store
- **複雜度**：M
- `pnpm -C frontend add socket.io-client`
- `frontend/src/lib/socket.ts` — singleton socket，`createSocketClient(token)`
- `frontend/src/stores/socket-store.ts`（Zustand）— 連線狀態、connect / disconnect
- `frontend/src/stores/messages-store.ts`（Zustand）
  - `{ [roomKey]: Message[] }`
  - `appendMessage(roomKey, message)`
  - `updateMessage(roomKey, message)`
  - `deleteMessage(roomKey, id)`
- `frontend/src/stores/typing-store.ts` — `{ [roomKey]: string[] }`
- `frontend/src/providers/socket-provider.tsx` — 登入後建立 socket，logout 後斷線
- **DoD**：登入後 socket 連線；開 DevTools 可看 socket events

---

### 1.9 Frontend — Chat API

#### T1.9.1 chat-api.ts
- **複雜度**：S
- `frontend/src/lib/chat-api.ts`
- `channelsApi.list / get / create / update / archive`
- `channelMembersApi.list / add / remove`
- `dmsApi.list / findOrCreate / get`
- `messagesApi.listChannel / listDm / listThread`
- `readApi.markChannel / markDm / getUnreadCounts`

---

### 1.10 Frontend — Layout 調整

#### T1.10.1 Dashboard layout 改為 Chat layout
- **複雜度**：M
- `frontend/src/app/(main)/dashboard/layout.tsx` 調整為三欄：
  - 左側窄欄：nav（首頁、頻道列表、DM 列表）
  - 主內容區：訊息頁
- `frontend/src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx` 加：
  - Channel 列表（含未讀 badge）
  - DM 列表（含未讀 badge）
  - + 新增頻道按鈕
- 更新 `sidebar-items.ts` 和 i18n

---

### 1.11 Frontend — Channel 頁面

#### T1.11.1 Channel 訊息頁
- **複雜度**：L
- `frontend/src/app/(main)/dashboard/channels/[channelId]/page.tsx`
- 元件：
  - `channel-header.tsx` — 頻道名稱、topic、成員數
  - `message-list.tsx` — 從 REST 載入歷史訊息，socket 即時 append；scroll-to-bottom
  - `message-item.tsx` — 顯示訊息（內容、sender、時間、reactions、thread 回覆數）
  - `message-input.tsx` — textarea + Enter 送出；Shift+Enter 換行；typing events
  - `typing-indicator.tsx` — "X 正在輸入..."
- **DoD**：可在頻道發送訊息、即時收到他人訊息

#### T1.11.2 Thread 側欄
- **複雜度**：M
- `frontend/src/components/chat/thread-panel.tsx`
- 點擊訊息的「回覆 N」→ 右側滑出 sheet
- 顯示原始訊息 + 所有回覆 + 輸入框
- socket join `thread:<parentId>` → 收 `message:new` append
- **DoD**：可在 thread 回覆並即時更新

---

### 1.12 Frontend — DM 頁面

#### T1.12.1 DM 訊息頁
- **複雜度**：M
- `frontend/src/app/(main)/dashboard/dms/[conversationId]/page.tsx`
- 複用 message-list、message-item、message-input
- 側欄顯示對方名稱、avatar
- **DoD**：可 1 對 1 即時通訊

---

### 1.13 TypeScript 驗證

```bash
pnpm -C backend tsc --noEmit
pnpm -C frontend tsc --noEmit
```

---

### 1.14 瀏覽器驗證（Golden Path）

用 `/run` 讓 Claude 驗證：

- 登入 → 看到 #general 頻道 → 發訊息 → 即時收到
- 建立私有頻道 → 加入成員 → 發訊息
- 開啟 DM → 發訊息
- 對訊息加 reaction → 即時更新
- 回覆 thread → Thread 側欄顯示
- 已讀標記 → 未讀 badge 消失

---

## Phase 2 — 通知與搜尋（預估 3–4 天）

- Mention 解析（@user → 通知）
- 未讀 badge（sidebar）
- Typing indicator 完整實作
- 訊息搜尋（`GET /search?q=`）

## Phase 3 — Bots 與 Push（預估 4–5 天）

- ChatBot model + webhook
- Web Push 推播（PWA）
- Slash commands

## Phase 4（選做）

- 附件上傳（multer）
- Redis IO adapter（水平擴展）
- 訊息 pin / star
