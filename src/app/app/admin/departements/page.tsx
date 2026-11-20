import { Network } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, pickChurch } from "@/server/context";
import { adminList } from "@/server/data";
import { listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { DepartmentDialog } from "@/components/admin/forms";
import { ActionButton } from "@/components/action-form";
import { archiveRowAction } from "@/server/actions/admin";
import type { Department, Expense } from "@/lib/types";

export const metadata = { title: "Départements" };

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const { church, allowed } = pickChurch(ctx, (await searchParams).church, true, "parametres");
  if (!church) return <EmptyState icon={<Network />} title="Aucune église gérable" />;
  const year = new Date().getUTCFullYear();
  const [deps, expenses] = await Promise.all([
    adminList<Department>("departments", [Query.equal("churchId", church.$id), Query.orderAsc("name")]),
    listScoped<Expense>(ctx, "expenses", [Query.equal("status", "paid"), Query.greaterThanEqual("date", `${year}-01-01`), Query.select(["$id", "departmentId", "amountCents"])], [church.$id]),
  ]);
  const spent = (id: string) => expenses.filter((e) => e.departmentId === id).reduce((a, e) => a + e.amountCents, 0);
  return (
    <>
      <PageHeader back={{ href: "/app/admin", label: "Administration" }} title="Départements" description={`${church.name} · budgets ${year}`} actions={<DepartmentDialog churchId={church.$id} />} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/admin/departements" />
      {deps.length === 0 ? (
        <EmptyState icon={<Network />} title="Aucun département" description="Ajoutez la louange, l'accueil, la jeunesse, les enfants, les médias…" action={<DepartmentDialog churchId={church.$id} />} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {deps.map((d) => (
            <Card key={d.$id} className={`p-4 ${d.archived ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-[15px] font-medium">{d.name}{d.archived && <Badge tone="neutral" dot={false}>Archivé</Badge>}</p>
                  <p className="text-[13px] text-muted">{d.leaderName ?? "Responsable non renseigné"}{d.leaderEmail ? ` · ${d.leaderEmail}` : ""}</p>
                </div>
                <div className="flex">
                  <DepartmentDialog churchId={church.$id} dep={{ id: d.$id, name: d.name, leaderName: d.leaderName, leaderEmail: d.leaderEmail, annualBudgetCents: d.annualBudgetCents }} />
                  <ActionButton variant="ghost" size="sm" action={archiveRowAction} payload={{ table: "departments", id: d.$id }} confirm={d.archived ? undefined : "Archiver ce département ?"}>{d.archived ? "Restaurer" : "Archiver"}</ActionButton>
                </div>
              </div>
              {d.annualBudgetCents ? <Gauge className="mt-4" used={spent(d.$id)} total={d.annualBudgetCents} /> : <p className="mt-3 text-[13px] text-muted">Pas de budget annuel défini.</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
