import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { PasswordForm } from "../password-form";
import { checkPasswordToken } from "@/server/tokens";

export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string; t?: string }> }) {
  const { u = "", t = "" } = await searchParams;
  const valid = u && t ? await checkPasswordToken(u, t) : false;
  return (
    <AuthShell>
      <h1 className="text-[26px] font-semibold tracking-tight">Bienvenue !</h1>
      {valid ? (
        <>
          <p className="mb-8 mt-1.5 text-[15px] text-muted">Choisissez votre mot de passe pour activer votre compte.</p>
          <PasswordForm u={u} t={t} cta="Activer mon compte" />
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5 text-[14px]">
          <p className="font-medium">Ce lien n&apos;est plus valide.</p>
          <p className="mt-1 text-muted">Il a peut-être expiré ou déjà été utilisé. Demandez un nouveau lien à votre administrateur ou utilisez « Mot de passe oublié ».</p>
          <Link href="/mot-de-passe-oublie" className="mt-4 inline-block font-medium text-accent">Recevoir un nouveau lien →</Link>
        </div>
      )}
    </AuthShell>
  );
}
