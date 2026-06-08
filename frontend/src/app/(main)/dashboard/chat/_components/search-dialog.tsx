"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Hash, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchApi, type SearchResult } from "@/lib/chat-api";
import { MessageContent } from "./message-content";

interface SearchDialogProps {
  trigger: React.ReactNode;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchDialog({ trigger }: SearchDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    searchApi.messages(debouncedQuery)
      .then((data) => { if (!cancelled) { setResults(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Search failed. Try again."); setLoading(false); } });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleResultClick = (result: SearchResult) => {
    setOpen(false);
    if (result.channelId) {
      router.push(`/dashboard/chat/channels/${result.channelId}`);
    } else if (result.dmId) {
      router.push(`/dashboard/chat/dms/${result.dmId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Search messages</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {error && (
            <p className="text-sm text-destructive text-center py-4">{error}</p>
          )}

          {!loading && debouncedQuery && results.length === 0 && !error && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No messages found for &ldquo;{debouncedQuery}&rdquo;
            </p>
          )}

          {!debouncedQuery && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Type to search across your channels and DMs
            </p>
          )}

          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-accent border-b last:border-b-0 transition-colors"
              onClick={() => handleResultClick(result)}
            >
              {/* Context line */}
              <div className="flex items-center gap-1.5 mb-1">
                {result.channelId ? (
                  <>
                    <Hash className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {result.channel?.name ?? "channel"}
                    </span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Direct Message</span>
                  </>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(result.createdAt), "MMM d, HH:mm")}
                </span>
              </div>

              {/* Sender */}
              <div className="text-xs font-semibold mb-0.5">
                {result.sender.name ?? result.sender.email}
              </div>

              {/* Message preview */}
              <MessageContent content={result.content} className="line-clamp-2 text-xs text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
