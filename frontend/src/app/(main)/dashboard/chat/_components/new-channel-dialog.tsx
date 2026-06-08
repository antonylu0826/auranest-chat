"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Hash } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { channelsApi } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";
import { useChatActions } from "@/hooks/use-chat-actions";

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(250).optional(),
});
type FormValues = z.infer<typeof schema>;

export function NewChannelDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const { upsertChannel } = useChatStore();
  const { joinChannel } = useChatActions();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    const channel = await channelsApi.create({
      name: values.name,
      description: values.description,
    });
    upsertChannel(channel);
    joinChannel(channel.id);
    reset();
    setOpen(false);
    router.push(`/dashboard/chat/channels/${channel.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Name</Label>
            <div className="relative">
              <Hash className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="ch-name"
                {...register("name")}
                placeholder="e.g. 公告 or announcements"
                className="pl-8"
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="ch-desc"
              {...register("description")}
              placeholder="What's this channel about?"
              className="resize-none h-20 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Channel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
