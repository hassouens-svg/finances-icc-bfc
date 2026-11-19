import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { adminClient } from "@/lib/appwrite/server";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Jeton à usage unique stocké (haché) dans les préférences Appwrite de l'utilisateur. */
export async function issuePasswordToken(userId: string, kind: "invite" | "reset", hours = kind === "invite" ? 24 * 7 : 2) {
  const { users } = adminClient();
  const token = randomToken();
  const prefs = (await users.getPrefs({ userId })) as Record<string, unknown>;
  await users.updatePrefs({ userId, prefs: { ...prefs, pwdTokenHash: sha256(token), pwdTokenExp: Date.now() + hours * 3600_000, pwdTokenKind: kind } });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/${kind === "invite" ? "invitation" : "reinitialiser"}?u=${encodeURIComponent(userId)}&t=${token}`;
}

export async function consumePasswordToken(userId: string, token: string) {
  const { users } = adminClient();
  const prefs = (await users.getPrefs({ userId })) as Record<string, unknown>;
  if (!prefs.pwdTokenHash || prefs.pwdTokenHash !== sha256(token) || Number(prefs.pwdTokenExp) < Date.now()) return false;
  await users.updatePrefs({ userId, prefs: { ...prefs, pwdTokenHash: null, pwdTokenExp: null, pwdTokenKind: null } });
  return true;
}

export async function checkPasswordToken(userId: string, token: string) {
  try {
    const { users } = adminClient();
    const prefs = (await users.getPrefs({ userId })) as Record<string, unknown>;
    return prefs.pwdTokenHash === sha256(token) && Number(prefs.pwdTokenExp) > Date.now();
  } catch {
    return false;
  }
}
