"use client";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { saveSettingsAction } from "@/server/actions/admin";
import { centsToInput } from "@/lib/format";
import type { Settings } from "@/server/lookups";

export function SettingsForm({ s }: { s: Settings }) {
  return (
    <ActionForm action={saveSettingsAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plafond « En caisse »" hint="Alerte si l'argent non déposé dépasse ce montant."><AmountInput name="cashMax" defaultValue={centsToInput(s.cashMaxCents)} /></Field>
        <Field label="Argent en caisse depuis plus de" hint="jours sans dépôt"><Input name="cashMaxDays" type="number" min={1} defaultValue={s.cashMaxDays} /></Field>
        <Field label="Demande Cité Royale « En attente » depuis plus de" hint="jours"><Input name="crPendingDays" type="number" min={1} defaultValue={s.crPendingDays} /></Field>
        <Field label="Église sans saisie d'offrande depuis" hint="jours"><Input name="noOfferingDays" type="number" min={1} defaultValue={s.noOfferingDays} /></Field>
        <Field label="Conservation des données donateurs" hint="années (RGPD)"><Input name="donorRetentionYears" type="number" min={1} defaultValue={s.donorRetentionYears} /></Field>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <Checkbox name="fiscalReceipts" defaultChecked={s.fiscalReceipts} label="Activer les reçus fiscaux annuels (PDF)" />
        <p className="mt-1.5 pl-7 text-[13px] text-muted">À activer seulement après validation de la conformité (association cultuelle habilitée, mentions obligatoires).</p>
      </div>
      <SubmitButton>Enregistrer</SubmitButton>
    </ActionForm>
  );
}
