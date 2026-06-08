import { apiFetch } from "./api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const SW_PATH = "/sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buf = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return view;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
    return false;
  }

  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = subscription.toJSON() as {
      endpoint: string;
      keys?: { p256dh: string; auth: string };
    };

    await apiFetch(`${API}/push/subscribe`.replace(API, ""), {
      method: "POST",
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      }),
    });

    return true;
  } catch (err) {
    console.error("[push] subscribe failed", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return true;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    await apiFetch("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    return true;
  } catch (err) {
    console.error("[push] unsubscribe failed", err);
    return false;
  }
}

export async function getPushPreference(): Promise<{ pushEnabled: boolean }> {
  return apiFetch<{ pushEnabled: boolean }>("/push/preference");
}

export async function setPushPreference(enabled: boolean): Promise<{ pushEnabled: boolean }> {
  return apiFetch<{ pushEnabled: boolean }>("/push/preference", {
    method: "PATCH",
    body: JSON.stringify({ pushEnabled: enabled }),
  });
}
