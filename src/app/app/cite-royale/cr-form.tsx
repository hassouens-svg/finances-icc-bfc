"use client";
import * as React from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { FileCapture } from "@/components/detail/client";
import { saveCrAction } from "@/server/actions/cr";
import { centsToInput, toDateInput } from "@/lib/format";

type Opt = { id: string; name: string; churchId: string };
export type CrInitial = { id: string; churchId: string; title: string; typeId?: string | null; reason?: string | null; description?: string | null; quantity?: number | null; estimatedCents?: number | null; priority: string; wishedDate?: string | null; departmentId?: string | null; contactName?: string | null; sendChannel?: string | null; crReference?: string | null; viaMother: boolean };

export function CrForm({ churches, types, departments, initial }: { churches: { id: string; name: string; isMother: boolean }[]; types: Opt[]; departments: Opt[]; initial?: CrInitial }) {
  const [churchId, setChurchId] = React.useState(initial?.churchId ?? churches[0]?.id ?? "");
  const isMother = churches.find((c) => c.id === churchId)?.isMother;
  const f = (l: Opt[]) => l.filter((x) => x.churchId === churchId || x.churchId === "region");
  return (
    <ActionForm action={saveCrAction} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="churchId" value={churchId} />
      <div className="space-y-5">
        <Card>
          <CardHeader title="La demande" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {churches.length > 1 && !initial && <Field label="Église" className="sm:col-span-2"><Select value={churchId} onChange={(e) => setChurchId(e.target.value)}>{churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
            <Field label="Objet" className="sm:col-span-2"><Input name="title" defaultValue={initial?.title} required placeholder="Ex. 60 chaises pour la nouvelle salle" /></Field>
            <Field label="Type"><Select name="typeId" defaultValue={initial?.typeId ?? ""}><option value="">—</option>{f(types).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Priorité"><Select name="priority" defaultValue={initial?.priority ?? "normal"}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></Select></Field>
            <Field label="Motif / justification" className="sm:col-span-2"><Textarea name="reason" defaultValue={initial?.reason ?? ""} required /></Field>
            <Field label="Description" optional className="sm:col-span-2"><Textarea name="description" defaultValue={initial?.description ?? ""} /></Field>
            <Field label="Quantité" optional><Input name="quantity" type="number" min={0} inputMode="numeric" defaultValue={initial?.quantity ?? ""} /></Field>
            <Field label="Montant estimé" optional><AmountInput name="estimated" defaultValue={centsToInput(initial?.estimatedCents)} /></Field>
            <Field label="Date souhaitée" optional><Input name="wishedDate" type="date" defaultValue={toDateInput(initial?.wishedDate)} /></Field>
            <Field label="Département concerné" optional><Select name="departmentId" defaultValue={initial?.departmentId ?? ""}><option value="">—</option>{f(departments).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Suivi de l'envoi" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact interne responsable" optional><Input name="contactName" defaultValue={initial?.contactName ?? ""} /></Field>
            <Field label="Canal d'envoi" optional><Input name="sendChannel" defaultValue={initial?.sendChannel ?? ""} placeholder="Email, formulaire, courrier…" /></Field>
            <Field label="Référence de la Cité Royale" optional className="sm:col-span-2"><Input name="crReference" defaultValue={initial?.crReference ?? ""} /></Field>
            <div className="sm:col-span-2"><FileCapture label="Devis, photos (facultatif)" /></div>
          </CardBody>
        </Card>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card><CardBody className="space-y-3 pt-5">
          {!isMother && <Checkbox name="viaMother" defaultChecked={initial?.viaMother ?? true} label="Passer par l'église mère (validation avant envoi)" />}
          <SubmitButton name="submitNow" value="true" size="lg" className="w-full">Lancer la demande</SubmitButton>
          <SubmitButton name="submitNow" value="false" variant="secondary" className="w-full">Enregistrer en brouillon</SubmitButton>
        </CardBody></Card>
      </aside>
    </ActionForm>
  );
}
