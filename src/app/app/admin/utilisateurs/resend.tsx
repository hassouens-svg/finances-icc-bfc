"use client";
import * as React from "react";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LinkBox } from "@/components/copy-button";
import { resendInviteAction } from "@/server/actions/admin";

/** Génère un nouveau lien d'invitation et l'affiche avec Copier / Partager / WhatsApp. */
export function ResendInviteButton({ userId }: { userId: string }) {
  const [pending, start] = React.useTransition();
  const [link, setLink] = React.useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
        const fd = new FormData();
        fd.set("userId", userId);
        const r = await resendInviteAction(fd);
        if (r.ok && r.data?.link) setLink(String(r.data.link));
        else if (!r.ok) toast.error(r.error);
      })}>
        {pending ? <Loader2 className="animate-spin" /> : <Link2 />} Lien d&apos;invitation
      </Button>
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent title="Lien d'invitation" description="Valable 7 jours. Envoyez-le à la personne : elle choisira son mot de passe.">
          {link && <LinkBox url={link} title="Votre accès à ICC BFC Finances" text="Bonjour, voici le lien pour activer votre compte ICC BFC Finances :" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
