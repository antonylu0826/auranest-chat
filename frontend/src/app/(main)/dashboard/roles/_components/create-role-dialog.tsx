"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { type PermissionPolicy, rolesApi } from "@/lib/roles-api";
import { PermissionMatrix } from "./permission-matrix";

const schema = z.object({
  name: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, "Uppercase letters, digits, underscores only"),
  displayName: z.string().min(1).max(100),
  permissionPolicy: z.enum(["DENY_ALL", "READ_ALL", "ALLOW_ALL"]),
  permissions: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

interface CreateRoleDialogProps {
  availablePermissions: string[];
}

export function CreateRoleDialog({ availablePermissions }: CreateRoleDialogProps) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", displayName: "", permissionPolicy: "DENY_ALL", permissions: [] },
  });

  const policy = form.watch("permissionPolicy") as PermissionPolicy;

  const mutation = useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      form.reset();
      toast.success(t("newRole"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(values: FormValues) {
    // For READ_ALL: strip *_READ perms from submitted set (covered by policy)
    const perms = policy === "READ_ALL"
      ? values.permissions.filter((p) => !p.endsWith("_READ"))
      : values.permissions;
    mutation.mutate({ ...values, permissions: perms });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-2" />
          {t("newRole")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newRole")}</DialogTitle>
          <DialogDescription className="sr-only">{t("newRole")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? tc("creating") : tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
