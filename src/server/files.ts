import "server-only";
import { ID } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { churchPermissions } from "@/lib/perms";
import { FILES_BUCKET } from "@/lib/schema";
import { insert, churchById } from "./data";
import { UserError } from "./action";

export const ENTITY_TABLE: Record<string, string> = {
  reimbursement: "reimbursements",
  funding_request: "funding_requests",
  cr_request: "cr_requests",
  expense: "expenses",
  deposit: "deposits",
  offering_session: "offering_sessions",
  project: "projects",
};

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const MAX = 10 * 1024 * 1024;

function sniff(buf: Uint8Array) {
  const h = Array.from(buf.slice(0, 12)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (h.startsWith("ffd8ff")) return "image/jpeg";
  if (h.startsWith("89504e47")) return "image/png";
  if (h.startsWith("25504446")) return "application/pdf";
  if (h.startsWith("52494646") && h.slice(16, 24) === "57454250") return "image/webp";
  if (h.slice(8, 16) === "66747970") return "image/heic";
  return null;
}

/** Enregistre des fichiers (contrôle du type réel et du poids) et les rattache à un élément. */
export async function saveFiles(files: File[], churchId: string, entityType: string, entityId: string, uploadedBy: string) {
  const church = await churchById(churchId);
  const { storage } = adminClient();
  const saved: string[] = [];
  for (const f of files) {
    if (!f || typeof f === "string" || f.size === 0) continue;
    if (f.size > MAX) throw new UserError(`« ${f.name} » dépasse 10 Mo.`);
    const buf = new Uint8Array(await f.arrayBuffer());
    const mime = sniff(buf);
    if (!mime || !ALLOWED_MIME.includes(mime)) throw new UserError(`« ${f.name} » : format non accepté (photo JPG/PNG/WEBP/HEIC ou PDF).`);
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1]!.replace("jpeg", "jpg");
    const safeName = (f.name || `fichier.${ext}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const file = new File([buf], safeName.includes(".") ? safeName : `${safeName}.${ext}`, { type: mime });
    const created = await storage.createFile({ bucketId: FILES_BUCKET, fileId: ID.unique(), file, permissions: churchPermissions(church) });
    await insert("attachments", churchId, { entityType, entityId, fileId: created.$id, bucket: FILES_BUCKET, name: file.name, mime, size: f.size, uploadedBy });
    saved.push(created.$id);
  }
  return saved;
}

