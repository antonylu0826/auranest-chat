"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getToken } from "@/lib/auth";
import {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  getPushPreference,
  setPushPreference,
} from "@/lib/push";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

export function PushNotificationToggle() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Only mount after hydration (Notification API is browser-only)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);

    if (Notification.permission === "granted") {
      registerServiceWorker().then(async (reg) => {
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }

    const token = getToken();
    if (token) {
      getPushPreference()
        .then((pref) => setPushEnabled(pref.pushEnabled))
        .catch(() => {});
    }
  }, [mounted]);

  if (!mounted || permission === "unsupported") return null;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        setPermission("granted");
        setSubscribed(true);
      } else {
        setPermission(Notification.permission as PermissionState);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePushEnabled = async (checked: boolean) => {
    setPushEnabled(checked);
    try {
      await setPushPreference(checked);
    } catch {
      setPushEnabled(!checked);
    }
  };

  const isActive = permission === "granted" && subscribed && pushEnabled;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant={isActive ? "default" : "outline"} title="Push Notifications">
          {permission === "denied" || !subscribed ? (
            <BellOff className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="font-medium text-sm">Push Notifications</p>

        {permission === "denied" && (
          <p className="text-muted-foreground text-xs">
            Notifications are blocked in your browser settings. To enable them, click the lock icon
            in your address bar and allow notifications for this site.
          </p>
        )}

        {permission === "default" && (
          <>
            <p className="text-muted-foreground text-xs">
              Receive notifications when you are mentioned or receive a direct message.
            </p>
            <Button size="sm" className="w-full" onClick={handleSubscribe} disabled={loading}>
              {loading ? "Requesting…" : "Enable Notifications"}
            </Button>
          </>
        )}

        {permission === "granted" && (
          <>
            {!subscribed ? (
              <>
                <p className="text-muted-foreground text-xs">Subscribe to receive push notifications.</p>
                <Button size="sm" className="w-full" onClick={handleSubscribe} disabled={loading}>
                  {loading ? "Subscribing…" : "Subscribe"}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="push-enabled" className="text-sm cursor-pointer">
                    Receive notifications
                  </Label>
                  <Switch
                    id="push-enabled"
                    checked={pushEnabled}
                    onCheckedChange={handleTogglePushEnabled}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleUnsubscribe}
                  disabled={loading}
                >
                  {loading ? "Unsubscribing…" : "Unsubscribe from this device"}
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
