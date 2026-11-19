import Link from "next/link";
import { Query } from "node-appwrite";
import { Bell } from "lucide-react";
import { requireContext } from "@/server/context";
import { adminList } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/action-form";
import { markNotificationsReadAction } from "@/server/actions/common";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireContext();
  const items = await adminList<AppNotification>("notifications", [Query.equal("userId", ctx.user.id), Query.orderDesc("$createdAt"), Query.limit(100)]);
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} non lue(s)` : "Tout est lu"} actions={unread ? <ActionButton variant="secondary" action={markNotificationsReadAction}>Tout marquer comme lu</ActionButton> : undefined} />
      {items.length === 0 ? <EmptyState icon={<Bell />} title="Aucune notification" description="Vous serez prévenu ici des validations à faire, nouvelles demandes et rappels." /> : (
        <Card className="divide-y divide-border">
          {items.map((n) => (
            <Link key={n.$id} href={n.link ?? "#"} className={cn("flex items-start gap-3 px-4 py-3.5 hover:bg-surface sm:px-5", !n.readAt && "bg-accent-soft/40")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} />
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{n.title}</span>{n.body && <span className="block text-[13px] text-muted">{n.body}</span>}</span>
              <span className="shrink-0 text-[12px] text-muted">{formatDateTime(n.$createdAt)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
