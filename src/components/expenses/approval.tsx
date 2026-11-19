"use client";
import * as React from "react";
import { Check, X, MessageCircleQuestion, Banknote } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Textarea, Field, Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormDialog } from "@/components/form-dialog";
import { FileCapture } from "@/components/detail/client";
import { decideExpenseAction, payExpenseAction } from "@/server/actions/expenses";

/** Trois gros boutons, utilisables d'un pouce sur téléphone. */
export function ApprovalButtons({ id, compact }: { id: string; compact?: boolean }) {
  const [mode, setMode] = React.useState<null | "rejected" | "info_requested">(null);
  return (
    <>
      <div className={compact ? "grid grid-cols-3 gap-2" : "grid gap-2 sm:grid-cols-3"}>
        <ActionForm action={decideExpenseAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approved" />
          <SubmitButton variant="success" size="lg" className="w-full"><Check /> Approuver</SubmitButton>
        </ActionForm>
        <Button variant="danger-soft" size="lg" onClick={() => setMode("rejected")}><X /> Refuser</Button>
        <Button variant="secondary" size="lg" onClick={() => setMode("info_requested")}><MessageCircleQuestion /> <span className={compact ? "sr-only sm:not-sr-only" : ""}>Précision</span></Button>
      </div>
      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent title={mode === "rejected" ? "Refuser la dépense" : "Demander une précision"}>
          <ActionForm action={decideExpenseAction} onSuccess={() => setMode(null)} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value={mode ?? ""} />
            <Textarea name="comment" required placeholder={mode === "rejected" ? "Motif du refus" : "Quelle précision attendez-vous ?"} autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode(null)}>Annuler</Button>
              <SubmitButton variant={mode === "rejected" ? "danger" : "primary"}>{mode === "rejected" ? "Refuser" : "Envoyer"}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PayDialog({ id, method, accounts, bankAccountId }: { id: string; method: string; accounts: { id: string; name: string }[]; bankAccountId?: string | null }) {
  return (
    <FormDialog trigger={<><Banknote /> Marquer payée</>} triggerProps={{ variant: "success" }} title="Marquer la dépense comme payée" description="Le circuit de validation est terminé : la caisse ou la banque est débitée." action={payExpenseAction} submitLabel="Confirmer le paiement">
      <input type="hidden" name="id" value={id} />
      <Field label="Date du paiement"><Input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
      {method !== "cash" && <Field label="Compte débité"><Select name="bankAccountId" defaultValue={bankAccountId ?? ""}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
      <FileCapture label="Preuve de paiement (facultatif)" />
    </FormDialog>
  );
}
