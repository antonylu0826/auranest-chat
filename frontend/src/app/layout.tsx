import type { ReactNode } from "react";

import type { Metadata } from "next";
import { I18nProvider } from "@/i18n/provider";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { allMessages } from "@/i18n/messages";
import { getLocale } from "@/server/server-actions";
import { fontVars } from "@/lib/fonts/registry";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { QueryProvider } from "@/providers/query-provider";
import { themeBootCode } from "@/scripts/theme-boot";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { theme_mode, theme_preset, content_layout, navbar_style, sidebar_variant, sidebar_collapsible, font } =
    PREFERENCE_DEFAULTS;

  const locale = await getLocale();
  const messages = allMessages[locale];

  return (
    <html
      lang={locale}
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: required for pre-hydration boot script */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeBootCode }} />
      </head>
      <body className={`${fontVars} min-h-screen antialiased`}>
        <I18nProvider locale={locale} messages={messages}>
          <QueryProvider>
            <TooltipProvider>
              <PreferencesStoreProvider
                themeMode={theme_mode}
                themePreset={theme_preset}
                contentLayout={content_layout}
                navbarStyle={navbar_style}
                font={font}
              >
                {children}
                <Toaster />
              </PreferencesStoreProvider>
            </TooltipProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
