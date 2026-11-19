import { Paperclip, FileText } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { formatDate } from "@/lib/format";
import type { Attachment } from "@/lib/types";
import { UploadForm, CommentForm } from "./client";

export function DetailList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-border">
      {items.filter(([, v]) => v !== undefined).map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 py-2.5 text-[14px]">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="min-w-0 text-right font-medium">{v === null || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AttachmentsCard({ items, entityType, entityId, canUpload, token }: { items: Attachment[]; entityType: string; entityId: string; canUpload: boolean; token?: string }) {
  return (
    <Card>
      <CardHeader title="Pièces jointes" description="Justificatifs, devis, photos, bordereaux" />
      <CardBody className="space-y-3">
        {items.length === 0 && <p className="text-[13px] text-muted">Aucune pièce jointe.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((a) => {
            const href = `/api/files/${a.fileId}${token ? `?t=${token}` : ""}`;
            return (
              <a key={a.$id} href={href} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border hover:border-accent/40">
                {a.mime?.startsWith("image/") && a.mime !== "image/heic" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={href} alt={a.name ?? "Pièce jointe"} className="aspect-[4/3] w-full bg-surface object-cover" loading="lazy" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-surface text-muted"><FileText className="size-8" /></div>
                )}
                <p className="truncate px-2 py-1.5 text-[12px]"><Paperclip className="mr-1 inline size-3" />{a.name}</p>
                <p className="px-2 pb-1.5 text-[11px] text-muted">{formatDate(a.$createdAt)}</p>
              </a>
            );
          })}
        </div>
        {canUpload && <UploadForm entityType={entityType} entityId={entityId} />}
      </CardBody>
    </Card>
  );
}

export function HistoryCard({ items, entityType, entityId, canComment }: { items: TimelineItem[]; entityType: string; entityId: string; canComment: boolean }) {
  return (
    <Card>
      <CardHeader title="Historique & commentaires" />
      <CardBody className="space-y-5">
        {canComment && <CommentForm entityType={entityType} entityId={entityId} />}
        <Timeline items={items} />
      </CardBody>
    </Card>
  );
}
