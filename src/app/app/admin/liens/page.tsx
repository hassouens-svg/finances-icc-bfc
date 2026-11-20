import QRCode from "qrcode";
import { Link2 } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, pickChurch } from "@/server/context";
import { adminList } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { PublicLinkDialog } from "@/components/admin/forms";
import { ActionButton } from "@/components/action-form";
import { togglePublicLinkAction } from "@/server/actions/admin";
import { CopyButton, ShareButton } from "@/components/copy-button";
import { formatDate } from "@/lib/format";
import type { Department, PublicLink } from "@/lib/types";

export const metadata = { title: "Liens publics" };

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const { church, allowed } = pickChurch(ctx, (await searchParams).church, true, "parametres");
  if (!church) return <EmptyState icon={<Link2 />} title="Aucune église gérable" />;
  const [links, deps] = await Promise.all([
    adminList<PublicLink>("public_links", [Query.equal("churchId", church.$id), Query.orderDesc("$createdAt")]),
    adminList<Department>("departments", [Query.equal("churchId", church.$id), Query.equal("archived", false)]),
  ]);
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const rows = await Promise.all(
    links.map(async (l) => {
      const url = `${base}/p/${l.token}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 512, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
      return { l, url, qr };
    }),
  );
  return (
    <>
      <PageHeader
        back={{ href: "/app/admin", label: "Administration" }}
        title="Liens publics & QR codes"
        description="Les responsables de départements et les membres soumettent un besoin ou un remboursement sans compte."
        actions={<PublicLinkDialog churchId={church.$id} departments={deps.map((d) => ({ value: d.$id, label: d.name }))} />}
      />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/admin/liens" />
      {rows.length === 0 ? (
        <EmptyState icon={<Link2 />} title="Aucun lien public" description="Créez un lien « Besoins » et un lien « Remboursements » à partager dans les groupes WhatsApp." action={<PublicLinkDialog churchId={church.$id} departments={deps.map((d) => ({ value: d.$id, label: d.name }))} />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ l, url, qr }) => {
            const expired = l.expiresAt && new Date(l.expiresAt) < new Date();
            return (
              <Card key={l.$id} className={`flex gap-4 p-4 ${!l.active || expired ? "opacity-70" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`QR code du lien ${l.label ?? ""}`} className="size-24 shrink-0 rounded-xl border border-border" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="progress" dot={false}>{l.kind === "funding" ? "Besoins" : "Remboursements"}</Badge>
                    {l.departmentId && <Badge tone="neutral" dot={false}>{deps.find((d) => d.$id === l.departmentId)?.name}</Badge>}
                    {!l.active ? <Badge tone="neutral">Désactivé</Badge> : expired ? <Badge tone="waiting">Expiré</Badge> : <Badge tone="positive">Actif</Badge>}
                  </div>
                  <p className="truncate text-[14px] font-medium">{l.label || (l.kind === "funding" ? "Formulaire des besoins" : "Formulaire de remboursement")}</p>
                  <p className="truncate font-mono text-[12px] text-muted">{url}</p>
                  <p className="text-[12px] text-muted">{l.submissionsCount} envoi(s){l.expiresAt ? ` · expire le ${formatDate(l.expiresAt)}` : ""}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <CopyButton value={url} label="Copier le lien" variant="primary" />
                    <ShareButton url={url} title={l.kind === "funding" ? "Formulaire des besoins" : "Demande de remboursement"} />
                    <a href={qr} download={`qr-${l.kind}-${church.slug}.png`} className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-surface">QR code</a>
                    <ActionButton size="sm" variant="ghost" action={togglePublicLinkAction} payload={{ id: l.$id }}>{l.active ? "Désactiver" : "Activer"}</ActionButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
