"use client";
import { Check, Banknote } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FileCapture } from "@/components/detail/client";
import { approveReimbursementAction, payReimbursementAction } from "@/server/actions/expenses";

export function ApproveReimbursementDialog({ id, categories }: { id: string; categories: { id: string; name: string }[] }) {
  return (
    <FormDialog trigger={<><Check /> Valider</>} triggerProps={{ variant: "success" }} title="Valider le remboursement" description="Une dépense liée est créée avec le justificatif et passe par le circuit de validation." action={approveReimbursementAction} submitLabel="Valider">
      <input type="hidden" name="id" value={id} />
      <Field label="Catégorie de la dépense"><Select name="categoryId" required defaultValue={categories.find((c) => c.name === "Achats")?.id ?? ""}><option value="" disabled>Choisir…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Commentaire" optional><Textarea name="comment" /></Field>
    </FormDialog>
  );
}

export function PayReimbursementDialog({ id, wished }: { id: string; wished: string }) {
  return (
    <FormDialog trigger={<><Banknote /> Rembourser</>} triggerProps={{ variant: "success" }} title="Effectuer le remboursement" description="La dépense liée est marquée payée et le demandeur est prévenu." action={payReimbursementAction} submitLabel="Confirmer">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date"><Input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        <Field label="Mode"><Select name="paidMethod" defaultValue={wished === "cash" ? "cash" : "transfer"}><option value="transfer">Virement</option><option value="cash">Espèces</option><option value="cheque">Chèque</option></Select></Field>
      </div>
      <Field label="Coordonnées bancaires du bénéficiaire" optional hint="Champ protégé : chiffré, jamais affiché en clair."><Input name="payeeBankInfo" autoComplete="off" /></Field>
      <FileCapture label="Preuve du paiement (facultatif)" />
    </FormDialog>
  );
}
