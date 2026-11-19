import { NextResponse, type NextRequest } from "next/server";
import { Query } from "node-appwrite";
import { getContext, canRead } from "@/server/context";
import { adminClient } from "@/lib/appwrite/server";
import { adminList } from "@/server/data";
import { ENTITY_TABLE } from "@/server/files";
import { FILES_BUCKET } from "@/lib/schema";
import type { Attachment } from "@/lib/types";

export const runtime = "nodejs";

/** Sert une pièce jointe après contrôle des droits (membre de l'église, ou jeton de suivi du demandeur). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const att = (await adminList<Attachment>("attachments", [Query.equal("fileId", id), Query.limit(5)]))[0];
  if (!att) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const ctx = await getContext();
  let allowed = !!ctx && canRead(ctx, att.churchId);
  const t = req.nextUrl.searchParams.get("t");
  if (!allowed && t && ["reimbursement", "funding_request"].includes(att.entityType)) {
    const table = ENTITY_TABLE[att.entityType]!;
    const rows = await adminList(table, [Query.equal("trackingToken", t), Query.equal("$id", att.entityId), Query.limit(1)]);
    allowed = rows.length > 0;
  }
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const buf = await adminClient().storage.getFileView({ bucketId: FILES_BUCKET, fileId: id });
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mime ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(att.name ?? "fichier")}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
