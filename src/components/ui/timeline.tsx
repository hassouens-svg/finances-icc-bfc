import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "./badge";

export type TimelineItem = { id: string; date: string; actor?: string | null; status?: string | null; entity?: string; text?: string | null; kind: "status" | "comment" };

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="text-[13px] text-muted">Aucun événement pour l&apos;instant.</p>;
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span className={`absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-bg ${it.kind === "status" ? "bg-accent" : "bg-muted/50"}`} />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {it.kind === "status" && it.status && it.entity ? <StatusBadge entity={it.entity} status={it.status} /> : <span className="font-medium">Commentaire</span>}
            <span className="text-muted">{it.actor ?? "—"} · {formatDateTime(it.date)}</span>
          </div>
          {it.text && <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-surface px-3 py-2 text-[14px]">{it.text}</p>}
        </li>
      ))}
    </ol>
  );
}
