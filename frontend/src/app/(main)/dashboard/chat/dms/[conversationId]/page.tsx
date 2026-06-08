"use client";

import { use, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { useChatStore } from "@/stores/chat/chat-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MessageList } from "../../_components/message-list";
import { MessageInput } from "../../_components/message-input";
import { ThreadPanel } from "../../_components/thread-panel";

export default function DmPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  const { dms, activeThreadMessageId, setActiveDm, openThread } = useChatStore();
  const currentUser = useCurrentUser();

  const dm = dms.find((d) => d.id === conversationId);
  const other = dm?.participants.find((p) => p.userId !== currentUser?.sub);

  useEffect(() => {
    setActiveDm(conversationId);
  }, [conversationId, setActiveDm]);

  return (
    <div data-content-padding="false" className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex h-12 items-center gap-2 px-4 border-b shrink-0">
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {other?.user.name ?? other?.user.email ?? "Direct Message"}
          </span>
        </div>

        <MessageList
          roomKey={conversationId}
          dmId={conversationId}
          onOpenThread={openThread}
        />

        <MessageInput
          dmId={conversationId}
          placeholder={`Message ${other?.user.name ?? "someone"}`}
        />
      </div>

      {activeThreadMessageId && (
        <ThreadPanel
          messageId={activeThreadMessageId}
          dmId={conversationId}
        />
      )}
    </div>
  );
}
