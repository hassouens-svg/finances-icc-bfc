"use server";
import { cookies } from "next/headers";
import { adminClient, IDENTITY_COOKIE } from "@/lib/appwrite/server";
import { decodeIdentity, getCurrentUser } from "../auth";

/** JWT court (15 min), lié à la session de l'utilisateur, pour écouter Appwrite Realtime avec SES droits. */
export async function realtimeJwtAction(): Promise<string | null> {
  if (!(await getCurrentUser())) return null;
  const id = decodeIdentity((await cookies()).get(IDENTITY_COOKIE)?.value);
  if (!id) return null;
  try {
    return (await adminClient().users.createJWT({ userId: id.userId, sessionId: id.sessionId, duration: 900 })).jwt;
  } catch {
    return null;
  }
}
