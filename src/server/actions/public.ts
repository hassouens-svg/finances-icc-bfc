"use server";
import { z } from "zod";
import { Query } from "node-appwrite";
import { run, UserError, formToObject } from "../action";
import { insert, patch, audit, recordStatus, churchReference, adminList, adminGet, churchById } from "../data";
import { saveFiles } from "../files";
import { rateLimit } from "../ratelimit";
import { randomToken } from "../tokens";
import { notifyUsers, usersWithRoles, notifyRequester, trackingUrl } from "../notify";
import { zText, zCents, zOptText, zOptEmail, zOptDate, zId } from "@/lib/zod";
import { PRIORITIES } from "@/lib/schema";
import { formatEuro } from "@/lib/format";
import type { ActionResult } from "@/lib/action-types";
import type { PublicLink, Department } from "@/lib/types";

async function checkLink(token: string, kind: PublicLink["kind"]) {
  const link = (await adminList<PublicLink>("public_links", [Query.equal("token", token), Query.limit(1)]))[0];
  if (!link || !link.active || link.kind !== kind || (link.expiresAt && new Date(link.expiresAt) < new Date())) throw new UserError("Ce lien n'est plus actif. Demandez un nouveau lien à votre trésorier.");
  const church = await churchById(link.churchId);
  if (!church.active) throw new UserError("Ce lien n'est plus actif.");
  return { link, church };
}

function antiBot(raw: Record<string, unknown>) {
  if (raw.website) throw new UserError("Envoi refusé.");
  const started = Number(raw.startedAt);
  if (!started || Date.now() - started < 3000) throw new UserError("Envoi trop rapide : vérifiez le formulaire puis réessayez.");
}

const requester = {
  requesterName: zText("Votre nom", 160),
  requesterEmail: zOptEmail(),
  requesterPhone: z.string().trim().max(40).optional().transform((v) => v || null),
  consent: z.literal("on", { error: "Merci d'accepter l'utilisation de vos données pour traiter la demande." }),
};

export async function submitFundingAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const raw = formToObject(fd);
    antiBot(raw);
    const token = String(raw.token ?? "");
    if (!(await rateLimit(`pub:${token}`))) throw new UserError("Trop d'envois depuis cet appareil. Réessayez dans quelques minutes.");
    const { link, church } = await checkLink(token, "funding");
    const d = z.object({
      ...requester, departmentId: zId(), title: zText("Le titre du besoin", 200), description: zOptText(4000), estimated: zCents("Le montant estimé"),
      wishedDate: zOptDate(), priority: z.enum(PRIORITIES).default("normal"),
    }).parse(raw);
    if (!d.requesterEmail && !d.requesterPhone) throw new UserError("Indiquez un email ou un téléphone pour être recontacté.");
    const depId = link.departmentId ?? d.departmentId;
    if (depId) {
      const dep = await adminGet<Department>("departments", depId);
      if (!dep || dep.churchId !== church.$id) throw new UserError("Département inconnu.");
    }
    const trackingToken = randomToken(24);
    const reference = await churchReference(church.$id, "BES");
    const row = await insert("funding_requests", church.$id, {
      reference, publicLinkId: link.$id, requesterName: d.requesterName, requesterEmail: d.requesterEmail, requesterPhone: d.requesterPhone, departmentId: depId,
      title: d.title, description: d.description, estimatedCents: d.estimated, wishedDate: d.wishedDate, priority: d.priority, status: "received", trackingToken,
    });
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length) await saveFiles(files.slice(0, 6), church.$id, "funding_request", row.$id, d.requesterName);
    await recordStatus({ name: d.requesterName }, church.$id, "funding_request", row.$id, null, "received");
    await patch("public_links", link.$id, { submissionsCount: link.submissionsCount + 1 });
    await audit(null, church.$id, "public_submit", "funding_request", row.$id, `Besoin ${reference} reçu de ${d.requesterName} (${formatEuro(d.estimated)})`);
    const treasurers = await usersWithRoles(church.teamId, ["treasurer"]);
    await notifyUsers(treasurers, church.$id, { kind: "funding", title: `Nouveau besoin : ${d.title}`, body: `${d.requesterName} · ${formatEuro(d.estimated)}`, link: `/app/besoins/${row.$id}` });
    await notifyRequester(d.requesterEmail, `Besoin ${reference} bien reçu`, "Reçu", `Bonjour ${d.requesterName}, votre besoin « ${d.title} » a bien été transmis à ${church.name}. Vous serez prévenu à chaque étape.`, trackingToken);
    return { ok: true, redirect: `${trackingUrl(trackingToken).replace(/^https?:\/\/[^/]+/, "")}?nouveau=1` };
  });
}

export async function submitReimbursementAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const raw = formToObject(fd);
    antiBot(raw);
    const token = String(raw.token ?? "");
    if (!(await rateLimit(`pub:${token}`))) throw new UserError("Trop d'envois depuis cet appareil. Réessayez dans quelques minutes.");
    const { link, church } = await checkLink(token, "reimbursement");
    const d = z.object({
      ...requester, departmentId: zId(), reason: zText("Le motif", 2000), expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de la dépense invalide."),
      amount: zCents(), wishedMethod: z.enum(["transfer", "cash", "other"]),
    }).parse(raw);
    if (!d.requesterEmail && !d.requesterPhone) throw new UserError("Indiquez un email ou un téléphone pour être recontacté.");
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new UserError("La photo du justificatif (ticket, facture, reçu) est obligatoire.");
    if (d.departmentId) {
      const dep = await adminGet<Department>("departments", d.departmentId);
      if (!dep || dep.churchId !== church.$id) throw new UserError("Département inconnu.");
    }
    const trackingToken = randomToken(24);
    const reference = await churchReference(church.$id, "RMB");
    const row = await insert("reimbursements", church.$id, {
      reference, requesterName: d.requesterName, requesterEmail: d.requesterEmail, requesterPhone: d.requesterPhone, departmentId: d.departmentId, reason: d.reason,
      expenseDate: new Date(`${d.expenseDate}T12:00:00Z`).toISOString(), amountCents: d.amount, wishedMethod: d.wishedMethod, status: "submitted", trackingToken,
    });
    await saveFiles(files.slice(0, 8), church.$id, "reimbursement", row.$id, d.requesterName);
    await recordStatus({ name: d.requesterName }, church.$id, "reimbursement", row.$id, null, "submitted");
    await patch("public_links", link.$id, { submissionsCount: link.submissionsCount + 1 });
    await audit(null, church.$id, "public_submit", "reimbursement", row.$id, `Remboursement ${reference} demandé par ${d.requesterName} (${formatEuro(d.amount)})`);
    const treasurers = await usersWithRoles(church.teamId, ["treasurer"]);
    await notifyUsers(treasurers, church.$id, { kind: "reimbursement", title: `Nouvelle demande de remboursement`, body: `${d.requesterName} · ${formatEuro(d.amount)}`, link: `/app/remboursements/${row.$id}` });
    await notifyRequester(d.requesterEmail, `Demande ${reference} bien reçue`, "Soumise", `Bonjour ${d.requesterName}, votre demande de remboursement de ${formatEuro(d.amount)} a bien été transmise à ${church.name}.`, trackingToken);
    return { ok: true, redirect: `/suivi/${trackingToken}?nouveau=1` };
  });
}
