"use client";

import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

interface DateTimePickerProps {
  /** ISO 8601 string or Date — value is always emitted as ISO string */
  value?: string | Date;
  onChange?: (date: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "選擇日期與時間",
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const parsedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    const d = parseISO(value);
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      if (parsedDate) {
        newDate.setHours(parsedDate.getHours());
        newDate.setMinutes(parsedDate.getMinutes());
      } else {
        newDate.setHours(9);
        newDate.setMinutes(0);
      }
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);
      onChange?.(newDate.toISOString());
    } else {
      onChange?.(undefined);
    }
  };

  const handleTimeChange = (type: "hour" | "minute", timeValue: string) => {
    const baseDate = parsedDate ? new Date(parsedDate) : new Date();
    if (!parsedDate) {
      baseDate.setSeconds(0);
      baseDate.setMilliseconds(0);
    }
    if (type === "hour") baseDate.setHours(parseInt(timeValue, 10));
    else baseDate.setMinutes(parseInt(timeValue, 10));
    onChange?.(baseDate.toISOString());
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !parsedDate && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {parsedDate ? format(parsedDate, "yyyy-MM-dd HH:mm") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="sm:flex">
          <Calendar mode="single" selected={parsedDate} onSelect={handleDateSelect} />
          <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x border-t sm:border-t-0 sm:border-l border-border">
            <div className="flex flex-col items-center p-2 bg-muted/20">
              <span className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="size-3" /> Hr
              </span>
              <ScrollArea className="w-16 sm:w-auto h-[240px]">
                <div className="flex sm:flex-col gap-1 p-1">
                  {HOURS.map((hour) => (
                    <Button
                      key={hour}
                      size="icon"
                      variant={parsedDate && parsedDate.getHours() === hour ? "default" : "ghost"}
                      className="size-8 shrink-0 rounded-md text-xs font-mono"
                      onClick={() => handleTimeChange("hour", hour.toString())}
                    >
                      {hour.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
            </div>
            <div className="flex flex-col items-center p-2 bg-muted/20">
              <span className="text-xs font-medium text-muted-foreground mb-1">Min</span>
              <ScrollArea className="w-16 sm:w-auto h-[240px]">
                <div className="flex sm:flex-col gap-1 p-1">
                  {MINUTES.map((minute) => (
                    <Button
                      key={minute}
                      size="icon"
                      variant={parsedDate && parsedDate.getMinutes() === minute ? "default" : "ghost"}
                      className="size-8 shrink-0 rounded-md text-xs font-mono"
                      onClick={() => handleTimeChange("minute", minute.toString())}
                    >
                      {minute.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
