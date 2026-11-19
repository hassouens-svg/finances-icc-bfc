import { Query } from "node-appwrite";
import { requireContext } from "@/server/context";
import { listScoped, adminList } from "@/server/data";
import { REGION } from "@/lib/schema";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Col } from "@/components/data/data-table";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

export const metadata = { title: "Journal d'audit" };

const ACTIONS: Record<string, string> = {
  create: "Création", update: "Modification", delete: "Suppression", validate: "Validation", status: "Changement de statut", lock: "Verrouillage",
  unlock: "Déverrouillage", invite: "Invitation", archive: "Archivage", restore: "Restauration", approve: "Approbation", reject: "Refus",
  pay: "Paiement", disable: "Désactivation", enable: "Réactivation", public_submit: "Envoi public", anonymize: "Anonymisation", import: "Import",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const ids = sp.church && ctx.scopeIds.includes(sp.church) ? [sp.church] : ctx.scopeIds;
  const [logs, regionLogs] = await Promise.all([
    listScoped<AuditLog>(ctx, "audit_logs", [Query.orderDesc("$createdAt"), Query.limit(1000)], ids),
    ctx.isRegional ? adminList<AuditLog>("audit_logs", [Query.equal("churchId", REGION), Query.orderDesc("$createdAt"), Query.limit(300)]) : Promise.resolve([]),
  ]);
  const all = [...logs, ...regionLogs].sort((a, b) => b.$createdAt.localeCompare(a.$createdAt));
  const columns: Col[] = [
    { key: "when", label: "Date", mobileSecondary: true },
    { key: "actor", label: "Qui", type: "strong", mobileSecondary: true },
    { key: "action", label: "Action", type: "badge" },
    { key: "summary", label: "Détail", mobilePrimary: true },
    { key: "church", label: "Église", type: "muted" },
  ];
  const rows = all.map((l) => ({
    id: l.$id, when: formatDateTime(l.$createdAt), actor: l.actorName ?? "—", action: ACTIONS[l.action] ?? l.action, summary: l.summary ?? l.entityType,
    church: l.churchId === REGION ? "Région" : ctx.allChurches.find((c) => c.$id === l.churchId)?.name ?? "—",
  }));
  return (
    <>
      <PageHeader back={{ href: "/app/admin", label: "Administration" }} title="Journal d'audit" description="Toutes les créations, modifications, validations et suppressions sont tracées." />
      <DataTable columns={columns} rows={rows} pageSize={50} filters={[{ key: "action", label: "Action", options: [...new Set(rows.map((r) => r.action))].map((a) => ({ value: a, label: a })) }]} />
    </>
  );
}
