"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { messagesApi } from "@/lib/chat-api";
import { useChatActions } from "@/hooks/use-chat-actions";
import { useChatStore } from "@/stores/chat/chat-store";
import { MessageItem } from "./message-item";

interface MessageListProps {
  roomKey: string;
  channelId?: string;
  dmId?: string;
  onOpenThread: (messageId: string) => void;
}

export function MessageList({ roomKey, channelId, dmId, onOpenThread }: MessageListProps) {
  const { messages, setMessages, prependMessages, typingUsers, decrementUnread } = useChatStore();
  const { markRead } = useChatActions();
  const roomMessages = messages[roomKey] ?? [];

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const doMarkRead = (msgs: typeof roomMessages) => {
    const last = msgs[msgs.length - 1];
    if (!last) return;
    markRead(last.id, channelId, dmId);
    decrementUnread(channelId, dmId);
  };

  // Initial load
  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const msgs = channelId
          ? await messagesApi.listByChannel(channelId)
          : await messagesApi.listByDm(dmId!);
        const ordered = [...msgs].reverse();
        setMessages(roomKey, ordered);
        setHasMore(msgs.length >= 50);
        doMarkRead(ordered);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark read when new messages arrive and user is at the bottom
  useEffect(() => {
    if (isAtBottomRef.current && roomMessages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      doMarkRead(roomMessages);
    }
  }, [roomMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    // Load more when scrolled near top
    if (el.scrollTop < 80 && hasMore && !loadingMore && roomMessages.length > 0) {
      void loadMore();
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const oldest = roomMessages[0];
    if (!oldest) return;

    setLoadingMore(true);
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    try {
      const older = channelId
        ? await messagesApi.listByChannel(channelId, oldest.id)
        : await messagesApi.listByDm(dmId!, oldest.id);
      prependMessages(roomKey, [...older].reverse());
      setHasMore(older.length >= 50);

      // Preserve scroll position after prepend
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const typing = typingUsers[channelId ? `channel:${channelId}` : `dm:${dmId}`] ?? [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      {loadingMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {roomMessages.length === 0 && (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No messages yet. Say hello!
        </div>
      )}

      {roomMessages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          roomKey={roomKey}
          onOpenThread={onOpenThread}
        />
      ))}

      {typing.length > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground">
          {typing.map((u) => u.name ?? u.userId).join(", ")}{" "}
          {typing.length === 1 ? "is" : "are"} typing…
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
