"use client";
import * as React from "react";
import { ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select } from "@/components/ui/input";
import { startSessionAction } from "@/server/actions/offerings";

export function StartSessionForm({ churches, services }: { churches: { id: string; name: string }[]; services: { id: string; name: string; churchId: string }[] }) {
  const [churchId, setChurchId] = React.useState(churches[0]?.id ?? "");
  const today = new Date();
  const lastSunday = new Date(today.getTime() - today.getDay() * 86400000).toISOString().slice(0, 10);
  const list = services.filter((s) => s.churchId === "region" || s.churchId === churchId);
  return (
    <ActionForm action={startSessionAction} className="space-y-4">
      {churches.length > 1 ? (
        <Field label="Église"><Select name="churchId" value={churchId} onChange={(e) => setChurchId(e.target.value)}>{churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      ) : <input type="hidden" name="churchId" value={churchId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date du culte"><Input name="date" type="date" defaultValue={lastSunday} required /></Field>
        <Field label="Culte / événement"><Select name="serviceId" defaultValue={list[0]?.id ?? ""}>{list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="">Autre</option></Select></Field>
      </div>
      <SubmitButton size="lg" className="w-full">Commencer la saisie <ArrowRight /></SubmitButton>
    </ActionForm>
  );
}
