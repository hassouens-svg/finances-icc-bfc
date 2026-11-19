import "server-only";
import { adminClient, Query } from "@/lib/appwrite/server";
import { insert } from "./data";

const APP = () => process.env.APP_URL ?? "http://localhost:3000";

export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }, badge?: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#FAFAFA;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#0A0A0A">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #EAEAEE;border-radius:16px">
<tr><td style="padding:24px 28px 0"><div style="display:inline-block;background:#6D28D9;color:#fff;font-weight:700;border-radius:10px;padding:6px 10px;font-size:13px">ICC BFC</div></td></tr>
<tr><td style="padding:20px 28px 8px"><h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
${badge ? `<span style="display:inline-block;background:#F3EEFF;color:#4C1D95;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600">${badge}</span>` : ""}
<div style="font-size:15px;line-height:1.6;color:#0A0A0A">${bodyHtml}</div></td></tr>
${cta ? `<tr><td style="padding:12px 28px 28px"><a href="${cta.url}" style="display:inline-block;background:#6D28D9;color:#fff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:600;font-size:14px">${cta.label}</a></td></tr>` : ""}
<tr><td style="padding:16px 28px;border-top:1px solid #EAEAEE;color:#6B6B76;font-size:12px">Impact Centre Chrétien — Bourgogne-Franche-Comté · Message automatique</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Envoi d'email. Fournisseur : Resend si RESEND_API_KEY est défini, sinon l'email est seulement journalisé
 * (le branchement définitif des emails est prévu dans une phase ultérieure).
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ICC BFC Finances <onboarding@resend.dev>";
  if (!key) {
    console.info(`[email non envoyé — aucun fournisseur] → ${to} : ${subject}`);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error("email", e);
    return false;
  }
}

/** Notification dans l'app pour une liste d'utilisateurs. */
export async function notifyUsers(userIds: string[], churchId: string, n: { kind: string; title: string; body?: string; link?: string }) {
  const unique = [...new Set(userIds)];
  await Promise.all(
    unique.map((userId) =>
      insert("notifications", churchId, { userId, ...n, link: n.link ?? null, body: n.body ?? null }, {
        permissions: [`read("user:${userId}")`, `update("user:${userId}")`],
      }).catch((e) => console.error("notif", e)),
    ),
  );
}

/** Utilisateurs ayant un des rôles donnés dans l'église (+ admins de l'église mère si demandé). */
export async function usersWithRoles(teamId: string, roles: string[], includeMother = false) {
  const { teams } = adminClient();
  const ids: string[] = [];
  try {
    const m = await teams.listMemberships({ teamId, queries: [Query.limit(100)] });
    for (const x of m.memberships) if (x.confirm && x.roles.some((r) => roles.includes(r))) ids.push(x.userId);
  } catch {}
  if (includeMother) {
    try {
      const m = await teams.listMemberships({ teamId: "eglise-mere", queries: [Query.limit(100)] });
      for (const x of m.memberships) if (x.confirm) ids.push(x.userId);
    } catch {}
  }
  return [...new Set(ids)];
}

export async function emailUsers(userIds: string[], subject: string, html: string) {
  const { users } = adminClient();
  for (const id of userIds) {
    try {
      const u = await users.get({ userId: id });
      if (u.email) await sendEmail({ to: u.email, subject, html });
    } catch {}
  }
}

export function trackingUrl(token: string) {
  return `${APP()}/suivi/${token}`;
}
export function appUrl(path: string) {
  return `${APP()}${path}`;
}

/** Notifie un demandeur public (email si fourni). */
export async function notifyRequester(email: string | null | undefined, subject: string, statusLabel: string, message: string, token: string) {
  if (!email) return;
  await sendEmail({ to: email, subject, html: emailLayout(subject, `<p>${message}</p>`, { label: "Voir le suivi", url: trackingUrl(token) }, statusLabel) });
}
