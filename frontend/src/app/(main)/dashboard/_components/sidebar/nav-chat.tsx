"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, MessageSquare, Plus, Search } from "lucide-react";
import { useChatStore } from "@/stores/chat/chat-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NewChannelDialog } from "@/app/(main)/dashboard/chat/_components/new-channel-dialog";
import { NewDmDialog } from "@/app/(main)/dashboard/chat/_components/new-dm-dialog";
import { SearchDialog } from "@/app/(main)/dashboard/chat/_components/search-dialog";

export function NavChat() {
  const pathname = usePathname();
  const { channels, dms, unreadChannels, unreadDms, mentionChannels, mentionDms } = useChatStore();
  const currentUser = useCurrentUser();

  const otherParticipant = (participants: { userId: string; user: { name: string | null; email: string } }[]) =>
    participants.find((p) => p.userId !== currentUser?.sub)?.user;

  const activeChannels = channels.filter((c) => !c.archivedAt);

  return (
    <>
      {/* Search */}
      <SidebarGroup className="py-1">
        <SearchDialog
          trigger={
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
              <Search className="size-4 shrink-0" />
              <span>Search messages…</span>
            </button>
          }
        />
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Channels</SidebarGroupLabel>
        <NewChannelDialog
          trigger={
            <SidebarGroupAction title="New channel">
              <Plus />
            </SidebarGroupAction>
          }
        />
        <SidebarMenu>
          {activeChannels.map((channel) => {
            const unread = unreadChannels[channel.id] ?? 0;
            const hasMention = (mentionChannels[channel.id] ?? 0) > 0;
            const isActive = pathname === `/dashboard/chat/channels/${channel.id}`;
            return (
              <SidebarMenuItem key={channel.id}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={`#${channel.name}`}>
                  <Link prefetch={false} href={`/dashboard/chat/channels/${channel.id}`}>
                    <Hash />
                    <span>{channel.name}</span>
                  </Link>
                </SidebarMenuButton>
                {unread > 0 && (
                  <SidebarMenuBadge
                    className={cn(hasMention && "bg-destructive text-destructive-foreground")}
                  >
                    {hasMention ? "@" : (unread > 99 ? "99+" : unread)}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
        <NewDmDialog
          trigger={
            <SidebarGroupAction title="New message">
              <Plus />
            </SidebarGroupAction>
          }
        />
        <SidebarMenu>
          {dms.map((dm) => {
            const other = otherParticipant(dm.participants);
            const unread = unreadDms[dm.id] ?? 0;
            const hasMention = (mentionDms[dm.id] ?? 0) > 0;
            const isActive = pathname === `/dashboard/chat/dms/${dm.id}`;
            return (
              <SidebarMenuItem key={dm.id}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={other?.name ?? other?.email ?? "DM"}>
                  <Link prefetch={false} href={`/dashboard/chat/dms/${dm.id}`}>
                    <MessageSquare />
                    <span>{other?.name ?? other?.email ?? "Unknown"}</span>
                  </Link>
                </SidebarMenuButton>
                {unread > 0 && (
                  <SidebarMenuBadge
                    className={cn(hasMention && "bg-destructive text-destructive-foreground")}
                  >
                    {hasMention ? "@" : (unread > 99 ? "99+" : unread)}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}
