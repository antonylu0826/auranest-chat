"use client";

import { useRef } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

interface TimePickerProps {
  /** HH:mm string */
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parseHHmm(value: string | undefined): { h: number; m: number } | undefined {
  if (!value) return undefined;
  const [h, m] = value.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return undefined;
  return { h, m };
}

function formatHHmm(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimePicker({
  value,
  onChange,
  placeholder = "選擇時間",
  disabled = false,
  className,
}: TimePickerProps) {
  const parsed = parseHHmm(value);

  const handleHour = (h: number) => {
    onChange?.(formatHHmm(h, parsed?.m ?? 0));
  };

  const handleMinute = (m: number) => {
    onChange?.(formatHHmm(parsed?.h ?? 0, m));
  };

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  function scrollToSelected() {
    if (parsed) {
      const hBtn = hourRef.current?.querySelector(`[data-hour="${parsed.h}"]`);
      const mBtn = minuteRef.current?.querySelector(`[data-min="${parsed.m}"]`);
      hBtn?.scrollIntoView({ block: "center" });
      mBtn?.scrollIntoView({ block: "center" });
    }
  }

  return (
    <Popover onOpenChange={(open) => { if (open) setTimeout(scrollToSelected, 50); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !parsed && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {parsed ? formatHHmm(parsed.h, parsed.m) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x border-border">
          {/* Hours */}
          <div className="flex flex-col items-center p-2 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground mb-1">Hr</span>
            <ScrollArea className="h-56 w-14">
              <div ref={hourRef} className="flex flex-col gap-1 p-1">
                {HOURS.map((h) => (
                  <Button
                    key={h}
                    data-hour={h}
                    size="icon"
                    variant={parsed?.h === h ? "default" : "ghost"}
                    className="size-8 shrink-0 rounded-md text-xs font-mono"
                    onClick={() => handleHour(h)}
                  >
                    {String(h).padStart(2, "0")}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
          {/* Minutes */}
          <div className="flex flex-col items-center p-2 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground mb-1">Min</span>
            <ScrollArea className="h-56 w-14">
              <div ref={minuteRef} className="flex flex-col gap-1 p-1">
                {MINUTES.map((m) => (
                  <Button
                    key={m}
                    data-min={m}
                    size="icon"
                    variant={parsed?.m === m ? "default" : "ghost"}
                    className="size-8 shrink-0 rounded-md text-xs font-mono"
                    onClick={() => handleMinute(m)}
                  >
                    {String(m).padStart(2, "0")}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
