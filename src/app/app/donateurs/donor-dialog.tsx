"use client";
import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input } from "@/components/ui/input";
import { saveDonorAction } from "@/server/actions/offerings";

export function DonorDialog({ churchId, donor }: { churchId: string; donor?: { id: string; fullName: string; email?: string | null; phone?: string | null; address?: string | null } }) {
  return (
    <FormDialog trigger={donor ? <><Pencil /> Modifier</> : <><Plus /> Donateur</>} triggerProps={{ variant: donor ? "secondary" : "primary" }} title={donor ? "Modifier la fiche" : "Nouveau donateur"} description="Ne collectez que le strict nécessaire." action={saveDonorAction}>
      <input type="hidden" name="churchId" value={churchId} />
      {donor && <input type="hidden" name="id" value={donor.id} />}
      <Field label="Nom complet"><Input name="fullName" defaultValue={donor?.fullName} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" optional><Input name="email" type="email" defaultValue={donor?.email ?? ""} /></Field>
        <Field label="Téléphone" optional><Input name="phone" type="tel" defaultValue={donor?.phone ?? ""} /></Field>
      </div>
      <Field label="Adresse" optional hint="Utile uniquement pour un reçu fiscal."><Input name="address" defaultValue={donor?.address ?? ""} /></Field>
    </FormDialog>
  );
}
