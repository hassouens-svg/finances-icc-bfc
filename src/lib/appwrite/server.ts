import "server-only";
import { Client, TablesDB, Users, Teams, Storage, Account, Query, type Models } from "node-appwrite";
import { cookies } from "next/headers";
import { DATABASE_ID } from "@/lib/schema";
import type { Row } from "@/lib/types";

export const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
export const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
export const SESSION_COOKIE = "icc_s";
export const IDENTITY_COOKIE = "icc_u";

/** Client « administrateur » (clé API serveur). À n'utiliser qu'après contrôle des droits. */
export function adminClient() {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(process.env.APPWRITE_API_KEY!);
  return {
    client,
    db: new TablesDB(client),
    users: new Users(client),
    teams: new Teams(client),
    storage: new Storage(client),
    account: new Account(client),
  };
}

/**
 * Client « au nom de l'utilisateur » : Appwrite applique les permissions de ligne.
 * Toutes les lectures de données d'église passent par lui → cloisonnement garanti par Appwrite.
 */
export async function userClient() {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (!secret) throw new Error("Session absente");
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setSession(secret);
  return { client, db: new TablesDB(client), storage: new Storage(client) };
}

type AnyRow = Row & Record<string, unknown>;

/** Liste toutes les lignes correspondant aux requêtes (pagination par curseur). */
export async function listAll<T extends Row = AnyRow>(db: TablesDB, tableId: string, queries: string[] = [], max = 5000): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  const hasLimit = queries.some((q) => q.includes('"limit"'));
  while (out.length < max) {
    const q = [...queries];
    if (!hasLimit) q.push(Query.limit(500));
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await db.listRows({ databaseId: DATABASE_ID, tableId, queries: q, total: false });
    const rows = res.rows as unknown as T[];
    out.push(...rows);
    if (hasLimit || rows.length < 500) break;
    cursor = rows[rows.length - 1]!.$id;
  }
  return out;
}

export async function listPage<T extends Row = AnyRow>(db: TablesDB, tableId: string, queries: string[]): Promise<{ rows: T[]; total: number }> {
  const res = await db.listRows({ databaseId: DATABASE_ID, tableId, queries });
  return { rows: res.rows as unknown as T[], total: res.total };
}

export async function getRow<T extends Row = AnyRow>(db: TablesDB, tableId: string, rowId: string): Promise<T | null> {
  try {
    return (await db.getRow({ databaseId: DATABASE_ID, tableId, rowId })) as unknown as T;
  } catch (e) {
    if ((e as { code?: number }).code === 404) return null;
    throw e;
  }
}

export type AppwriteUser = Models.User<Models.Preferences>;
export { Query, DATABASE_ID };
