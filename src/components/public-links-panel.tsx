import QRCode from "qrcode";
import { Query } from "node-appwrite";
import { Link2, QrCode } from "lucide-react";
import { canManage, type AppContext } from "@/server/context";
import { adminList } from "@/server/data";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LinkBox } from "@/components/copy-button";
import { ActionButton } from "@/components/action-form";
import { quickPublicLinkAction } from "@/server/actions/admin";
import type { PublicLink } from "@/lib/types";

/**
 * Le lien public à partager, directement sur l'écran du module (Besoins ou Remboursements) :
 * copier, partager, WhatsApp, QR code — ou création en un clic s'il n'existe pas encore.
 */
export async function PublicLinksPanel({ ctx, kind }: { ctx: AppContext; kind: "funding" | "reimbursement" }) {
  const churches = ctx.churches.filter((c) => ctx.scopeIds.includes(c.$id) && canManage(ctx, c.$id));
  if (!churches.length) return null;
  const links = await adminList<PublicLink>("public_links", [Query.equal("churchId", churches.map((c) => c.$id)), Query.equal("kind", kind), Query.equal("active", true)]);
  const base = process.env.APP_URL ?? "";
  const label = kind === "funding" ? "besoins" : "remboursements";
  const text = kind === "funding"
    ? "Bonjour, pour exprimer un besoin de votre département (matériel, financement…), remplissez ce formulaire :"
    : "Bonjour, pour demander le remboursement d'une dépense faite pour l'église (photo du ticket obligatoire) :";
  const rows = await Promise.all(churches.map(async (c) => {
    const l = links.find((x) => x.churchId === c.$id && !x.departmentId && !(x.expiresAt && new Date(x.expiresAt) < new Date()));
    const url = l ? `${base}/p/${l.token}` : null;
    return { c, url, qr: url ? await QRCode.toDataURL(url, { margin: 1, width: 400 }) : null };
  }));
  return (
    <Card className="mb-6 border-accent/25">
      <CardHeader
        title={<span className="flex items-center gap-2"><Link2 className="size-4 text-accent" /> Lien à partager ({label})</span>}
        description="Les personnes remplissent le formulaire sur leur téléphone, sans compte, puis suivent leur demande avec leur lien personnel."
      />
      <CardBody className="space-y-4">
        {rows.map(({ c, url, qr }) => (
          <div key={c.$id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {churches.length > 1 && <p className="w-40 shrink-0 text-[14px] font-medium">{c.name}</p>}
            {url ? (
              <>
                <LinkBox url={url} title={`${c.name} — ${label}`} text={text} className="min-w-0 flex-1" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={qr!} download={`qr-${label}-${c.slug}.png`} className="hidden shrink-0 sm:block" title="Télécharger le QR code"><img src={qr!} alt={`QR code ${label} ${c.name}`} className="size-20 rounded-lg border border-border" /></a>
                <a href={qr!} download={`qr-${label}-${c.slug}.png`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent sm:hidden"><QrCode className="size-4" /> Télécharger le QR code</a>
              </>
            ) : (
              <ActionButton action={quickPublicLinkAction} payload={{ churchId: c.$id, kind }}>Créer le lien {label}</ActionButton>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
