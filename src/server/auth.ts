import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient, SESSION_COOKIE, IDENTITY_COOKIE, type AppwriteUser } from "@/lib/appwrite/server";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET manquant ou trop court");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function encodeIdentity(userId: string, sessionId: string) {
  const v = `${userId}.${sessionId}`;
  return `${v}.${sign(v)}`;
}

export function decodeIdentity(token: string | undefined): { userId: string; sessionId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, sessionId, sig] = parts as [string, string, string];
  const expected = sign(`${userId}.${sessionId}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, sessionId };
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookies(secret: string, userId: string, sessionId: string, expire: string) {
  const store = await cookies();
  const expires = new Date(expire);
  store.set(SESSION_COOKIE, secret, { ...cookieOpts, expires });
  store.set(IDENTITY_COOKIE, encodeIdentity(userId, sessionId), { ...cookieOpts, expires });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(IDENTITY_COOKIE);
}

/**
 * Utilisateur courant. L'identité est signée côté serveur puis la session est vérifiée auprès d'Appwrite
 * (existence et expiration) à chaque requête — une session révoquée dans Appwrite déconnecte immédiatement.
 */
export const getCurrentUser = cache(async (): Promise<AppwriteUser | null> => {
  const store = await cookies();
  const id = decodeIdentity(store.get(IDENTITY_COOKIE)?.value);
  if (!id || !store.get(SESSION_COOKIE)?.value) return null;
  const { users } = adminClient();
  try {
    const [user, sessions] = await Promise.all([users.get({ userId: id.userId }), users.listSessions({ userId: id.userId })]);
    const s = sessions.sessions.find((x) => x.$id === id.sessionId);
    if (!s || new Date(s.expire).getTime() < Date.now() || !user.status) return null;
    return user;
  } catch {
    return null;
  }
});
