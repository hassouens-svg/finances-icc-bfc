"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui/input";
import { requestResetAction } from "@/server/actions/auth";
import { AuthShell } from "../auth-shell";

export default function ForgotPage() {
  return (
    <AuthShell>
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><ChevronLeft className="size-4" />Retour à la connexion</Link>
      <h1 className="text-[26px] font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-muted">Indiquez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
      <ActionForm action={requestResetAction} className="space-y-4" resetOnSuccess>
        <Field label="Adresse email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton size="lg" className="w-full">Envoyer le lien</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
