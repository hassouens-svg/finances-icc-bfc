"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Select } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { saveBudgetAction } from "@/server/actions/accounting";

export function BudgetDialog({ churchId, year, categories, departments }: { churchId: string; year: number; categories: { id: string; name: string }[]; departments: { id: string; name: string }[] }) {
  const [scope, setScope] = React.useState("category");
  const list = scope === "category" ? categories : departments;
  return (
    <FormDialog trigger={<><Plus /> Ligne de budget</>} title={`Budget ${year}`} description="Si la ligne existe déjà, son montant est remplacé." action={saveBudgetAction}>
      <input type="hidden" name="churchId" value={churchId} />
      <input type="hidden" name="year" value={year} />
      <Field label="Par"><Select name="scope" value={scope} onChange={(e) => setScope(e.target.value)}><option value="category">Catégorie de dépense</option><option value="department">Département</option></Select></Field>
      <Field label={scope === "category" ? "Catégorie" : "Département"}><Select name="scopeId" required>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      <Field label="Montant prévu sur l'année"><AmountInput name="planned" required /></Field>
    </FormDialog>
  );
}
