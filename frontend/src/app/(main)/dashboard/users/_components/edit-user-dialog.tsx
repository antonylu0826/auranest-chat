"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useTranslations } from "@/i18n/provider";
import { type User, usersApi } from "@/lib/api";
import { rolesApi } from "@/lib/roles-api";

const schema = z.object({
  name: z.string().min(1),
  roleIds: z.array(z.string()).min(1),
});

type FormValues = z.infer<typeof schema>;

export function EditUserDialog({ user }: { user: User }) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const currentRoleIds = user.roles.map((r) => r.id);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name ?? "", roleIds: currentRoleIds },
  });

  const nameMutation = useMutation({
    mutationFn: (name: string) => usersApi.update(user.id, { name }),
  });

  const rolesMutation = useMutation({
    mutationFn: (roleIds: string[]) => usersApi.updateRoles(user.id, roleIds),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const promises: Promise<unknown>[] = [];
      if (values.name !== (user.name ?? "")) {
        promises.push(nameMutation.mutateAsync(values.name));
      }
      const rolesChanged =
        values.roleIds.length !== currentRoleIds.length ||
        values.roleIds.some((id) => !currentRoleIds.includes(id));
      if (rolesChanged) {
        promises.push(rolesMutation.mutateAsync(values.roleIds));
      }
      if (promises.length > 0) {
        await Promise.all(promises);
        qc.invalidateQueries({ queryKey: ["users"] });
        toast.success(t("editUser"));
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tc("save"));
    }
  };

  const isPending = nameMutation.isPending || rolesMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset({ name: user.name ?? "", roleIds: currentRoleIds });
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("editUser")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
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
              name="roleIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("role")}</FormLabel>
                  <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={field.value.includes(role.id)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...field.value, role.id]
                              : field.value.filter((id) => id !== role.id);
                            field.onChange(next);
                          }}
                        />
                        {role.displayName}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
