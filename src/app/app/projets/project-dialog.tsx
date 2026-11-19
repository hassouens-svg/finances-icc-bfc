"use client";
import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input, Textarea, Select } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { saveProjectAction } from "@/server/actions/expenses";
import { centsToInput, toDateInput } from "@/lib/format";

type P = { id: string; name: string; description?: string | null; budgetCents: number; startDate?: string | null; endDate?: string | null; ownerName?: string | null; status: string; milestones: { label: string; done: boolean }[] };

export function ProjectDialog({ churchId, project }: { churchId: string; project?: P }) {
  return (
    <FormDialog trigger={project ? <><Pencil /> Modifier</> : <><Plus /> Nouveau projet</>} triggerProps={{ variant: project ? "secondary" : "primary" }} title={project ? "Modifier le projet" : "Nouveau projet / événement"} action={saveProjectAction} wide>
      <input type="hidden" name="churchId" value={churchId} />
      {project && <input type="hidden" name="id" value={project.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" className="sm:col-span-2"><Input name="name" defaultValue={project?.name} required /></Field>
        <Field label="Budget prévu"><AmountInput name="budget" defaultValue={centsToInput(project?.budgetCents ?? 0)} /></Field>
        <Field label="Responsable" optional><Input name="ownerName" defaultValue={project?.ownerName ?? ""} /></Field>
        <Field label="Début" optional><Input name="startDate" type="date" defaultValue={toDateInput(project?.startDate)} /></Field>
        <Field label="Fin" optional><Input name="endDate" type="date" defaultValue={toDateInput(project?.endDate)} /></Field>
        <Field label="Statut"><Select name="status" defaultValue={project?.status ?? "active"}><option value="planned">Prévu</option><option value="active">En cours</option><option value="done">Terminé</option><option value="cancelled">Annulé</option></Select></Field>
        <Field label="Description" optional className="sm:col-span-2"><Textarea name="description" defaultValue={project?.description ?? ""} /></Field>
        <Field label="Jalons" optional hint="Un par ligne. Préfixez par [x] un jalon terminé." className="sm:col-span-2">
          <Textarea name="milestones" defaultValue={project?.milestones.map((m) => `${m.done ? "[x] " : ""}${m.label}`).join("\n")} placeholder={"[x] Réservation de la salle\nCommunication"} />
        </Field>
      </div>
    </FormDialog>
  );
}
