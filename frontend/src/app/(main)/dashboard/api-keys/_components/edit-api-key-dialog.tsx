"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppSelect } from "@/components/ui/app-select";
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
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n/provider";
import { apiKeysApi, type ApiKey } from "@/lib/api-keys-api";
import { rolesApi } from "@/lib/roles-api";
import { ScopeSelector } from "./scope-selector";

const schema = z.object({
  name: z.string().min(1),
  roleId: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function EditApiKeyDialog({ apiKey }: { apiKey: ApiKey }) {
  const t = useTranslations("apiKeys");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.displayName }));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: apiKey.name,
      roleId: apiKey.roleId,
      scopes: apiKey.scopes,
      isActive: apiKey.isActive,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => apiKeysApi.update(apiKey.id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setOpen(false);
      toast.success(t("newKey"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset({
            name: apiKey.name,
            roleId: apiKey.roleId,
            scopes: apiKey.scopes,
            isActive: apiKey.isActive,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{apiKey.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.role")}</FormLabel>
                  <AppSelect
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? "")}
                    options={roleOptions}
                    placeholder={t("fields.role")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scopes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.scopes")}</FormLabel>
                  <FormControl>
                    <ScopeSelector value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="mb-0">{t("fields.isActive")}</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
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
