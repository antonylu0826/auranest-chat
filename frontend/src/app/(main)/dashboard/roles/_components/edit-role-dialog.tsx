"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/i18n/provider";
import { type PermissionPolicy, type Role, rolesApi } from "@/lib/roles-api";
import { PermissionMatrix } from "./permission-matrix";

const schema = z.object({
  displayName: z.string().min(1).max(100),
  permissionPolicy: z.enum(["DENY_ALL", "READ_ALL", "ALLOW_ALL"]),
  permissions: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

interface EditRoleDialogProps {
  role: Role;
  availablePermissions: string[];
}

export function EditRoleDialog({ role, availablePermissions }: EditRoleDialogProps) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: role.displayName,
      permissionPolicy: role.permissionPolicy,
      permissions: role.permissions,
    },
  });

  const policy = form.watch("permissionPolicy") as PermissionPolicy;
  const isAdmin = role.name === "ADMIN";

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const perms = !isAdmin
        ? (values.permissionPolicy === "READ_ALL"
            ? values.permissions.filter((p) => !p.endsWith("_READ"))
            : values.permissions)
        : undefined;
      // Single atomic request: backend updates metadata + permissions in one transaction
      await rolesApi.update(role.id, {
        displayName: values.displayName,
        permissionPolicy: values.permissionPolicy,
        permissions: perms,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      toast.success(tc("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleOpen(o: boolean) {
    setOpen(o);
    if (o) {
      form.reset({
        displayName: role.displayName,
        permissionPolicy: role.permissionPolicy,
        permissions: role.permissions,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editRole")}</DialogTitle>
          <DialogDescription className="sr-only">{t("editRole")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
            {/* Role name — locked */}
            <FormItem>
              <FormLabel>{t("name")}</FormLabel>
              <Input value={role.name} disabled />
            </FormItem>

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("displayName")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("displayNamePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissionPolicy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("permissionPolicy")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isAdmin}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DENY_ALL">{t("policy.DENY_ALL")}</SelectItem>
                      <SelectItem value="READ_ALL">{t("policy.READ_ALL")}</SelectItem>
                      <SelectItem value="ALLOW_ALL">{t("policy.ALLOW_ALL")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isAdmin && (
              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("permissions")}</FormLabel>
                    <PermissionMatrix
                      available={availablePermissions}
                      value={field.value}
                      onChange={field.onChange}
                      policy={policy}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
