"use client";

import * as React from "react";
import { format, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type { DateRange };

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (value: DateRange | undefined) => void;
  placeholder?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "選擇日期區間",
  align = "end",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = subDays(to, 29);
    return { from, to };
  });

  const dateRange = value ?? internalRange;

  const handleChange = (next: DateRange | undefined) => {
    if (!value) setInternalRange(next);
    onChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`font-normal ${className ?? ""}`}>
          {dateRange?.from
            ? dateRange.to
              ? `${format(dateRange.from, "d MMM yyyy")} - ${format(dateRange.to, "d MMM yyyy")}`
              : format(dateRange.from, "d MMM yyyy")
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align={align}>
        <Calendar
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={handleChange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
