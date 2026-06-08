"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chat/chat-store";
import { Hash } from "lucide-react";

export default function ChatIndexPage() {
  const router = useRouter();
  const channels = useChatStore((s) => s.channels);

  useEffect(() => {
    const first = channels.find((c) => !c.archivedAt);
    if (first) {
      router.replace(`/dashboard/chat/channels/${first.id}`);
    }
  }, [channels, router]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <Hash className="size-10 opacity-30" />
      <p className="text-sm">Select a channel to start chatting</p>
    </div>
  );
}
