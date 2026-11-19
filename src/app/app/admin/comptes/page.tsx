import { Landmark } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, pickChurch } from "@/server/context";
import { adminList } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { BankAccountDialog } from "@/components/admin/forms";
import { ActionButton } from "@/components/action-form";
import { archiveRowAction } from "@/server/actions/admin";
import { formatEuro, formatDate } from "@/lib/format";
import type { BankAccount } from "@/lib/types";

export const metadata = { title: "Comptes bancaires" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const { church, allowed } = pickChurch(ctx, (await searchParams).church);
  if (!church) return <EmptyState icon={<Landmark />} title="Aucune église gérable" />;
  const accounts = await adminList<BankAccount>("bank_accounts", [Query.equal("churchId", church.$id), Query.orderAsc("label")]);
  return (
    <>
      <PageHeader back={{ href: "/app/admin", label: "Administration" }} title="Comptes bancaires" description={church.name} actions={<BankAccountDialog churchId={church.$id} />} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/admin/comptes" />
      {accounts.length === 0 ? (
        <EmptyState icon={<Landmark />} title="Aucun compte bancaire" description="Ajoutez le compte sur lequel sont faits les dépôts et les virements." action={<BankAccountDialog churchId={church.$id} />} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a.$id} className={`flex items-center gap-4 p-4 ${a.archived ? "opacity-60" : ""}`}>
              <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent"><Landmark className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[15px] font-medium">{a.label}{a.archived && <Badge tone="neutral" dot={false}>Archivé</Badge>}</p>
                <p className="text-[13px] text-muted">{[a.bankName, a.ibanMasked].filter(Boolean).join(" · ") || "—"}</p>
                <p className="num text-[12px] text-muted">Solde de départ {formatEuro(a.openingBalanceCents)} au {formatDate(a.openingDate)}</p>
              </div>
              <BankAccountDialog churchId={church.$id} acc={{ id: a.$id, label: a.label, bankName: a.bankName, ibanMasked: a.ibanMasked, openingBalanceCents: a.openingBalanceCents, openingDate: a.openingDate }} />
              <ActionButton variant="ghost" size="sm" action={archiveRowAction} payload={{ table: "bank_accounts", id: a.$id }}>{a.archived ? "Restaurer" : "Archiver"}</ActionButton>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
