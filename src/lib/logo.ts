/** URL du logo d'une église (null si aucun logo). Le suffixe force le rafraîchissement après changement. */
export function logoUrl(c: { $id: string; logoFileId?: string | null } | null | undefined) {
  return c?.logoFileId ? `/api/logo/${c.$id}?v=${c.logoFileId.slice(-8)}` : null;
}
