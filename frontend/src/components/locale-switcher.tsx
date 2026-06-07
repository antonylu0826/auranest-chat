"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/i18n/config";
import { setLocale } from "@/server/server-actions";

const LOCALE_LABELS: Record<Locale, string> = {
  "zh-TW": "繁體中文",
  en: "English",
};

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const [isPending, startTransition] = useTransition();

  const onSelect = (next: Locale) => {
    if (next === currentLocale) return;
    startTransition(async () => {
      await setLocale(next);
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" disabled={isPending}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => onSelect(l)}
            className={l === currentLocale ? "font-medium" : ""}
          >
            {LOCALE_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
