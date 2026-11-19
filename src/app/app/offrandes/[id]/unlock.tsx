"use client";
import { Unlock } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Textarea } from "@/components/ui/input";
import { unlockOfferingSessionAction } from "@/server/actions/offerings";
import type { ActionResult } from "@/lib/action-types";

const action = async (_: ActionResult | null, fd: FormData) => unlockOfferingSessionAction(fd);

export function UnlockDialog({ id }: { id: string }) {
  return (
    <FormDialog trigger={<><Unlock /> Déverrouiller</>} triggerProps={{ variant: "secondary" }} title="Déverrouiller la séance" description="Action réservée aux administrateurs, tracée dans le journal d'audit. Les écritures de caisse/banque sont retirées jusqu'à la nouvelle validation." action={action} submitLabel="Déverrouiller">
      <input type="hidden" name="id" value={id} />
      <Field label="Motif"><Textarea name="reason" required placeholder="Ex. erreur de saisie sur la dîme de M. X" /></Field>
    </FormDialog>
  );
}
