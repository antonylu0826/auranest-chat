"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export function AuthGuard({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/auth/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return <>{children}</>;
}
