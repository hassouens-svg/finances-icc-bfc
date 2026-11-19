import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const key = () => Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? "", "hex");

/** AES-256-GCM pour les coordonnées bancaires saisies par le trésorier. */
export function encrypt(text: string) {
  const k = key();
  if (k.length !== 32) throw new Error("DATA_ENCRYPTION_KEY invalide (64 caractères hexadécimaux attendus).");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}
export function decrypt(payload: string) {
  const [, iv, tag, data] = payload.split(".");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv!, "base64url"));
  d.setAuthTag(Buffer.from(tag!, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data!, "base64url")), d.final()]).toString("utf8");
}
export function mask(text: string) {
  return text.length <= 4 ? "••••" : `•••• ${text.slice(-4)}`;
}
