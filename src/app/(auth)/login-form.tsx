"use client";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui/input";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <Field label="Adresse email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="prenom.nom@exemple.fr" />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••••" />
      </Field>
      <div className="flex justify-end">
        <Link href="/mot-de-passe-oublie" className="text-[13px] font-medium text-accent hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <SubmitButton size="lg" className="w-full">Se connecter</SubmitButton>
    </ActionForm>
  );
}
