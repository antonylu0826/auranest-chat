"use client";

import { use, useEffect } from "react";
import { Hash, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat/chat-store";
import { MessageList } from "../../_components/message-list";
import { MessageInput } from "../../_components/message-input";
import { ThreadPanel } from "../../_components/thread-panel";
import { ChannelWebhooksDialog } from "../../_components/channel-webhooks-dialog";

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params);
  const { channels, activeThreadMessageId, setActiveChannel, openThread } = useChatStore();

  const channel = channels.find((c) => c.id === channelId);

  useEffect(() => {
    setActiveChannel(channelId);
  }, [channelId, setActiveChannel]);

  return (
    <div data-content-padding="false" className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex h-12 items-center gap-2 px-4 border-b shrink-0">
          <Hash className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{channel?.name ?? channelId}</span>
          {channel?.topic && (
            <span className="text-xs text-muted-foreground border-l ml-2 pl-2 truncate">
              {channel.topic}
            </span>
          )}
          <div className="ml-auto flex items-center">
            <ChannelWebhooksDialog
              channelId={channelId}
              trigger={
                <Button variant="ghost" size="icon" className="size-7">
                  <Webhook className="size-4 text-muted-foreground" />
                  <span className="sr-only">Webhooks</span>
                </Button>
              }
            />
          </div>
        </div>

        <MessageList
          roomKey={channelId}
          channelId={channelId}
          onOpenThread={openThread}
        />

        <MessageInput
          channelId={channelId}
          placeholder={`Message #${channel?.name ?? "channel"}`}
        />
      </div>

      {activeThreadMessageId && (
        <ThreadPanel
          messageId={activeThreadMessageId}
          channelId={channelId}
        />
      )}
    </div>
  );
}
