"use client";
import { CheckCheck } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { confirmDepositAction } from "@/server/actions/deposits";
import { centsToInput } from "@/lib/format";

export function ConfirmDepositDialog({ id, expected }: { id: string; expected: number }) {
  return (
    <FormDialog trigger={<><CheckCheck /> Confirmer sur le relevé</>} title="Confirmer sur le relevé bancaire" description="Indiquez le montant réellement crédité. Un écart est signalé et ajusté en banque." action={confirmDepositAction} submitLabel="Confirmer">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Montant crédité"><AmountInput name="confirmed" defaultValue={centsToInput(expected)} required /></Field>
        <Field label="Date de valeur"><Input name="valueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
      </div>
      <Field label="Commentaire" optional hint="Obligatoire en cas d'écart."><Textarea name="comment" /></Field>
    </FormDialog>
  );
}
