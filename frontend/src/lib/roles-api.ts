import { apiFetch } from "./api";

export type PermissionPolicy = "DENY_ALL" | "READ_ALL" | "ALLOW_ALL";

export interface RoleRef {
  id: string;
  name: string;
  displayName: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissionPolicy: PermissionPolicy;
  permissions: string[];
  userCount: number;
  apiKeyCount: number;
}

export interface CreateRoleDto {
  name: string;
  displayName: string;
  permissionPolicy?: PermissionPolicy;
  permissions: string[];
}

export interface UpdateRoleDto {
  displayName?: string;
  permissionPolicy?: PermissionPolicy;
  permissions?: string[];
}

export const rolesApi = {
  list: () => apiFetch<Role[]>("/roles"),
  get: (id: string) => apiFetch<Role>(`/roles/${id}`),
  create: (dto: CreateRoleDto) =>
    apiFetch<Role>("/roles", { method: "POST", body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateRoleDto) =>
    apiFetch<Role>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
  replacePermissions: (id: string, permissions: string[]) =>
    apiFetch<Role>(`/roles/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
  remove: (id: string) => apiFetch<void>(`/roles/${id}`, { method: "DELETE" }),
};

export async function getAvailablePermissions(): Promise<string[]> {
  const meta = await apiFetch<{ enums: { name: string; values: { name: string }[] }[] }>("/meta/schema");
  return meta.enums.find((e) => e.name === "Permission")?.values.map((v) => v.name) ?? [];
}
