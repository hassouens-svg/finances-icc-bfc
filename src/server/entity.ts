import "server-only";
import { Query } from "node-appwrite";
import { adminList } from "./data";
import type { Attachment, Comment, StatusHistory } from "@/lib/types";
import type { TimelineItem } from "@/components/ui/timeline";

/** Historique des statuts + commentaires d'un élément, fusionnés dans l'ordre chronologique. */
export async function getTimeline(entityType: string, entityId: string, includeInternal = true): Promise<TimelineItem[]> {
  const [hist, comments] = await Promise.all([
    adminList<StatusHistory>("status_history", [Query.equal("entityType", entityType), Query.equal("entityId", entityId)]),
    adminList<Comment>("comments", [Query.equal("entityType", entityType), Query.equal("entityId", entityId)]),
  ]);
  return [
    ...hist.map((h) => ({ id: h.$id, date: h.$createdAt, actor: h.actorName, status: h.toStatus, entity: entityType, text: h.comment, kind: "status" as const })),
    ...comments.filter((c) => includeInternal || !c.internal).map((c) => ({ id: c.$id, date: c.$createdAt, actor: c.authorName, text: c.body, kind: "comment" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getAttachments(entityType: string, entityId: string) {
  return adminList<Attachment>("attachments", [Query.equal("entityType", entityType), Query.equal("entityId", entityId)]);
}
