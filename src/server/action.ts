import "server-only";
import { z } from "zod";
import { AppwriteException } from "node-appwrite";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { ActionResult } from "@/lib/action-types";
import { ForbiddenError } from "./context";

export class UserError extends Error {}

/** Enveloppe une Server Action : erreurs lisibles en français, jamais de fuite technique. */
export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return { ok: false, error: e.issues[0]?.message ?? "Formulaire invalide.", fieldErrors };
    }
    if (e instanceof ForbiddenError || e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof AppwriteException) {
      console.error("[appwrite]", e.code, e.type, e.message);
      if (e.code === 401 || e.code === 403) return { ok: false, error: "Accès refusé." };
      if (e.code === 409) return { ok: false, error: "Cet élément existe déjà." };
      return { ok: false, error: "Le serveur n'a pas pu enregistrer. Réessayez dans un instant." };
    }
    console.error(e);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}

/** FormData → objet (champs répétés → tableau quand le nom finit par []) */
export function formToObject(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      ((o[key] as unknown[]) ??= []).push(v);
    } else o[k] = v;
  }
  return o;
}
