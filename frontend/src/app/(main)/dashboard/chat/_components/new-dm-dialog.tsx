"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { usersApi, type User } from "@/lib/api";
import { dmsApi } from "@/lib/chat-api";
import { useChatStore } from "@/stores/chat/chat-store";
import { useChatActions } from "@/hooks/use-chat-actions";
import { useCurrentUser } from "@/hooks/use-current-user";

export function NewDmDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { upsertDm } = useChatStore();
  const { joinDm } = useChatActions();

  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      try {
        const result = await usersApi.list({ limit: 100 });
        setUsers(result.data.filter((u) => u.id !== currentUser?.sub && u.isActive));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, currentUser?.sub]);

  const handleSelect = async (userId: string) => {
    setStarting(userId);
    try {
      const dm = await dmsApi.getOrCreate(userId);
      upsertDm(dm);
      joinDm(dm.id);
      setOpen(false);
      router.push(`/dashboard/chat/dms/${dm.id}`);
    } finally {
      setStarting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="p-0 gap-0 max-w-sm">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-semibold">New Direct Message</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search users…" className="h-9" />
          <CommandList className="max-h-60">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.name ?? ""} ${user.email}`}
                      onSelect={() => void handleSelect(user.id)}
                      disabled={starting === user.id}
                      className="cursor-pointer"
                    >
                      <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-medium shrink-0">
                        {(user.name ?? user.email)[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        {user.name && <span className="text-sm truncate">{user.name}</span>}
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      </div>
                      {starting === user.id && (
                        <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
