"use client";
import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { saveChargeAction } from "@/server/actions/charges";
import { centsToInput } from "@/lib/format";

type C = { id: string; name: string; categoryId?: string | null; amountCents: number; frequency: string; dueDay: number; sortOrder: number; paymentMethod: string; supplier?: string | null };

export function ChargeDialog({ churchId, categories, charge, nextOrder = 0 }: { churchId: string; categories: { id: string; name: string }[]; charge?: C; nextOrder?: number }) {
  const rent = categories.find((c) => c.name === "Loyer")?.id;
  return (
    <FormDialog trigger={charge ? <Pencil /> : <><Plus /> Charge fixe</>} triggerProps={charge ? { variant: "ghost", size: "icon-sm", "aria-label": "Modifier" } : { variant: "primary" }}
      title={charge ? "Modifier la charge" : "Nouvelle charge fixe"} description="Loyer, électricité, assurance, abonnement… Les charges sont couvertes dans l'ordre de priorité." action={saveChargeAction}>
      <input type="hidden" name="churchId" value={churchId} />
      {charge && <input type="hidden" name="id" value={charge.id} />}
      <Field label="Nom"><Input name="name" defaultValue={charge?.name} placeholder="Loyer de la salle" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Montant"><AmountInput name="amount" defaultValue={centsToInput(charge?.amountCents)} required /></Field>
        <Field label="Fréquence"><Select name="frequency" defaultValue={charge?.frequency ?? "monthly"}><option value="monthly">Tous les mois</option><option value="quarterly">Tous les trimestres</option><option value="yearly">Tous les ans</option></Select></Field>
        <Field label="Catégorie"><Select name="categoryId" defaultValue={charge?.categoryId ?? rent ?? ""}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Jour de paiement" hint="Jour du mois"><Input name="dueDay" type="number" min={1} max={31} defaultValue={charge?.dueDay ?? 5} /></Field>
        <Field label="Fournisseur / bailleur" optional><Input name="supplier" defaultValue={charge?.supplier ?? ""} /></Field>
        <Field label="Mode de paiement"><Select name="paymentMethod" defaultValue={charge?.paymentMethod ?? "bank_transfer"}><option value="bank_transfer">Virement / prélèvement</option><option value="card">Carte</option><option value="cheque">Chèque</option><option value="cash">Espèces</option></Select></Field>
        <Field label="Priorité" hint="1 = payée en premier (ex. le loyer)"><Input name="sortOrder" type="number" min={1} defaultValue={charge?.sortOrder ?? nextOrder + 1} /></Field>
      </div>
    </FormDialog>
  );
}
