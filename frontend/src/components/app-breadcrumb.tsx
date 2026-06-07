"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/i18n/provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const TRANSLATABLE_SEGMENTS = ["dashboard", "users", "calendar", "events", "home", "api-keys", "roles"] as const;
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

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: isTranslatable(seg) ? t((SEGMENT_KEY_MAP[seg] ?? seg) as Parameters<typeof t>[0]) : seg,
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
