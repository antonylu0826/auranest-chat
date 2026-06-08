"use client";

import { getSocket } from "./use-chat-socket";

export function useChatActions() {
  const sendMessage = (payload: {
    content: string;
    channelId?: string;
    dmId?: string;
    parentId?: string;
    clientNonce?: string;
  }) => {
    getSocket().emit("message:send", payload);
  };

  const editMessage = (messageId: string, content: string) => {
    getSocket().emit("message:edit", { messageId, content });
  };

  const deleteMessage = (messageId: string) => {
    getSocket().emit("message:delete", messageId);
  };

  const addReaction = (messageId: string, emoji: string) => {
    getSocket().emit("reaction:add", { messageId, emoji });
  };

  const removeReaction = (messageId: string, emoji: string) => {
    getSocket().emit("reaction:remove", { messageId, emoji });
  };

  const sendTypingStart = (channelId?: string, dmId?: string) => {
    getSocket().emit("typing:start", { channelId, dmId });
  };

  const sendTypingStop = (channelId?: string, dmId?: string) => {
    getSocket().emit("typing:stop", { channelId, dmId });
  };

  const markRead = (lastReadMessageId: string, channelId?: string, dmId?: string) => {
    getSocket().emit("read:mark", { channelId, dmId, lastReadMessageId });
  };

  const joinChannel = (channelId: string) => {
    getSocket().emit("channel:join", channelId);
  };

  const joinDm = (conversationId: string) => {
    getSocket().emit("dm:join", conversationId);
  };

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    sendTypingStart,
    sendTypingStop,
    markRead,
    joinChannel,
    joinDm,
  };
}
