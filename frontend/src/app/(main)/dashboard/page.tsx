"use client";

import Link from "next/link";
import { type LucideIcon, Users } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app-config";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslations } from "@/i18n/provider";

interface Tile {
  ns: string;
  titleKey: string;
  descKey: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

// Fork 後在這裡加業務頁面的入口卡片
// ns 對應 i18n namespace，titleKey / descKey 對應該 namespace 內的 key
const TILES: Tile[] = [
  {
    ns: "users",
    titleKey: "title",
    descKey: "tileDesc",
    href: "/dashboard/users",
    icon: Users,
    adminOnly: true,
  },
];

export default function DashboardPage() {
  const tw = useTranslations("welcome");
  const tu = useTranslations("users");
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.roleNames?.includes("ADMIN") ?? false;

  const visibleTiles = TILES.filter((tile) => !tile.adminOnly || isAdmin);

  const nsMap: Record<string, (key: string) => string> = { users: tu };

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {tw("greeting")}{currentUser?.name ? `，${currentUser.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">{tw("subtitle")}</p>
      </div>

      {visibleTiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{tw("quickAccess")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTiles.map((tile) => {
              const t = nsMap[tile.ns];
              return (
                <Link key={tile.href} href={tile.href} className="group">
                  <Card className="h-full transition-colors group-hover:bg-muted/50">
                    <CardHeader>
                      <tile.icon className="size-5 text-muted-foreground mb-1" />
                      <CardTitle className="text-base">{t ? t(tile.titleKey) : tile.titleKey}</CardTitle>
                      <CardDescription>{t ? t(tile.descKey) : tile.descKey}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground pt-4 border-t">
        {APP_CONFIG.name} · v{APP_CONFIG.version}
      </p>
    </div>
  );
}
