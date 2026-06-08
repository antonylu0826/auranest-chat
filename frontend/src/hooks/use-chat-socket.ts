"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getToken, decodeToken } from "@/lib/auth";
import type { Message, Reaction } from "@/lib/chat-api";
import { messagesApi } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3040";

let socketSingleton: Socket | null = null;

export function getSocket(): Socket {
  if (!socketSingleton) {
    socketSingleton = io(`${API_URL}/chat`, {
      auth: { token: getToken() },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socketSingleton;
}

export function useChatSocket() {
  useEffect(() => {
    const socket = getSocket();

    const handleReady = ({ rooms }: { userId: string; rooms: string[] }) => {
      // rooms are already joined on the server; nothing more to do client-side
      void rooms;
    };

    const handleMessageNew = (message: Message) => {
      const roomKey = message.channelId ?? message.dmId ?? "";
      const currentUserId = decodeToken(getToken() ?? "")?.sub;
      const store = useChatStore.getState();

      if (!message.parentId) {
        store.appendMessage(roomKey, message);

        if (message.channelId) {
          const ch = useChatStore.getState().channels.find((c) => c.id === message.channelId);
          if (ch) useChatStore.getState().upsertChannel({ ...ch, lastMessageAt: message.createdAt });
        }

        // Increment unread badge when message arrives in a non-active room from another user
        if (message.senderId !== currentUserId) {
          const s = useChatStore.getState();
          const isActive =
            message.channelId === s.activeChannelId ||
            (message.dmId != null && message.dmId === s.activeDmId);
          if (!isActive) {
            useChatStore.getState().incrementUnread(message.channelId, message.dmId);
          }
        }
      } else {
        useChatStore.getState().appendThreadMessage(message);
        useChatStore.getState().incrementReplyCount(roomKey, message.parentId);
      }
    };

    const handleMessageUpdated = (updated: Message) => {
      const roomKey = updated.channelId ?? updated.dmId ?? "";
      useChatStore.getState().updateMessage(roomKey, updated);
      useChatStore.getState().updateThreadMessage(updated);
    };

    const handleMessageDeleted = ({ id, channelId, dmId }: { id: string; channelId?: string; dmId?: string }) => {
      const roomKey = channelId ?? dmId ?? "";
      useChatStore.getState().markDeleted(roomKey, id);
    };

    const handleReactionUpdated = ({ messageId, reactions, channelId, dmId }: { messageId: string; reactions: Reaction[]; channelId?: string; dmId?: string }) => {
      const roomKey = channelId ?? dmId ?? "";
      useChatStore.getState().updateReactions(roomKey, messageId, reactions);
    };

    const handleTyping = ({
      userId,
      name,
      channelId,
      dmId,
      typing,
    }: {
      userId: string;
      name?: string;
      channelId?: string;
      dmId?: string;
      typing: boolean;
    }) => {
      // Multi-device dedup: ignore typing events from our own user ID
      const currentUserId = decodeToken(getToken() ?? "")?.sub;
      if (userId === currentUserId) return;

      const roomKey = channelId ? `channel:${channelId}` : `dm:${dmId}`;
      useChatStore.getState().setTyping(roomKey, { userId, name }, typing);
    };

    const handleReconnect = async () => {
      // Gap-fetch: reload messages for active room to pick up missed messages
      const s = useChatStore.getState();
      try {
        if (s.activeChannelId) {
          const msgs = await messagesApi.listByChannel(s.activeChannelId);
          useChatStore.getState().setMessages(s.activeChannelId, [...msgs].reverse());
        } else if (s.activeDmId) {
          const msgs = await messagesApi.listByDm(s.activeDmId);
          useChatStore.getState().setMessages(s.activeDmId, [...msgs].reverse());
        }
      } catch {
        // silently ignore — user can manually refresh
      }
    };

    socket.on("ready", handleReady);
    socket.on("message:new", handleMessageNew);
    socket.on("message:updated", handleMessageUpdated);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("reaction:updated", handleReactionUpdated);
    socket.on("typing", handleTyping);
    socket.on("reconnect", handleReconnect);

    return () => {
      socket.off("ready", handleReady);
      socket.off("message:new", handleMessageNew);
      socket.off("message:updated", handleMessageUpdated);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("reaction:updated", handleReactionUpdated);
      socket.off("typing", handleTyping);
      socket.off("reconnect", handleReconnect);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
