"use client";

import { create } from "zustand";
import type { Channel, DirectConversation, Message, Reaction } from "@/lib/chat-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TypingUser {
  userId: string;
  name?: string;
}

interface ChatState {
  // Sidebar data
  channels: Channel[];
  dms: DirectConversation[];
  unreadChannels: Record<string, number>; // channelId → count
  unreadDms: Record<string, number>;       // conversationId → count
  mentionChannels: Record<string, number>; // channelId → mention count
  mentionDms: Record<string, number>;      // conversationId → mention count

  // Active view
  activeChannelId: string | null;
  activeDmId: string | null;
  activeThreadMessageId: string | null;

  // Messages (keyed by channelId or dmId)
  messages: Record<string, Message[]>;
  threadMessages: Message[];

  // Typing indicators
  typingUsers: Record<string, TypingUser[]>; // roomKey → users

  // Actions
  setChannels: (channels: Channel[]) => void;
  upsertChannel: (channel: Channel) => void;
  setDms: (dms: DirectConversation[]) => void;
  upsertDm: (dm: DirectConversation) => void;
  setUnreadCounts: (channels: { channelId: string; count: number; mentionCount: number }[], dms: { conversationId: string; count: number; mentionCount: number }[]) => void;
  incrementUnread: (channelId?: string | null, dmId?: string | null) => void;
  decrementUnread: (channelId?: string, dmId?: string) => void;

  setActiveChannel: (channelId: string | null) => void;
  setActiveDm: (dmId: string | null) => void;
  openThread: (messageId: string) => void;
  closeThread: () => void;

  // Messages
  setMessages: (roomKey: string, messages: Message[]) => void;
  prependMessages: (roomKey: string, messages: Message[]) => void;
  appendMessage: (roomKey: string, message: Message) => void;
  replaceOptimistic: (roomKey: string, clientNonce: string, confirmed: Message) => void;
  updateMessage: (roomKey: string, updated: Message) => void;
  markDeleted: (roomKey: string, messageId: string) => void;
  updateReactions: (roomKey: string, messageId: string, reactions: Reaction[]) => void;
  incrementReplyCount: (roomKey: string, parentId: string) => void;

  // Thread messages
  setThreadMessages: (messages: Message[]) => void;
  appendThreadMessage: (message: Message) => void;
  updateThreadMessage: (updated: Message) => void;

  // Typing
  setTyping: (roomKey: string, user: TypingUser, typing: boolean) => void;
  clearTyping: (roomKey: string) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  channels: [],
  dms: [],
  unreadChannels: {},
  unreadDms: {},
  mentionChannels: {},
  mentionDms: {},
  activeChannelId: null,
  activeDmId: null,
  activeThreadMessageId: null,
  messages: {},
  threadMessages: [],
  typingUsers: {},

  setChannels: (channels) => set({ channels }),
  upsertChannel: (channel) =>
    set((s) => ({
      channels: s.channels.some((c) => c.id === channel.id)
        ? s.channels.map((c) => (c.id === channel.id ? channel : c))
        : [...s.channels, channel],
    })),

  setDms: (dms) => set({ dms }),
  upsertDm: (dm) =>
    set((s) => ({
      dms: s.dms.some((d) => d.id === dm.id)
        ? s.dms.map((d) => (d.id === dm.id ? dm : d))
        : [...s.dms, dm],
    })),

  setUnreadCounts: (channels, dms) =>
    set({
      unreadChannels: Object.fromEntries(channels.map((c) => [c.channelId, c.count])),
      unreadDms: Object.fromEntries(dms.map((d) => [d.conversationId, d.count])),
      mentionChannels: Object.fromEntries(channels.map((c) => [c.channelId, c.mentionCount])),
      mentionDms: Object.fromEntries(dms.map((d) => [d.conversationId, d.mentionCount])),
    }),

  incrementUnread: (channelId, dmId) =>
    set((s) => {
      if (channelId) {
        return { unreadChannels: { ...s.unreadChannels, [channelId]: (s.unreadChannels[channelId] ?? 0) + 1 } };
      }
      if (dmId) {
        return { unreadDms: { ...s.unreadDms, [dmId]: (s.unreadDms[dmId] ?? 0) + 1 } };
      }
      return {};
    }),

  decrementUnread: (channelId, dmId) =>
    set((s) => {
      if (channelId) {
        return {
          unreadChannels: { ...s.unreadChannels, [channelId]: 0 },
          mentionChannels: { ...s.mentionChannels, [channelId]: 0 },
        };
      }
      if (dmId) {
        return {
          unreadDms: { ...s.unreadDms, [dmId]: 0 },
          mentionDms: { ...s.mentionDms, [dmId]: 0 },
        };
      }
      return {};
    }),

  setActiveChannel: (channelId) =>
    set({ activeChannelId: channelId, activeDmId: null, activeThreadMessageId: null }),
  setActiveDm: (dmId) =>
    set({ activeDmId: dmId, activeChannelId: null, activeThreadMessageId: null }),
  openThread: (messageId) => set({ activeThreadMessageId: messageId }),
  closeThread: () => set({ activeThreadMessageId: null }),

  setMessages: (roomKey, messages) =>
    set((s) => ({ messages: { ...s.messages, [roomKey]: messages } })),
  prependMessages: (roomKey, messages) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomKey]: [...messages, ...(s.messages[roomKey] ?? [])],
      },
    })),
  appendMessage: (roomKey, message) =>
    set((s) => {
      const existing = s.messages[roomKey] ?? [];
      if (existing.some((m) => m.id === message.id)) return {};
      return {
        messages: {
          ...s.messages,
          [roomKey]: [...existing, message],
        },
      };
    }),
  replaceOptimistic: (roomKey, clientNonce, confirmed) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomKey]: (s.messages[roomKey] ?? []).map((m) =>
          m.clientNonce === clientNonce ? confirmed : m,
        ),
      },
    })),
  updateMessage: (roomKey, updated) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomKey]: (s.messages[roomKey] ?? []).map((m) =>
          m.id === updated.id ? updated : m,
        ),
      },
    })),
  markDeleted: (roomKey, messageId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomKey]: (s.messages[roomKey] ?? []).filter((m) => m.id !== messageId),
      },
    })),
  updateReactions: (roomKey, messageId, reactions) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomKey]: (s.messages[roomKey] ?? []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m,
        ),
      },
    })),
  incrementReplyCount: (roomKey, parentId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomKey]: (s.messages[roomKey] ?? []).map((m) =>
          m.id === parentId ? { ...m, replyCount: (m.replyCount ?? 0) + 1 } : m,
        ),
      },
    })),

  setThreadMessages: (messages) => set({ threadMessages: messages }),
  appendThreadMessage: (message) =>
    set((s) => ({ threadMessages: [...s.threadMessages, message] })),
  updateThreadMessage: (updated) =>
    set((s) => ({
      threadMessages: s.threadMessages.map((m) => (m.id === updated.id ? updated : m)),
    })),

  setTyping: (roomKey, user, typing) =>
    set((s) => {
      const current = s.typingUsers[roomKey] ?? [];
      const filtered = current.filter((u) => u.userId !== user.userId);
      return {
        typingUsers: {
          ...s.typingUsers,
          [roomKey]: typing ? [...filtered, user] : filtered,
        },
      };
    }),
  clearTyping: (roomKey) =>
    set((s) => ({ typingUsers: { ...s.typingUsers, [roomKey]: [] } })),
}));
