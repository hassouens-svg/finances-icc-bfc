"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppwriteException, Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { setSessionCookies, clearSessionCookies, decodeIdentity, getCurrentUser } from "../auth";
import { IDENTITY_COOKIE } from "@/lib/appwrite/server";
import { VIEW_COOKIE, getContext } from "../context";
import { run, UserError } from "../action";
import { issuePasswordToken, consumePasswordToken } from "../tokens";
import { sendEmail, emailLayout } from "../notify";
import type { ActionResult } from "@/lib/action-types";

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email("Adresse email invalide."), password: z.string().min(1, "Mot de passe requis.") });

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const { email, password } = loginSchema.parse(Object.fromEntries(fd));
    const { account } = adminClient();
    try {
      const s = await account.createEmailPasswordSession({ email, password });
      await setSessionCookies(s.secret, s.userId, s.$id, s.expire);
    } catch (e) {
      if (e instanceof AppwriteException && (e.code === 401 || e.code === 400)) throw new UserError("Email ou mot de passe incorrect.");
      if (e instanceof AppwriteException && e.code === 429) throw new UserError("Trop de tentatives. Patientez quelques minutes.");
      throw e;
    }
  });
  if (!res.ok) return res;
  redirect("/app");
}

export async function logoutAction() {
  const store = await cookies();
  const id = decodeIdentity(store.get(IDENTITY_COOKIE)?.value);
  if (id) {
    try {
      await adminClient().users.deleteSession({ userId: id.userId, sessionId: id.sessionId });
    } catch {}
  }
  await clearSessionCookies();
  redirect("/");
}

export async function setViewAction(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: "Session expirée." };
  const view = String(fd.get("view") ?? "");
  if (view === "all" ? !ctx.isRegional : !ctx.churches.some((c) => c.$id === view)) return { ok: false, error: "Vue non autorisée." };
  (await cookies()).set(VIEW_COOKIE, view, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}

export async function requestResetAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const email = z.string().trim().toLowerCase().email("Adresse email invalide.").parse(fd.get("email"));
    const { users } = adminClient();
    const list = await users.list({ queries: [Query.equal("email", email), Query.limit(1)] });
    const u = list.users[0];
    if (u && u.status) {
      const link = await issuePasswordToken(u.$id, "reset");
      await sendEmail({
        to: email,
        subject: "Réinitialiser votre mot de passe — ICC BFC Finances",
        html: emailLayout("Réinitialiser votre mot de passe", `<p>Bonjour ${u.name || ""},</p><p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 2 heures.</p>`, { label: "Choisir un mot de passe", url: link }),
      });
    }
    return { ok: true, message: "Si un compte existe pour cette adresse, un email vient d'être envoyé." };
  });
}

const pwdSchema = z
  .object({ u: z.string().min(1), t: z.string().min(10), password: z.string().min(10, "10 caractères minimum."), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Les deux mots de passe ne correspondent pas.", path: ["confirm"] });

export async function setPasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const d = pwdSchema.parse(Object.fromEntries(fd));
    if (!(await consumePasswordToken(d.u, d.t))) throw new UserError("Ce lien n'est plus valide. Demandez-en un nouveau.");
    const { users, account } = adminClient();
    await users.updatePassword({ userId: d.u, password: d.password });
    await users.updateEmailVerification({ userId: d.u, emailVerification: true });
    const user = await users.get({ userId: d.u });
    const s = await account.createEmailPasswordSession({ email: user.email, password: d.password });
    await setSessionCookies(s.secret, s.userId, s.$id, s.expire);
  });
  if (!res.ok) return res;
  redirect("/app");
}

export async function changePasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UserError("Session expirée.");
    const password = z.string().min(10, "10 caractères minimum.").parse(fd.get("password"));
    await adminClient().users.updatePassword({ userId: user.$id, password });
    return { ok: true, message: "Mot de passe modifié." };
  });
}
