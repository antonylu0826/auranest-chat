"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslations } from "@/i18n/provider";
import { type User, usersApi } from "@/lib/api";
import { CreateUserDialog } from "./_components/create-user-dialog";
import { DeleteUserDialog } from "./_components/delete-user-dialog";
import { EditUserDialog } from "./_components/edit-user-dialog";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const currentUser = useCurrentUser();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const sortField = sorting[0]?.id;
  const sortOrder = sorting[0] ? (sorting[0].desc ? "DESC" : "ASC") : undefined;

  const { data: result, isLoading } = useQuery({
    queryKey: ["users", page, PAGE_SIZE, debouncedSearch, sortField, sortOrder],
    queryFn: () => usersApi.list({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined, sortField, sortOrder }),
  });

  const users = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            {t("name")} <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name ?? "—"}
            {row.original.id === currentUser?.sub && (
              <span className="ml-2 text-xs text-muted-foreground">{t("you")}</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            {t("email")} <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
      },
      {
        accessorKey: "roles",
        header: t("role"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((r) => (
              <Badge key={r.id} variant="outline">{r.displayName}</Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: t("status"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? t("active") : t("disabled")}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            {t("created")} <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === currentUser?.sub;
          return (
            <div className="flex items-center justify-end gap-1">
              <EditUserDialog user={user} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={isSelf || toggleMutation.isPending}
                onClick={() =>
                  toggleMutation.mutate({ id: user.id, isActive: !user.isActive })
                }
              >
                {user.isActive ? tc("disable") : tc("enable")}
              </Button>
              {!isSelf && <DeleteUserDialog user={user} />}
            </div>
          );
        },
      },
    ],
    [currentUser?.sub, t, tc, toggleMutation],
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">
            {total} {t("title").toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-56"
          />
          <CreateUserDialog />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton cols={columns.length} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-16">
                    {t("noUsers")}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{tc("page")} {page} / {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
