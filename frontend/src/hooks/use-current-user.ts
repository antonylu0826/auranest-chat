"use client";

import { useEffect, useState } from "react";
import { type CurrentUser, decodeToken, getToken } from "@/lib/auth";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const token = getToken();
    setUser(token ? decodeToken(token) : null);
  }, []);

  return user;
}
