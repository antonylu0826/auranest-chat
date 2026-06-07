"use client";

import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AppSelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  options: AppSelectOption[];
  placeholder?: string;
  nullable?: boolean;
  disabled?: boolean;
  className?: string;
}

const NONE = "__none__";

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = "—",
  nullable = false,
  disabled,
  className,
}: AppSelectProps) {
  const internalValue = value || NONE;
  const selected = options.find((o) => o.value === value);

  function handleChange(v: string) {
    onValueChange(v === NONE ? null : v);
  }

  return (
    <Select value={internalValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn(className, !selected && "text-muted-foreground")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {nullable && <SelectItem value={NONE}>—</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
