"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { router.replace("/auth/login"); return; }

    fetch(`${API}/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri: `${window.location.origin}/callback` }),
    })
      .then((r) => r.json())
      .then((d: { token: string }) => { setToken(d.token); router.replace("/dashboard/users"); })
      .catch(() => router.replace("/auth/login"));
  }, [router]);

  return (
    <div className="flex h-dvh items-center justify-center">
      <p className="text-muted-foreground">Signing in...</p>
    </div>
  );
}
