"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/lib/chat-api";
import { messagesApi } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";
import { MessageItem } from "./message-item";
import { MessageInput } from "./message-input";

interface ThreadPanelProps {
  messageId: string;
  channelId?: string;
  dmId?: string;
}

export function ThreadPanel({ messageId, channelId, dmId }: ThreadPanelProps) {
  const { closeThread, threadMessages, setThreadMessages, messages } = useChatStore();
  const [loading, setLoading] = useState(false);

  const roomKey = channelId ?? dmId ?? "";
  const parentMessage = (messages[roomKey] ?? []).find((m: Message) => m.id === messageId);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const replies = await messagesApi.listReplies(messageId);
        setThreadMessages(replies);
      } finally {
        setLoading(false);
      }
    })();
  }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="flex flex-col w-80 shrink-0 border-l bg-background">
      <div className="flex h-12 items-center justify-between px-4 border-b">
        <span className="text-sm font-semibold">Thread</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={closeThread}>
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {parentMessage && (
            <div className="border-b pb-2 mb-2">
              <MessageItem
                message={parentMessage}
                roomKey={roomKey}
                isThreadView
              />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            threadMessages.map((msg: Message) => (
              <MessageItem key={msg.id} message={msg} roomKey={roomKey} isThreadView />
            ))
          )}
        </div>
      </ScrollArea>

      <MessageInput
        channelId={channelId}
        dmId={dmId}
        parentId={messageId}
        placeholder="Reply in thread…"
      />
    </aside>
  );
}
