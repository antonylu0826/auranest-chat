"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/i18n/provider";
import { useChatStore } from "@/stores/chat/chat-store";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const TRANSLATABLE_SEGMENTS = ["dashboard", "users", "calendar", "events", "home", "api-keys", "roles", "chat", "channels", "dms"] as const;
type TranslatableSegment = (typeof TRANSLATABLE_SEGMENTS)[number];

// Maps URL segments to i18n keys when they differ (e.g. kebab-case → camelCase)
const SEGMENT_KEY_MAP: Partial<Record<TranslatableSegment, string>> = {
  "api-keys": "apiKeys",
};

function isTranslatable(s: string): s is TranslatableSegment {
  return TRANSLATABLE_SEGMENTS.includes(s as TranslatableSegment);
}

export function AppBreadcrumb() {
  const t = useTranslations("pages");
  const pathname = usePathname();
  const { channels, dms } = useChatStore();
  const currentUser = useCurrentUser();

  const resolveSegment = (seg: string): string => {
    if (isTranslatable(seg)) return t((SEGMENT_KEY_MAP[seg] ?? seg) as Parameters<typeof t>[0]);
    const channel = channels.find((c) => c.id === seg);
    if (channel) return `#${channel.name}`;
    const dm = dms.find((d) => d.id === seg);
    if (dm) {
      const other = dm.participants.find((p) => p.userId !== currentUser?.sub);
      return other?.user.name ?? other?.user.email ?? seg;
    }
    return seg;
  };

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: resolveSegment(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb) => (
          <Fragment key={crumb.href}>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link prefetch={false} href={crumb.href}>
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
