"use client";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui/input";
import { changePasswordAction } from "@/server/actions/auth";

export function PasswordChange() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
      <Field label="Nouveau mot de passe" hint="10 caractères minimum."><Input name="password" type="password" minLength={10} autoComplete="new-password" required /></Field>
      <SubmitButton>Mettre à jour</SubmitButton>
    </ActionForm>
  );
}
