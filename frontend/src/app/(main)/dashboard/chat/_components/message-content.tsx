"use client";

import { cn } from "@/lib/utils";

interface MessageContentProps {
  content: string;
  className?: string;
}

// Matches @mentions, *bold*, _italic_, `code` spans
const TOKEN_RE = /(`[^`]+`|\*[^*]+\*|_[^_]+_|@(?:here|channel|[a-zA-Z0-9._-]+))/g;

export function MessageContent({ content, className }: MessageContentProps) {
  const parts = content.split(TOKEN_RE);

  return (
    <p className={cn("text-sm whitespace-pre-wrap break-words", className)}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const isSpecial = part === "@here" || part === "@channel";
          return (
            <span
              key={i}
              className={cn(
                "rounded px-0.5 font-medium",
                isSpecial
                  ? "text-orange-600 bg-orange-100 dark:bg-orange-950 dark:text-orange-400"
                  : "text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
              )}
            >
              {part}
            </span>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded px-1 py-0.5 bg-muted font-mono text-xs">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        if (part.startsWith("_") && part.endsWith("_")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </p>
  );
}
