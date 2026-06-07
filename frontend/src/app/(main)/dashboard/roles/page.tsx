"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useTranslations } from "@/i18n/provider";
import { getAvailablePermissions, rolesApi, type PermissionPolicy, type Role } from "@/lib/roles-api";
import { CreateRoleDialog } from "./_components/create-role-dialog";
import { DeleteRoleDialog } from "./_components/delete-role-dialog";
import { EditRoleDialog } from "./_components/edit-role-dialog";

const POLICY_VARIANT: Record<PermissionPolicy, "secondary" | "outline" | "default"> = {
  DENY_ALL: "secondary",
  READ_ALL: "outline",
  ALLOW_ALL: "default",
};

export default function RolesPage() {
  const t = useTranslations("roles");
  const [search, setSearch] = useState("");

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
  });

  const { data: availablePermissions = [] } = useQuery({
    queryKey: ["available-permissions"],
    queryFn: getAvailablePermissions,
  });

  const filtered = useMemo(() => {
    if (!roles) return [];
    const q = search.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q),
    );
  }, [roles, search]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <CreateRoleDialog availablePermissions={availablePermissions} />
      </div>

      <Input
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <TableSkeleton cols={6} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("displayName")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("permissionPolicy")}</TableHead>
                <TableHead>{t("permissions")}</TableHead>
                <TableHead>{t("userCount")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("noRoles")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((role: Role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {role.displayName}
                        {role.isSystem && (
                          <Badge variant="secondary" className="text-xs">{t("system")}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{role.name}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={POLICY_VARIANT[role.permissionPolicy]}>
                        {t(`policy.${role.permissionPolicy}` as Parameters<typeof t>[0])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.permissionPolicy === "ALLOW_ALL" ? "—" : role.permissions.length}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{role.userCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <EditRoleDialog role={role} availablePermissions={availablePermissions} />
                        <DeleteRoleDialog role={role} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
