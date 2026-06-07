"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "@/i18n/provider";
import type { PermissionPolicy } from "@/lib/roles-api";

const GROUPS: { key: string; prefix: string }[] = [
  { key: "users", prefix: "USERS_" },
  { key: "apiKeys", prefix: "API_KEYS_" },
  { key: "calendar", prefix: "CALENDAR_" },
  { key: "event", prefix: "EVENT_" },
];

interface PermissionMatrixProps {
  available: string[];
  value: string[];
  onChange: (next: string[]) => void;
  policy: PermissionPolicy;
  disabled?: boolean;
}

export function PermissionMatrix({ available, value, onChange, policy, disabled }: PermissionMatrixProps) {
  const t = useTranslations("roles");
  const isAllowAll = policy === "ALLOW_ALL";
  const isReadAll = policy === "READ_ALL";

  function toggle(perm: string, checked: boolean) {
    if (checked) {
      onChange([...value, perm]);
    } else {
      onChange(value.filter((p) => p !== perm));
    }
  }

  return (
    <div className="space-y-4">
      {isAllowAll && (
        <p className="text-sm text-muted-foreground italic">{t("allowAllNote")}</p>
      )}
      {GROUPS.map((group) => {
        const perms = available.filter((p) => p.startsWith(group.prefix));
        if (!perms.length) return null;
        return (
          <div key={group.key}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t(`groups.${group.key}` as Parameters<typeof t>[0])}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {perms.map((perm) => {
                const isReadPerm = perm.endsWith("_READ");
                const autoChecked = isReadAll && isReadPerm;
                const effectiveDisabled = disabled || isAllowAll || autoChecked;
                const isChecked = isAllowAll || autoChecked || value.includes(perm);

                return (
                  <label
                    key={perm}
                    className="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={effectiveDisabled}
                      onCheckedChange={(checked) => {
                        if (!effectiveDisabled) toggle(perm, !!checked);
                      }}
                    />
                    <span className="text-sm">
                      {t(`perm.${perm}` as Parameters<typeof t>[0])}
                      {autoChecked && (
                        <span className="ml-1 text-xs text-muted-foreground">(policy)</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
