"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/provider";
import { type Role, rolesApi } from "@/lib/roles-api";

interface DeleteRoleDialogProps {
  role: Role;
}

export function DeleteRoleDialog({ role }: DeleteRoleDialogProps) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const isBlocked = role.isSystem || role.userCount > 0 || role.apiKeyCount > 0;
  const blockReason = role.isSystem
    ? t("cannotDeleteSystem")
    : t("cannotDeleteHasUsers");

  const mutation = useMutation({
    mutationFn: () => rolesApi.remove(role.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      toast.success(tc("delete"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          disabled={isBlocked}
          title={isBlocked ? blockReason : undefined}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteRole")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {tc("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
