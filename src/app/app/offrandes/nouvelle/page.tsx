import Link from "next/link";
import { Query } from "node-appwrite";
import { HandCoins, ChevronRight } from "lucide-react";
import { requireContext } from "@/server/context";
import { listScoped } from "@/server/data";
import { getLookups } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StartSessionForm } from "./start-form";
import { manageableChurches } from "../form-data";
import { formatDate, formatEuro } from "@/lib/format";
import type { OfferingSession } from "@/lib/types";

export const metadata = { title: "Saisir des offrandes" };

export default async function NewSession() {
  const ctx = await requireContext();
  const churches = manageableChurches(ctx);
  if (!churches.length) return <EmptyState icon={<HandCoins />} title="Vous n'avez pas les droits de saisie" description="Seuls les trésoriers peuvent saisir des offrandes." />;
  const ids = churches.map((c) => c.$id);
  const [lk, drafts] = await Promise.all([getLookups(ids.join(",")), listScoped<OfferingSession>(ctx, "offering_sessions", [Query.equal("status", "draft"), Query.orderDesc("date")], ids)]);
  return (
    <>
      <PageHeader module={4} help="offrandes" back={{ href: "/app/offrandes", label: "Dons & offrandes" }} title="Saisir des offrandes" description="Choisissez le culte, puis saisissez les enveloppes une par une : tout s'enregistre au fur et à mesure." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Nouvelle séance" description="Une séance = un culte (dimanche, mi-semaine, événement…)." />
          <CardBody>
            <StartSessionForm churches={churches.map((c) => ({ id: c.$id, name: c.name }))} services={lk.services.map((s) => ({ id: s.$id, name: s.name, churchId: s.churchId }))} />
          </CardBody>
        </Card>
        {drafts.length > 0 && (
          <Card>
            <CardHeader title="Saisies en cours" description="Reprenez là où vous vous êtes arrêté." />
            <ul className="divide-y divide-border border-t border-border">
              {drafts.map((d) => (
                <li key={d.$id}>
                  <Link href={`/app/offrandes/${d.$id}/saisie`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                    <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{d.serviceName ?? "Culte"} du {formatDate(d.date)}</span><span className="block text-[12px] text-muted">{ctx.allChurches.find((c) => c.$id === d.churchId)?.name} · {d.reference}</span></span>
                    <span className="num text-[14px] font-semibold">{formatEuro(d.enteredTotalCents)}</span>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
