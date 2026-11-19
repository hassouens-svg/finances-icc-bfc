import { z } from "zod";
import { parseEuroToCents, dateInputToIso } from "./format";

export const zText = (label: string, max = 200) => z.string({ error: `${label} est requis.` }).trim().min(1, `${label} est requis.`).max(max, `${label} est trop long.`);
export const zOptText = (max = 2000) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
export const zCents = (label = "Le montant", { allowZero = false } = {}) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const c = parseEuroToCents(v as string);
    if (isNaN(c) || c < 0 || (!allowZero && c === 0)) {
      ctx.addIssue({ code: "custom", message: `${label} n'est pas valide.` });
      return z.NEVER;
    }
    if (c > 100_000_000_00) { ctx.addIssue({ code: "custom", message: `${label} est trop élevé.` }); return z.NEVER; }
    return c;
  });
export const zOptCents = () =>
  z.union([z.string(), z.number()]).optional().transform((v, ctx) => {
    if (v === undefined || v === "") return null;
    const c = parseEuroToCents(v as string);
    if (isNaN(c) || c < 0) { ctx.addIssue({ code: "custom", message: "Montant invalide." }); return z.NEVER; }
    return c;
  });
export const zDate = (label = "La date") =>
  z.string({ error: `${label} est requise.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} est invalide.`).transform(dateInputToIso);
export const zOptDate = () =>
  z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? dateInputToIso(v) : null));
export const zBool = () => z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()]).optional().transform((v) => v === "on" || v === "true" || v === true);
export const zId = () => z.string().trim().max(36).optional().transform((v) => (v ? v : null));
export const zEmail = () => z.string().trim().email("Adresse email invalide.").max(200);
export const zOptEmail = () => z.union([z.literal(""), z.string().trim().email("Adresse email invalide.").max(200)]).optional().transform((v) => (v ? v : null));
