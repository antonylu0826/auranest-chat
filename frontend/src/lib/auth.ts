const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "local";
export const OIDC_ISSUER = process.env.NEXT_PUBLIC_OIDC_ISSUER ?? "";
export const isOidc = AUTH_MODE === "oidc";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export interface CurrentUser {
  sub: string;
  email: string;
  name?: string;
  avatar?: string;
  roleNames?: string[];
  permissionPolicy?: string;
  permissions?: string[];
}

export function decodeToken(token: string): CurrentUser | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    return {
      sub: (decoded.sub as string) ?? "",
      email: (decoded.email as string) ?? "",
      name: (decoded.name as string | undefined) ?? (decoded.email as string) ?? "User",
      avatar: "",
      roleNames: (decoded.roleNames as string[] | undefined) ?? [],
      permissionPolicy: (decoded.permissionPolicy as string | undefined) ?? "DENY_ALL",
      permissions: (decoded.permissions as string[] | undefined) ?? [],
    };
  } catch {
    return null;
  }
}

export async function loginLocal(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? "Login failed");
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function registerLocal(
  email: string,
  password: string,
  name?: string,
): Promise<string> {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? "Registration failed");
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export function redirectToOidc() {
  const params = new URLSearchParams({
    client_id: "app",
    redirect_uri: `${window.location.origin}/callback`,
    response_type: "code",
    scope: "openid profile email",
  });
  window.location.href = `${OIDC_ISSUER}/protocol/openid-connect/auth?${params}`;
}
