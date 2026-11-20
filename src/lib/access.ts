/**
 * Droits par module (logique pure, partagée serveur / client / scripts).
 * Les droits sont stockés comme rôles d'appartenance à l'équipe Appwrite de l'église :
 *   - rôles prêts à l'emploi : admin (responsable), treasurer, pastor, reader ;
 *   - rôles personnalisés : m_<module>_view, m_<module>_edit, ap_treasurer, ap_pastor.
 * Les mêmes rôles sont posés dans les permissions de chaque ligne : Appwrite garantit le cloisonnement.
 */
export const MODULES = [
  { key: "citeroyale", label: "Cité Royale (achats)", short: "Cité Royale", num: 1 },
  { key: "besoins", label: "Besoins des départements", short: "Besoins", num: 2 },
  { key: "remboursements", label: "Remboursements", short: "Remboursements", num: 3 },
  { key: "offrandes", label: "Dons & offrandes", short: "Dons", num: 4 },
  { key: "depenses", label: "Dépenses, projets, charges", short: "Dépenses", num: 5 },
  { key: "depots", label: "Dépôts bancaires", short: "Dépôts", num: 6 },
  { key: "tresorerie", label: "Trésorerie & comptabilité", short: "Trésorerie", num: 7 },
  { key: "parametres", label: "Paramètres de l'église", short: "Paramètres", num: undefined },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];
export type Level = "none" | "view" | "edit";
export type Access = { admin: boolean; modules: Record<ModuleKey, Level>; approve: { treasurer: boolean; pastor: boolean }; preset: Preset };
export type Preset = "admin" | "treasurer" | "pastor" | "reader" | "custom";

export const PRESETS: { key: Exclude<Preset, "custom">; label: string; desc: string }[] = [
  { key: "admin", label: "Responsable de l'église", desc: "Tout voir et tout gérer, y compris l'équipe et ses droits" },
  { key: "treasurer", label: "Trésorier", desc: "Gère toutes les finances : offrandes, dépenses, dépôts…" },
  { key: "pastor", label: "Pasteur", desc: "Voit tout et valide les dépenses à son étape" },
  { key: "reader", label: "Lecteur", desc: "Consultation seule (conseil, auditeur)" },
];

const all = (l: Level) => Object.fromEntries(MODULES.map((m) => [m.key, l])) as Record<ModuleKey, Level>;

export const roleView = (m: ModuleKey) => `m_${m}_view`;
export const roleEdit = (m: ModuleKey) => `m_${m}_edit`;

/** Droits effectifs à partir des rôles d'appartenance. */
export function computeAccess(roles: string[]): Access {
  const r = new Set(roles);
  if (r.has("admin") || r.has("owner")) return { admin: true, modules: all("edit"), approve: { treasurer: true, pastor: true }, preset: "admin" };
  const modules = all("none");
  let preset: Preset = "custom";
  if (r.has("treasurer")) { Object.assign(modules, all("edit")); preset = "treasurer"; }
  else if (r.has("pastor")) { Object.assign(modules, all("view")); preset = "pastor"; }
  else if (r.has("reader")) { Object.assign(modules, all("view")); preset = "reader"; }
  for (const m of MODULES) {
    if (r.has(roleEdit(m.key))) modules[m.key] = "edit";
    else if (r.has(roleView(m.key)) && modules[m.key] === "none") modules[m.key] = "view";
  }
  if (preset !== "custom" && [...r].some((x) => x.startsWith("m_") || x.startsWith("ap_"))) preset = "custom";
  return { admin: false, modules, approve: { treasurer: r.has("treasurer") || r.has("ap_treasurer"), pastor: r.has("pastor") || r.has("ap_pastor") }, preset };
}

/** Rôles à enregistrer pour un rôle prêt à l'emploi ou des droits personnalisés. */
export function rolesFor(preset: Preset, modules?: Partial<Record<ModuleKey, Level>>, approve?: { treasurer?: boolean; pastor?: boolean }): string[] {
  if (preset !== "custom") return [preset];
  const out: string[] = [];
  for (const m of MODULES) {
    const l = modules?.[m.key] ?? "none";
    if (l === "edit") out.push(roleEdit(m.key));
    else if (l === "view") out.push(roleView(m.key));
  }
  if (approve?.treasurer) out.push("ap_treasurer");
  if (approve?.pastor) out.push("ap_pastor");
  return out.length ? out : ["reader"];
}

export const ALLOWED_ROLE = /^(admin|treasurer|pastor|reader|ap_treasurer|ap_pastor|m_(citeroyale|besoins|remboursements|offrandes|depenses|depots|tresorerie|parametres)_(view|edit))$/;

/** Module auquel appartiennent les lignes de chaque table. "base" = visible par tout membre de l'église. */
export const TABLE_MODULE: Record<string, ModuleKey | "base" | "audit"> = {
  cr_requests: "citeroyale",
  funding_requests: "besoins",
  reimbursements: "remboursements",
  offering_sessions: "offrandes", offering_lines: "offrandes", donors: "offrandes",
  expenses: "depenses", approvals: "depenses", projects: "depenses", recurring_charges: "depenses",
  deposits: "depots",
  cash_movements: "tresorerie", budgets: "tresorerie", bank_statement_lines: "tresorerie", period_locks: "tresorerie",
  departments: "base", bank_accounts: "base", public_links: "base", list_items: "base", approval_workflows: "base",
  audit_logs: "audit",
};
export const ENTITY_MODULE: Record<string, ModuleKey> = {
  cr_request: "citeroyale", funding_request: "besoins", reimbursement: "remboursements", offering_session: "offrandes", donor: "offrandes",
  expense: "depenses", project: "depenses", deposit: "depots",
};

/** Module d'un écran (pour le menu et les accès). */
export const PATH_MODULE: [RegExp, ModuleKey][] = [
  [/^\/app\/cite-royale/, "citeroyale"], [/^\/app\/besoins/, "besoins"], [/^\/app\/remboursements/, "remboursements"],
  [/^\/app\/(offrandes|donateurs)/, "offrandes"], [/^\/app\/(depenses|projets|charges|a-valider)/, "depenses"], [/^\/app\/depots/, "depots"],
  [/^\/app\/(tresorerie|compte-de-resultat|budget|rapprochement|rapports)/, "tresorerie"],
];
export function moduleOfPath(path: string): ModuleKey | null {
  return PATH_MODULE.find(([re]) => re.test(path))?.[1] ?? null;
}

/** Libellé court des droits d'un membre (pour les listes). */
export function accessSummary(roles: string[]) {
  const a = computeAccess(roles);
  if (a.preset !== "custom") return PRESETS.find((p) => p.key === a.preset)!.label;
  const parts = MODULES.filter((m) => a.modules[m.key] !== "none").map((m) => `${m.short}${a.modules[m.key] === "edit" ? " (gérer)" : " (voir)"}`);
  if (a.approve.treasurer || a.approve.pastor) parts.push("valide les dépenses");
  return `Personnalisé : ${parts.join(", ") || "aucun module"}`;
}

