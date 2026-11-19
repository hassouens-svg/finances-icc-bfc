"use client";
import * as React from "react";
import { ActionForm, SubmitButton, useFieldError } from "@/components/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { FileCapture } from "@/components/detail/client";
import { submitFundingAction, submitReimbursementAction } from "@/server/actions/public";

function F({ name, ...p }: { name: string; label: string; hint?: string; optional?: boolean; children: React.ReactNode; className?: string }) {
  return <Field {...p} htmlFor={name} error={useFieldError(name)} />;
}

export function PublicForm({ token, kind, churchName, departments, fixedDepartment }: { token: string; kind: "funding" | "reimbursement"; churchName: string; departments: { id: string; name: string }[]; fixedDepartment?: string }) {
  const [startedAt] = React.useState(() => Date.now());
  return (
    <ActionForm action={kind === "funding" ? submitFundingAction : submitReimbursementAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden"><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <Card><CardBody className="space-y-4 pt-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Vous</p>
        <F name="requesterName" label="Nom et prénom"><Input id="requesterName" name="requesterName" autoComplete="name" required /></F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F name="requesterEmail" label="Email" hint="Pour recevoir le suivi"><Input id="requesterEmail" name="requesterEmail" type="email" autoComplete="email" inputMode="email" /></F>
          <F name="requesterPhone" label="Téléphone"><Input id="requesterPhone" name="requesterPhone" type="tel" autoComplete="tel" inputMode="tel" /></F>
        </div>
        {fixedDepartment ? <p className="rounded-xl bg-accent-soft px-3 py-2 text-[14px] text-accent-strong">Département : <b>{fixedDepartment}</b></p> : (
          <F name="departmentId" label="Département" optional={kind === "reimbursement"}>
            <Select id="departmentId" name="departmentId" defaultValue="" required={kind === "funding"}>
              <option value="">{kind === "funding" ? "Choisir…" : "—"}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </F>
        )}
      </CardBody></Card>

      <Card><CardBody className="space-y-4 pt-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">{kind === "funding" ? "Le besoin" : "La dépense"}</p>
        {kind === "funding" ? (
          <>
            <F name="title" label="Titre du besoin"><Input id="title" name="title" placeholder="Ex. Pupitres pour la louange" required /></F>
            <F name="description" label="Description" optional><Textarea id="description" name="description" placeholder="À quoi cela va servir, pourquoi maintenant…" /></F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F name="estimated" label="Montant estimé"><AmountInput id="estimated" name="estimated" required size="lg" /></F>
              <F name="wishedDate" label="Date souhaitée" optional><Input id="wishedDate" name="wishedDate" type="date" className="h-14" /></F>
            </div>
            <F name="priority" label="Priorité">
              <Select id="priority" name="priority" defaultValue="normal"><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></Select>
            </F>
            <F name="files" label="Devis ou photos" optional><FileCapture label="Ajouter un devis ou une photo" /></F>
          </>
        ) : (
          <>
            <F name="reason" label="Motif de la dépense"><Textarea id="reason" name="reason" placeholder="Ex. Achat de fournitures pour l'école du dimanche" required /></F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F name="amount" label="Montant"><AmountInput id="amount" name="amount" required size="lg" /></F>
              <F name="expenseDate" label="Date de la dépense"><Input id="expenseDate" name="expenseDate" type="date" max={new Date().toISOString().slice(0, 10)} required className="h-14" /></F>
            </div>
            <F name="wishedMethod" label="Remboursement souhaité" hint="Vos coordonnées bancaires ne sont jamais demandées ici : le trésorier vous contactera.">
              <Select id="wishedMethod" name="wishedMethod" defaultValue="transfer"><option value="transfer">Virement</option><option value="cash">Espèces</option><option value="other">Autre</option></Select>
            </F>
            <F name="files" label="Justificatif (obligatoire)"><FileCapture required label="Photographier le ticket ou la facture" /></F>
          </>
        )}
      </CardBody></Card>

      <label className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4 text-[13px] text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]" />
        <span>J&apos;accepte que {churchName} utilise ces informations uniquement pour traiter ma demande. Elles sont conservées le temps nécessaire à la comptabilité de l&apos;église. Je peux demander leur suppression au trésorier (RGPD).</span>
      </label>
      <SubmitButton size="lg" className="w-full">Envoyer ma demande</SubmitButton>
    </ActionForm>
  );
}
