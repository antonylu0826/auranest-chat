"use client";

import { useEffect } from "react";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { channelsApi, dmsApi, readStateApi } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  useChatSocket();

  const { setChannels, setDms, setUnreadCounts } = useChatStore();

  useEffect(() => {
    void (async () => {
      try {
        const [channels, dms, unreads] = await Promise.all([
          channelsApi.list(),
          dmsApi.list(),
          readStateApi.getAllUnreads(),
        ]);
        setChannels(channels);
        setDms(dms);
        setUnreadCounts(unreads.channels, unreads.dms);
      } catch {
        // silently ignore — sidebar will show empty state
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
