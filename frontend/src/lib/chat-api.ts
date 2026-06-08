import { apiFetch } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRef {
  id: string;
  name: string | null;
  email: string;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  isPrivate: boolean;
  createdById: string;
  lastMessageAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
}

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: UserRef;
}

export interface DirectConversation {
  id: string;
  lastMessageAt: string | null;
  createdAt: string;
  participants: { conversationId: string; userId: string; user: UserRef }[];
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Message {
  id: string;
  type: string;
  content: string;
  senderId: string;
  sender: UserRef;
  channelId: string | null;
  dmId: string | null;
  parentId: string | null;
  replyCount: number;
  clientNonce: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  reactions: Reaction[];
  _count?: { replies: number };
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export const channelsApi = {
  list: () => apiFetch<Channel[]>("/chat/channels"),
  get: (id: string) => apiFetch<Channel>(`/chat/channels/${id}`),
  create: (data: { name: string; slug?: string; description?: string; topic?: string; isPrivate?: boolean }) =>
    apiFetch<Channel>("/chat/channels", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string; topic?: string }) =>
    apiFetch<Channel>(`/chat/channels/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  archive: (id: string) =>
    apiFetch<Channel>(`/chat/channels/${id}`, { method: "DELETE" }),
  getMembers: (id: string) =>
    apiFetch<ChannelMember[]>(`/chat/channels/${id}/members`),
  addMember: (id: string, userId: string) =>
    apiFetch<ChannelMember>(`/chat/channels/${id}/members/${userId}`, { method: "POST" }),
  removeMember: (id: string, userId: string) =>
    apiFetch<void>(`/chat/channels/${id}/members/${userId}`, { method: "DELETE" }),
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messagesApi = {
  listByChannel: (channelId: string, before?: string) =>
    apiFetch<Message[]>(`/chat/channels/${channelId}/messages${before ? `?before=${before}` : ""}`),
  listByDm: (conversationId: string, before?: string) =>
    apiFetch<Message[]>(`/chat/dms/${conversationId}/messages${before ? `?before=${before}` : ""}`),
  listReplies: (messageId: string) =>
    apiFetch<Message[]>(`/chat/messages/${messageId}/replies`),
  update: (messageId: string, content: string) =>
    apiFetch<Message>(`/chat/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ content }) }),
  delete: (messageId: string) =>
    apiFetch<void>(`/chat/messages/${messageId}`, { method: "DELETE" }),
};

// ─── DMs ──────────────────────────────────────────────────────────────────────

export const dmsApi = {
  list: () => apiFetch<DirectConversation[]>("/chat/dms"),
  get: (id: string) => apiFetch<DirectConversation>(`/chat/dms/${id}`),
  getOrCreate: (userId: string) =>
    apiFetch<DirectConversation>("/chat/dms", { method: "POST", body: JSON.stringify({ userId }) }),
};

// ─── Reactions ────────────────────────────────────────────────────────────────

export const reactionsApi = {
  add: (messageId: string, emoji: string) =>
    apiFetch<Reaction[]>(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "POST" }),
  remove: (messageId: string, emoji: string) =>
    apiFetch<Reaction[]>(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: "DELETE" }),
};

// ─── Read State ───────────────────────────────────────────────────────────────

export interface UnreadCounts {
  channels: { channelId: string; count: number; mentionCount: number }[];
  dms: { conversationId: string; count: number; mentionCount: number }[];
}

export interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  sender: UserRef;
  channelId: string | null;
  dmId: string | null;
  channel: { id: string; name: string } | null;
}

export const readStateApi = {
  getAllUnreads: () => apiFetch<UnreadCounts>("/chat/read-state/unreads"),
  markChannelRead: (channelId: string, lastReadMessageId: string) =>
    apiFetch<void>(`/chat/read-state/channels/${channelId}`, {
      method: "POST",
      body: JSON.stringify({ lastReadMessageId }),
    }),
  markDmRead: (conversationId: string, lastReadMessageId: string) =>
    apiFetch<void>(`/chat/read-state/dms/${conversationId}`, {
      method: "POST",
      body: JSON.stringify({ lastReadMessageId }),
    }),
};

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: { id: string; name: string | null };
}

export interface WebhookCreated extends Webhook {
  token: string;
}

export const webhooksApi = {
  list: (channelId: string) =>
    apiFetch<Webhook[]>(`/chat/channels/${channelId}/webhooks`),
  create: (channelId: string, name: string) =>
    apiFetch<WebhookCreated>(`/chat/channels/${channelId}/webhooks`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    apiFetch<Webhook>(`/chat/webhooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/chat/webhooks/${id}`, { method: "DELETE" }),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchApi = {
  messages: (q: string) =>
    apiFetch<SearchResult[]>(`/chat/search?q=${encodeURIComponent(q)}`),
};
