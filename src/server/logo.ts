import "server-only";
import { ID } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { regionPermissions } from "@/lib/perms";
import { FILES_BUCKET } from "@/lib/schema";
import { UserError } from "./action";

const IMG: Record<string, string> = { ffd8ff: "image/jpeg", "89504e47": "image/png", "52494646": "image/webp" };

/** Enregistre le logo d'une église (JPG/PNG/WEBP, 2 Mo max). Lisible par tous les utilisateurs connectés. */
export async function saveLogo(file: File, previousFileId?: string | null) {
  if (file.size > 2 * 1024 * 1024) throw new UserError("Le logo dépasse 2 Mo.");
  const buf = new Uint8Array(await file.arrayBuffer());
  const head = Array.from(buf.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const mime = Object.entries(IMG).find(([sig]) => head.startsWith(sig))?.[1];
  if (!mime) throw new UserError("Le logo doit être une image JPG, PNG ou WEBP.");
  const ext = mime.split("/")[1]!.replace("jpeg", "jpg");
  const { storage } = adminClient();
  const created = await storage.createFile({ bucketId: FILES_BUCKET, fileId: ID.unique(), file: new File([buf], `logo.${ext}`, { type: mime }), permissions: regionPermissions() });
  if (previousFileId) await storage.deleteFile({ bucketId: FILES_BUCKET, fileId: previousFileId }).catch(() => {});
  return created.$id;
}
