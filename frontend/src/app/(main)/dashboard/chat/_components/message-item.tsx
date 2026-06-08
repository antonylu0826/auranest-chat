"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil, Trash2, MessageSquare, SmilePlus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useChatActions } from "@/hooks/use-chat-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MessageContent } from "./message-content";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface MessageItemProps {
  message: Message;
  roomKey: string;
  isThreadView?: boolean;
  onOpenThread?: (messageId: string) => void;
}

export function MessageItem({ message, roomKey, isThreadView, onOpenThread }: MessageItemProps) {
  const currentUser = useCurrentUser();
  const { editMessage, deleteMessage, addReaction, removeReaction } = useChatActions();
  const { updateMessage } = useChatStore();

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwn = currentUser?.sub === message.senderId;
  const isDeleted = !!message.deletedAt;

  const handleEditSave = () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    editMessage(message.id, trimmed);
    setEditing(false);
  };

  const handleReaction = (emoji: string) => {
    const existing = message.reactions?.find((r) => r.emoji === emoji);
    const alreadyReacted = existing?.userIds?.includes(currentUser?.sub ?? "");
    if (alreadyReacted) {
      removeReaction(message.id, emoji);
    } else {
      addReaction(message.id, emoji);
    }
  };

  return (
    <div className={cn("group flex gap-3 px-4 py-1 hover:bg-muted/40 transition-colors", isDeleted && "opacity-50")}>
      {/* Avatar */}
      <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-medium text-primary text-sm mt-0.5">
        {(message.sender?.name ?? message.sender?.email ?? "?")[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Author + timestamp */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {message.sender?.name ?? message.sender?.email ?? "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.createdAt), "HH:mm")}
          </span>
          {message.editedAt && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>

        {/* Content */}
        {isDeleted ? (
          <p className="text-sm text-muted-foreground italic">This message was deleted.</p>
        ) : editing ? (
          <div className="mt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="text-sm min-h-10 max-h-40 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleEditSave}>
                <Check className="size-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>
                <X className="size-3" />
              </Button>
            </div>
          </div>
        ) : (
          <MessageContent content={message.content} />
        )}

        {/* Reactions */}
        {!isDeleted && message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((r) => {
              const reacted = r.userIds?.includes(currentUser?.sub ?? "") ?? false;
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleReaction(r.emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                    reacted
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted",
                  )}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread reply count (only in main view) */}
        {!isThreadView && !isDeleted && (message.replyCount ?? 0) > 0 && (
          <button
            onClick={() => onOpenThread?.(message.id)}
            className="mt-1 text-xs text-primary hover:underline"
          >
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Action toolbar (on hover) */}
      {!isDeleted && !editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <SmilePlus className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="end">
              <div className="flex gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="text-lg hover:bg-muted rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Thread button (only in main view) */}
          {!isThreadView && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onOpenThread?.(message.id)}
            >
              <MessageSquare className="size-3.5" />
            </Button>
          )}

          {/* Edit / Delete (own messages only) */}
          {isOwn && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { setEditContent(message.content); setEditing(true); }}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => deleteMessage(message.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
