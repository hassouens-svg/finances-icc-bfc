import { NextResponse, type NextRequest } from "next/server";
import { Query } from "node-appwrite";
import { adminList, churchById } from "@/server/data";
import { notifyUsers, usersWithRoles, emailUsers, emailLayout, appUrl } from "@/server/notify";
import { getSettings } from "@/server/lookups";
import { computeBalances } from "@/lib/finance";
import { currentRole } from "@/lib/workflow";
import { formatEuro } from "@/lib/format";
import type { BankAccount, CashMovement, Church, Expense } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Tâches planifiées (Vercel Cron, voir vercel.json) — protégées par CRON_SECRET.
 *  - rappels des validations en retard
 *  - alerte « caisse à déposer »
 *  - lundi : résumé hebdomadaire régional à l'église mère
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getSettings();
  const out = { reminders: 0, cash: 0, summary: false };
  const late = await adminList<Expense>("expenses", [Query.equal("status", "in_approval"), Query.equal("archived", false)]);
  for (const e of late) {
    const role = currentRole(e);
    if (!role || !e.stepStartedAt) continue;
    const delay = 72 * 3600_000;
    if (Date.now() - new Date(e.stepStartedAt).getTime() < delay) continue;
    const church = await churchById(e.churchId);
    const ids = role === "mother_admin" ? await usersWithRoles("eglise-mere", ["admin"]) : await usersWithRoles(church.teamId, [role]);
    await notifyUsers(ids, e.churchId, { kind: "reminder", title: `Rappel : dépense à valider (${formatEuro(e.amountCents)})`, body: `${e.title} — ${church.name}`, link: `/app/depenses/${e.$id}` });
    await emailUsers(ids, `Rappel : une dépense attend votre validation`, emailLayout("Validation en retard", `<p><b>${e.title}</b> — ${formatEuro(e.amountCents)} (${church.name})</p>`, { label: "Valider", url: appUrl(`/app/depenses/${e.$id}`) }));
    out.reminders++;
  }
  const churches = await adminList<Church>("churches", [Query.equal("active", true)]);
  const [movs, accounts] = await Promise.all([adminList<CashMovement>("cash_movements", [Query.select(["churchId", "account", "direction", "amountCents", "date"])], ), adminList<BankAccount>("bank_accounts", [])]);
  const lines: string[] = [];
  for (const c of churches) {
    const b = computeBalances(movs.filter((m) => m.churchId === c.$id), accounts.filter((a) => a.churchId === c.$id));
    lines.push(`<tr><td>${c.name}</td><td align="right">${formatEuro(b.cash)}</td><td align="right">${formatEuro(b.total)}</td></tr>`);
    if (b.cash > settings.cashMaxCents) {
      const ids = await usersWithRoles(c.teamId, ["treasurer"]);
      await notifyUsers(ids, c.$id, { kind: "cash", title: `Caisse à déposer : ${formatEuro(b.cash)}`, body: "Le plafond de caisse est dépassé.", link: "/app/depots/nouveau" });
      out.cash++;
    }
  }
  if (new Date().getUTCDay() === 1) {
    const admins = await usersWithRoles("eglise-mere", ["admin"]);
    await emailUsers(admins, "Résumé hebdomadaire de la région", emailLayout("Résumé de la semaine", `<table width="100%" style="font-size:14px"><tr><th align="left">Église</th><th align="right">En caisse</th><th align="right">Trésorerie</th></tr>${lines.join("")}</table>`, { label: "Ouvrir le tableau de bord", url: appUrl("/app") }));
    out.summary = true;
  }
  return NextResponse.json(out);
}
