"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useTranslations } from "@/i18n/provider";
import { apiKeysApi, type CreateApiKeyResult } from "@/lib/api-keys-api";
import { rolesApi } from "@/lib/roles-api";
import { ScopeSelector } from "./scope-selector";

const schema = z.object({
  name: z.string().min(1),
  roleId: z.string().min(1),
  scopes: z.array(z.string()).min(1, "至少選擇一個 scope"),
});

type FormValues = z.infer<typeof schema>;

export function CreateApiKeyDialog() {
  const t = useTranslations("apiKeys");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.displayName }));
  const userRoleId = roles.find((r) => r.name === "USER")?.id ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", roleId: "", scopes: [] },
  });

  // Set USER role as default once roles finish loading (avoids setValue during render)
  useEffect(() => {
    if (userRoleId && !form.getValues("roleId")) {
      form.setValue("roleId", userRoleId);
    }
  }, [userRoleId, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiKeysApi.create({ name: values.name, roleId: values.roleId, scopes: values.scopes }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey(result);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCopy() {
    if (!createdKey) return;
    void navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(o: boolean) {
    if (!o && createdKey && !copied) return;
    setOpen(o);
    if (!o) {
      setCreatedKey(null);
      setCopied(false);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          {t("newKey")}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newKey")}</DialogTitle>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-amber-600 font-medium">{t("keyCreatedOnce")}</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
              <code className="flex-1 text-xs break-all select-all">{createdKey.key}</code>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-green-600">{t("copied")}</p>}
            <DialogFooter>
              <Button onClick={() => handleClose(false)} disabled={!copied}>
                {tc("cancel")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder="n8n production" {...field} />
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? tc("creating") : tc("create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
