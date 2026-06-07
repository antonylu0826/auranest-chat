"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "@/i18n/provider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getAvailableScopes } from "@/lib/api-keys-api";

interface ScopeSelectorProps {
  value: string[];
  onChange: (scopes: string[]) => void;
}

interface ScopeGroup {
  module: string;
  scopes: string[];
}

function groupScopes(scopes: string[]): ScopeGroup[] {
  const map = new Map<string, string[]>();
  for (const scope of scopes) {
    const [mod] = scope.split(":");
    if (!map.has(mod)) map.set(mod, []);
    map.get(mod)!.push(scope);
  }
  return Array.from(map.entries()).map(([module, s]) => ({ module, scopes: s }));
}

export function ScopeSelector({ value, onChange }: ScopeSelectorProps) {
  const tc = useTranslations("common");

  const { data: available = [], isLoading } = useQuery({
    queryKey: ["meta-scopes"],
    queryFn: getAvailableScopes,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  const groups = groupScopes(available);
  const hasGlobal = value.includes("*");

  function toggle(scope: string) {
    const [mod, action] = scope.split(":");

    if (scope === "*") {
      onChange(hasGlobal ? [] : ["*"]);
      return;
    }

    // Remove global wildcard when selecting specific scope
    let next = value.filter((s) => s !== "*");

    if (action === "*") {
      // x:* selected — remove x:read and x:write, toggle x:*
      const without = next.filter((s) => !s.startsWith(`${mod}:`));
      onChange(next.includes(scope) ? without : [...without, scope]);
    } else {
      // x:read or x:write — remove x:*
      const without = next.filter((s) => s !== `${mod}:*`);
      if (without.includes(scope)) {
        onChange(without.filter((s) => s !== scope));
      } else {
        onChange([...without, scope]);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Global wildcard */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="scope-*"
          checked={hasGlobal}
          onCheckedChange={() => toggle("*")}
        />
        <Label htmlFor="scope-*" className="font-mono text-sm cursor-pointer">
          * <span className="text-muted-foreground font-sans">(全部)</span>
        </Label>
      </div>

      {!hasGlobal && (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(({ module, scopes }) => (
            <div key={module} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {module}
              </p>
              {scopes.map((scope) => {
                const [, action] = scope.split(":");
                const checked = value.includes(scope);
                return (
                  <div key={scope} className="flex items-center gap-2">
                    <Checkbox
                      id={`scope-${scope}`}
                      checked={checked}
                      onCheckedChange={() => toggle(scope)}
                    />
                    <Label
                      htmlFor={`scope-${scope}`}
                      className="font-mono text-sm cursor-pointer"
                    >
                      {action}
                    </Label>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
