import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <AuthShell>
      <h1 className="text-[28px] font-semibold tracking-tight">Bon retour 👋</h1>
      <p className="mb-8 mt-1.5 text-[15px] text-muted">Connectez-vous pour accéder aux finances de votre église.</p>
      <LoginForm />
      <p className="mt-8 text-center text-[13px] text-muted">Pas de compte ? Demandez une invitation au trésorier de l&apos;église mère.</p>
    </AuthShell>
  );
}
