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
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";

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
import { useTranslations } from "@/i18n/provider";
import { apiKeysApi, type ApiKey } from "@/lib/api-keys-api";
import { CreateApiKeyDialog } from "./_components/create-api-key-dialog";
import { DeleteApiKeyDialog } from "./_components/delete-api-key-dialog";
import { EditApiKeyDialog } from "./_components/edit-api-key-dialog";

const PAGE_SIZE = 20;

export default function ApiKeysPage() {
  const t = useTranslations("apiKeys");
  const tc = useTranslations("common");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const sortField = sorting[0]?.id;
  const sortOrder = sorting[0] ? (sorting[0].desc ? "DESC" : "ASC") : undefined;

  const { data: result, isLoading } = useQuery({
    queryKey: ["api-keys", page, PAGE_SIZE, debouncedSearch, sortField, sortOrder],
    queryFn: () =>
      apiKeysApi.list({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined, sortField, sortOrder }),
  });

  const keys = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: "prefix",
        header: t("fields.prefix"),
        enableSorting: false,
        cell: ({ row }) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.original.prefix}…</code>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            {t("fields.name")} <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "role",
        header: t("fields.role"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.role?.displayName ?? row.original.roleId}</Badge>
        ),
      },
      {
        accessorKey: "scopes",
        header: t("fields.scopes"),
        enableSorting: false,
        cell: ({ row }) => {
          const scopes = row.original.scopes;
          if (scopes.includes("*")) return <Badge variant="secondary">*</Badge>;
          return (
            <div className="flex flex-wrap gap-1 max-w-48">
              {scopes.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs font-mono">
                  {s}
                </Badge>
              ))}
              {scopes.length > 3 && (
                <Badge variant="secondary" className="text-xs">+{scopes.length - 3}</Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: t("fields.isActive"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? tc("enable") : tc("disable")}
          </Badge>
        ),
      },
      {
        accessorKey: "createdBy",
        header: t("fields.createdBy"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.createdBy ?? "—"}</span>
        ),
      },
      {
        accessorKey: "lastUsedAt",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting()}>
            {t("fields.lastUsedAt")} <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          row.original.lastUsedAt
            ? new Date(row.original.lastUsedAt).toLocaleDateString()
            : "—",
      },
      {
        accessorKey: "expiresAt",
        header: t("fields.expiresAt"),
        enableSorting: false,
        cell: ({ row }) => {
          if (!row.original.expiresAt) return <span className="text-muted-foreground">—</span>;
          const expired = new Date(row.original.expiresAt) < new Date();
          return (
            <span className={expired ? "text-destructive" : ""}>
              {new Date(row.original.expiresAt).toLocaleDateString()}
            </span>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <EditApiKeyDialog apiKey={row.original} />
            <DeleteApiKeyDialog apiKey={row.original} />
          </div>
        ),
      },
    ],
    [t, tc],
  );

  const table = useReactTable({
    data: keys,
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
          <p className="text-muted-foreground text-sm">{total} keys</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-56"
          />
          <CreateApiKeyDialog />
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
                    {t("noItems")}
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
