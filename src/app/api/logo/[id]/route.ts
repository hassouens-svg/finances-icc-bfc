import { NextResponse } from "next/server";
import { adminClient } from "@/lib/appwrite/server";
import { adminGet } from "@/server/data";
import { FILES_BUCKET } from "@/lib/schema";
import type { Church } from "@/lib/types";

export const runtime = "nodejs";

/** Logo d'une église (public : affiché sur la page de connexion et les formulaires publics). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let church: Church | null = null;
  if (id === "mother") {
    const { getAllChurches } = await import("@/server/context");
    church = (await getAllChurches()).churches.find((c) => c.isMother) ?? null;
  } else church = await adminGet<Church>("churches", id).catch(() => null);
  if (!church?.logoFileId) return new NextResponse(null, { status: 404 });
  const { storage } = adminClient();
  const [file, buf] = await Promise.all([
    storage.getFile({ bucketId: FILES_BUCKET, fileId: church.logoFileId }),
    storage.getFileView({ bucketId: FILES_BUCKET, fileId: church.logoFileId }),
  ]);
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=300, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" },
  });
}
