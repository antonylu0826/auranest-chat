"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatActions } from "@/hooks/use-chat-actions";
import { channelsApi } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  channelId?: string;
  dmId?: string;
  parentId?: string;
  placeholder?: string;
}

interface MentionUser {
  id: string;
  name: string | null;
  email: string;
}

const SPECIAL_MENTIONS: MentionUser[] = [
  { id: "__here__", name: "here", email: "@here" },
  { id: "__channel__", name: "channel", email: "@channel" },
];

interface SlashCommand {
  name: string;
  description: string;
  transform: (rest: string) => string | null;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "me",
    description: "Show an action message",
    transform: (rest) => (rest.trim() ? `_${rest.trim()}_` : null),
  },
  {
    name: "shrug",
    description: "Append a shrug",
    transform: (rest) => (rest.trim() ? `${rest.trim()} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯"),
  },
  {
    name: "tableflip",
    description: "Flip the table",
    transform: (rest) => (rest.trim() ? `${rest.trim()} (╯°□°）╯︵ ┻━┻` : "(╯°□°）╯︵ ┻━┻"),
  },
  {
    name: "unflip",
    description: "Put the table back",
    transform: (rest) => (rest.trim() ? `${rest.trim()} ┬─┬ ノ( ゜-゜ノ)` : "┬─┬ ノ( ゜-゜ノ)"),
  },
];

function detectSlash(value: string): { query: string } | null {
  if (!value.startsWith("/")) return null;
  if (value.includes(" ") && !SLASH_COMMANDS.some((c) => value.startsWith(`/${c.name} `))) return null;
  const query = value.slice(1).toLowerCase();
  return { query };
}

let nonceCounter = 0;

function detectMention(value: string, cursorPos: number): { query: string; start: number } | null {
  const before = value.slice(0, cursorPos);
  const lastAt = before.lastIndexOf("@");
  if (lastAt === -1) return null;
  const afterAt = before.slice(lastAt + 1);
  if (/\s/.test(afterAt)) return null;
  return { query: afterAt.toLowerCase(), start: lastAt };
}

export function MessageInput({ channelId, dmId, parentId, placeholder }: MessageInputProps) {
  const [content, setContent] = useState("");
  const { sendMessage, sendTypingStart, sendTypingStop } = useChatActions();
  const typingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // slash command state
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [members, setMembers] = useState<MentionUser[]>([]);
  const membersLoaded = useRef(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stopTyping = useCallback(() => {
    if (typingRef.current) {
      typingRef.current = false;
      sendTypingStop(channelId, dmId);
    }
  }, [channelId, dmId, sendTypingStop]);

  const loadMembers = useCallback(async () => {
    if (membersLoaded.current) return;
    membersLoaded.current = true;
    try {
      if (channelId) {
        const data = await channelsApi.getMembers(channelId);
        setMembers(data.map((m) => ({ id: m.userId, name: m.user.name, email: m.user.email })));
      } else if (dmId) {
        const dm = useChatStore.getState().dms.find((d) => d.id === dmId);
        if (dm) {
          setMembers(dm.participants.map((p) => ({ id: p.userId, name: p.user.name, email: p.user.email })));
        }
      }
    } catch {
      // silently fail - autocomplete unavailable
    }
  }, [channelId, dmId]);

  const filteredSlash =
    slashQuery !== null
      ? SLASH_COMMANDS.filter((c) => c.name.startsWith(slashQuery))
      : [];

  const applySlashCommand = useCallback(
    (cmd: SlashCommand) => {
      const rest = content.startsWith(`/${cmd.name} `)
        ? content.slice(cmd.name.length + 2)
        : "";
      const transformed = cmd.transform(rest);
      if (transformed) {
        const clientNonce = `${Date.now()}-${++nonceCounter}`;
        sendMessage({ content: transformed, channelId, dmId, parentId, clientNonce });
        setContent("");
      }
      setSlashQuery(null);
    },
    [content, channelId, dmId, parentId, sendMessage],
  );

  const allCandidates: MentionUser[] = [...SPECIAL_MENTIONS, ...members];

  const filteredMentions =
    mentionQuery !== null
      ? allCandidates.filter((u) => {
          const display = (u.name ?? u.email).toLowerCase();
          return display.includes(mentionQuery);
        })
      : [];

  const insertMention = useCallback(
    (user: MentionUser) => {
      if (!textareaRef.current) return;
      const cursorPos = textareaRef.current.selectionStart ?? content.length;
      const before = content.slice(0, mentionStart);
      const after = content.slice(cursorPos);
      const token = user.name?.split(" ")[0] ?? user.email.split("@")[0];
      const newContent = `${before}@${token} ${after}`;
      setContent(newContent);
      setMentionQuery(null);

      // Restore focus and move cursor after the inserted mention
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const pos = mentionStart + token.length + 2; // @ + token + space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos, pos);
        }
      });
    },
    [content, mentionStart],
  );

  const handleChange = (val: string) => {
    setContent(val);

    // Typing indicator
    if (val && !typingRef.current) {
      typingRef.current = true;
      sendTypingStart(channelId, dmId);
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (val) {
      stopTimerRef.current = setTimeout(stopTyping, 2000);
    } else {
      stopTyping();
    }

    // slash command detection
    const slashDetected = detectSlash(val);
    if (slashDetected) {
      setSlashQuery(slashDetected.query);
      setSlashIndex(0);
      setMentionQuery(null);
      return;
    }
    setSlashQuery(null);

    // @mention detection
    const cursorPos = textareaRef.current?.selectionStart ?? val.length;
    const detected = detectMention(val, cursorPos);
    if (detected) {
      void loadMembers();
      setMentionQuery(detected.query);
      setMentionStart(detected.start);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // Clear pending typing timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  // Reset members when channel/DM changes
  useEffect(() => {
    membersLoaded.current = false;
    setMembers([]);
    setMentionQuery(null);
    setSlashQuery(null);
  }, [channelId, dmId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredSlash.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filteredSlash.length) % filteredSlash.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredSlash[slashIndex];
        // If exact match and user hasn't typed args yet, just complete the command name
        if (content === `/${cmd.name}` || content.startsWith(`/${cmd.name} `)) {
          applySlashCommand(cmd);
        } else {
          setContent(`/${cmd.name} `);
          setSlashQuery(null);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }
        return;
      }
      if (e.key === "Escape") {
        setSlashQuery(null);
        return;
      }
    }

    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // Check if it's a slash command
    const matchedCmd = SLASH_COMMANDS.find(
      (c) => trimmed === `/${c.name}` || trimmed.startsWith(`/${c.name} `),
    );
    if (matchedCmd) {
      applySlashCommand(matchedCmd);
      stopTyping();
      return;
    }

    const clientNonce = `${Date.now()}-${++nonceCounter}`;
    sendMessage({ content: trimmed, channelId, dmId, parentId, clientNonce });
    setContent("");
    setMentionQuery(null);
    setSlashQuery(null);
    stopTyping();
  };

  return (
    <div className="relative flex gap-2 items-end p-3 border-t bg-background">
      {/* slash command dropdown */}
      {slashQuery !== null && filteredSlash.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border rounded-md shadow-md overflow-hidden z-50">
          {filteredSlash.map((cmd, i) => (
            <button
              key={cmd.name}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2",
                i === slashIndex ? "bg-accent" : "hover:bg-accent",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                applySlashCommand(cmd);
              }}
              onMouseEnter={() => setSlashIndex(i)}
            >
              <span className="font-mono font-medium text-primary">/{cmd.name}</span>
              <span className="text-muted-foreground text-xs">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* @mention dropdown */}
      {mentionQuery !== null && filteredMentions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border rounded-md shadow-md overflow-hidden z-50">
          {filteredMentions.map((user, i) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2",
                i === mentionIndex ? "bg-accent" : "hover:bg-accent",
              )}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent textarea blur
                insertMention(user);
              }}
              onMouseEnter={() => setMentionIndex(i)}
            >
              <span className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                {(user.name ?? user.email)[0].toUpperCase()}
              </span>
              <span className="font-medium">{user.name ?? user.email}</span>
              {user.name && (
                <span className="text-muted-foreground text-xs truncate">{user.email}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? "Message… (use @ to mention)"}
        className="flex-1 min-h-10 max-h-40 resize-none text-sm"
        onKeyDown={handleKeyDown}
      />
      <Button size="icon" onClick={handleSend} disabled={!content.trim()}>
        <Send className="size-4" />
      </Button>
    </div>
  );
}
