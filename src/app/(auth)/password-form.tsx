"use client";
import { ActionForm, SubmitButton, useFieldError } from "@/components/action-form";
import { Field, Input } from "@/components/ui/input";
import { setPasswordAction } from "@/server/actions/auth";

function Fields() {
  const err = useFieldError("confirm");
  const errP = useFieldError("password");
  return (
    <>
      <Field label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum." error={errP}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirmer le mot de passe" htmlFor="confirm" error={err}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
    </>
  );
}

export function PasswordForm({ u, t, cta }: { u: string; t: string; cta: string }) {
  return (
    <ActionForm action={setPasswordAction} className="space-y-4">
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="t" value={t} />
      <Fields />
      <SubmitButton size="lg" className="w-full">{cta}</SubmitButton>
    </ActionForm>
  );
}
