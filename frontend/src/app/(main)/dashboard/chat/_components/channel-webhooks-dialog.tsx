"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { webhooksApi, type Webhook, type WebhookCreated } from "@/lib/chat-api";

const schema = z.object({ name: z.string().min(1).max(100) });
type FormValues = z.infer<typeof schema>;

function NewWebhookForm({
  channelId,
  onCreated,
}: {
  channelId: string;
  onCreated: (w: WebhookCreated) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    const webhook = await webhooksApi.create(channelId, v.name);
    reset();
    onCreated(webhook);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
      <div className="flex-1 space-y-1">
        <Input
          {...register("name")}
          placeholder="Webhook name"
          className="h-8 text-sm"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>
      <Button type="submit" size="sm" disabled={isSubmitting} className="h-8">
        <Plus className="size-3.5 mr-1" />
        Add
      </Button>
    </form>
  );
}

function TokenReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-1.5">
      <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
        Copy this token now — it will not be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono break-all">{token}</code>
        <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={copy}>
          <Copy className="size-3" />
          <span className="sr-only">Copy</span>
        </Button>
      </div>
      {copied && <p className="text-xs text-green-600">Copied!</p>}
    </div>
  );
}

function WebhookRow({
  webhook,
  channelId,
  onDeleted,
}: {
  webhook: Webhook;
  channelId: string;
  onDeleted: (id: string) => void;
}) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: (isActive: boolean) =>
      webhooksApi.update(webhook.id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", channelId] }),
  });

  const remove = useMutation({
    mutationFn: () => webhooksApi.remove(webhook.id),
    onSuccess: () => onDeleted(webhook.id),
  });

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{webhook.name}</p>
        <p className="text-xs text-muted-foreground font-mono">{webhook.prefix}…</p>
      </div>
      <Switch
        checked={webhook.isActive}
        onCheckedChange={(v) => toggle.mutate(v)}
        disabled={toggle.isPending}
      />
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:text-destructive"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Delete</span>
      </Button>
    </div>
  );
}

export function ChannelWebhooksDialog({
  channelId,
  trigger,
}: {
  channelId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [newToken, setNewToken] = useState<WebhookCreated | null>(null);
  const qc = useQueryClient();

  const { data: webhooks = [] } = useQuery({
    queryKey: ["webhooks", channelId],
    queryFn: () => webhooksApi.list(channelId),
    enabled: open,
  });

  const handleCreated = (w: WebhookCreated) => {
    setNewToken(w);
    void qc.invalidateQueries({ queryKey: ["webhooks", channelId] });
  };

  const handleDeleted = (id: string) => {
    void qc.invalidateQueries({ queryKey: ["webhooks", channelId] });
    if (newToken?.id === id) setNewToken(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewToken(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WebhookIcon className="size-4" />
            Incoming Webhooks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {newToken && <TokenReveal token={newToken.token} />}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">New webhook</Label>
            <NewWebhookForm channelId={channelId} onCreated={handleCreated} />
          </div>

          {webhooks.length > 0 && (
            <div>
              {webhooks.map((w) => (
                <WebhookRow
                  key={w.id}
                  webhook={w}
                  channelId={channelId}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )}

          {webhooks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No webhooks yet. Create one to post messages from external services.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
