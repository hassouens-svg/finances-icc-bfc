"use client";
import * as React from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendInviteAction } from "@/server/actions/admin";

export function ResendInviteButton({ userId }: { userId: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const fd = new FormData();
          fd.set("userId", userId);
          const r = await resendInviteAction(fd);
          if (r.ok && r.data?.link) {
            await navigator.clipboard.writeText(String(r.data.link)).catch(() => {});
            toast.success("Nouveau lien d'invitation copié dans le presse-papiers.");
          } else if (!r.ok) toast.error(r.error);
        })
      }
    >
      <Copy /> Lien d&apos;invitation
    </Button>
  );
}
