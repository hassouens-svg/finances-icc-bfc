"use client";
import * as React from "react";
import { Check, ArrowRightLeft } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { decideFundingAction, convertFundingAction } from "@/server/actions/expenses";
import { centsToInput } from "@/lib/format";

export function ApproveFundingDialog({ id, estimated }: { id: string; estimated: number }) {
  return (
    <FormDialog trigger={<><Check /> Approuver</>} triggerProps={{ variant: "success" }} title="Approuver le besoin" description="Un montant inférieur à l'estimation = approbation partielle (commentaire obligatoire)." action={decideFundingAction} submitLabel="Approuver">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value="approved" />
      <Field label="Montant approuvé"><AmountInput name="approved" defaultValue={centsToInput(estimated)} required /></Field>
      <Field label="Commentaire" optional><Textarea name="comment" /></Field>
    </FormDialog>
  );
}

export function ConvertFundingDialog({ id, categories }: { id: string; categories: { id: string; name: string }[] }) {
  const [target, setTarget] = React.useState("expense");
  return (
    <FormDialog trigger={<><ArrowRightLeft /> Convertir</>} triggerProps={{ variant: "primary" }} title="Convertir le besoin" description="En un clic, créez la dépense ou la demande à la Cité Royale correspondante." action={convertFundingAction} submitLabel="Convertir">
      <input type="hidden" name="id" value={id} />
      <Field label="Convertir en"><Select name="target" value={target} onChange={(e) => setTarget(e.target.value)}><option value="expense">Dépense de l&apos;église</option><option value="cr">Demande à la Cité Royale</option></Select></Field>
      {target === "expense" && <Field label="Catégorie"><Select name="categoryId">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
    </FormDialog>
  );
}
