"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";

type Messages = { [key: string]: string | Messages };

interface I18nCtx {
  locale: Locale;
  messages: Messages;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

function resolve(obj: Messages, key: string): string {
  const parts = key.split(".");
  let curr: string | Messages = obj;
  for (const p of parts) {
    if (typeof curr !== "object" || curr === null) return key;
    curr = (curr as Messages)[p] ?? key;
  }
  return typeof curr === "string" ? curr : key;
}

export function useTranslations(namespace: string) {
  const ctx = useContext(I18nContext);
  const ns = (ctx?.messages[namespace] as Messages | undefined) ?? {};
  return (key: string): string => resolve(ns, key);
}

export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? "zh-TW";
}
