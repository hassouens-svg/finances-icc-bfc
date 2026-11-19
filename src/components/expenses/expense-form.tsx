"use client";
import * as React from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { FileCapture } from "@/components/detail/client";
import { saveExpenseAction } from "@/server/actions/expenses";
import { centsToInput, toDateInput } from "@/lib/format";

type Opt = { id: string; name: string; churchId: string };
export type ExpenseInitial = {
  id: string; churchId: string; title: string; categoryId?: string | null; supplier?: string | null; amountCents: number; date: string; paymentMethod: string;
  bankAccountId?: string | null; departmentId?: string | null; projectId?: string | null; isRegularization: boolean; advancedBy?: string | null; regularizationReason?: string | null; notes?: string | null;
};

export function ExpenseForm({ churches, categories, departments, projects, accounts, initial, defaultProjectId }: {
  churches: { id: string; name: string }[]; categories: Opt[]; departments: Opt[]; projects: Opt[]; accounts: Opt[]; initial?: ExpenseInitial; defaultProjectId?: string;
}) {
  const [churchId, setChurchId] = React.useState(initial?.churchId ?? churches[0]?.id ?? "");
  const [method, setMethod] = React.useState(initial?.paymentMethod ?? "bank_transfer");
  const [regul, setRegul] = React.useState(initial?.isRegularization ?? false);
  const f = <T extends Opt>(l: T[]) => l.filter((x) => x.churchId === churchId || x.churchId === "region");
  return (
    <ActionForm action={saveExpenseAction} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="churchId" value={churchId} />
      <div className="space-y-5">
        <Card>
          <CardHeader title="La dépense" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {churches.length > 1 && !initial && (
              <Field label="Église" className="sm:col-span-2"><Select value={churchId} onChange={(e) => setChurchId(e.target.value)}>{churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            )}
            <Field label="Objet" className="sm:col-span-2"><Input name="title" defaultValue={initial?.title} placeholder="Ex. Achat de micros" required /></Field>
            <Field label="Montant"><AmountInput name="amount" defaultValue={centsToInput(initial?.amountCents)} required size="lg" /></Field>
            <Field label="Date de la dépense"><Input name="date" type="date" defaultValue={toDateInput(initial?.date ?? new Date())} required className="h-14" /></Field>
            <Field label="Catégorie"><Select name="categoryId" defaultValue={initial?.categoryId ?? ""} required><option value="" disabled>Choisir…</option>{f(categories).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Fournisseur" optional><Input name="supplier" defaultValue={initial?.supplier ?? ""} /></Field>
            <Field label="Département" optional><Select name="departmentId" defaultValue={initial?.departmentId ?? ""}><option value="">—</option>{f(departments).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Projet / événement" optional><Select name="projectId" defaultValue={initial?.projectId ?? defaultProjectId ?? ""}><option value="">—</option>{f(projects).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Paiement prévu" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Mode de paiement"><Select name="paymentMethod" value={method} onChange={(e) => setMethod(e.target.value)}><option value="bank_transfer">Virement</option><option value="card">Carte</option><option value="cheque">Chèque</option><option value="cash">Espèces (caisse)</option></Select></Field>
            {method !== "cash" && <Field label="Compte bancaire"><Select name="bankAccountId" defaultValue={initial?.bankAccountId ?? ""} required>{f(accounts).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            <div className="sm:col-span-2 rounded-xl border border-border bg-surface p-3.5">
              <Checkbox name="isRegularization" checked={regul} onChange={(e) => setRegul(e.target.checked)} label="Dépense déjà avancée par quelqu'un (régularisation)" />
              {regul && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Avancée par"><Input name="advancedBy" defaultValue={initial?.advancedBy ?? ""} required /></Field>
                  <Field label="Motif (obligatoire)" className="sm:col-span-2"><Textarea name="regularizationReason" defaultValue={initial?.regularizationReason ?? ""} required /></Field>
                  <p className="text-[12px] text-muted sm:col-span-2">Elle suit quand même tout le circuit de validation avant d&apos;être marquée payée.</p>
                </div>
              )}
            </div>
            <Field label="Notes" optional className="sm:col-span-2"><Textarea name="notes" defaultValue={initial?.notes ?? ""} /></Field>
          </CardBody>
        </Card>
        <Card><CardHeader title="Justificatif" /><CardBody><FileCapture label="Photographier la facture ou le ticket" /></CardBody></Card>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardBody className="space-y-2.5 pt-5">
            <p className="text-[13px] text-muted">Le circuit de validation est choisi automatiquement selon le montant, la catégorie et l&apos;église.</p>
            <SubmitButton name="submitNow" value="true" size="lg" className="w-full">Soumettre à validation</SubmitButton>
            <SubmitButton name="submitNow" value="false" variant="secondary" className="w-full">Enregistrer en brouillon</SubmitButton>
          </CardBody>
        </Card>
      </aside>
    </ActionForm>
  );
}
