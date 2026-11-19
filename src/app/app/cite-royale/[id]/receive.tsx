"use client";
import { PackageCheck } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { FileCapture } from "@/components/detail/client";
import { receiveCrAction } from "@/server/actions/cr";

export function ReceiveDialog({ id }: { id: string }) {
  return (
    <FormDialog trigger={<><PackageCheck /> Enregistrer la réception</>} triggerProps={{ variant: "success" }} title="Réception" description="Montant ou quantité réellement reçus, avec la photo du bon de réception." action={receiveCrAction}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Montant reçu" optional><AmountInput name="received" /></Field>
        <Field label="Quantité reçue" optional><Input name="receivedQuantity" type="number" min={0} inputMode="numeric" /></Field>
        <Field label="Date"><Input name="receivedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
      </div>
      <Checkbox name="full" label="Tout a été reçu (réception totale)" />
      <FileCapture label="Photo du bon de réception" />
      <Field label="Commentaire" optional><Textarea name="comment" /></Field>
    </FormDialog>
  );
}
