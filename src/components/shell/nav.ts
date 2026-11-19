import {
  LayoutDashboard, CheckCheck, HandCoins, Users, Receipt, RotateCcw, Lightbulb, FolderKanban, Landmark, Wallet,
  Crown, FileBarChart, PieChart, Scale, Settings, BookCheck, Plus, BookOpen, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: "approvals" | "reimbursements" | "funding"; exact?: boolean };
export type NavGroup = { label?: string; num?: number; items: NavItem[]; adminOnly?: boolean };

/** Menus organisés selon les modules du cahier des charges. */
export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/app", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/app/a-valider", label: "À valider", icon: CheckCheck, badgeKey: "approvals" },
    ],
  },
  {
    num: 1, label: "Achats · Cité Royale",
    items: [
      { href: "/app/cite-royale", label: "Demandes Cité Royale", icon: Crown, exact: true },
      { href: "/app/cite-royale/nouvelle", label: "Nouvelle demande", icon: Plus },
    ],
  },
  {
    num: 2, label: "Besoins des départements",
    items: [{ href: "/app/besoins", label: "Demandes de financement", icon: Lightbulb, badgeKey: "funding" }],
  },
  {
    num: 3, label: "Remboursements",
    items: [{ href: "/app/remboursements", label: "Demandes de remboursement", icon: RotateCcw, badgeKey: "reimbursements" }],
  },
  {
    num: 4, label: "Dons & offrandes",
    items: [
      { href: "/app/offrandes", label: "Saisie des offrandes", icon: HandCoins },
      { href: "/app/donateurs", label: "Donateurs", icon: Users },
    ],
  },
  {
    num: 5, label: "Dépenses & projets",
    items: [
      { href: "/app/depenses", label: "Dépenses", icon: Receipt },
      { href: "/app/projets", label: "Projets & événements", icon: FolderKanban },
    ],
  },
  {
    num: 6, label: "Dépôts bancaires",
    items: [{ href: "/app/depots", label: "Dépôts & caisse", icon: Landmark }],
  },
  {
    num: 7, label: "Trésorerie & compta",
    items: [
      { href: "/app/tresorerie", label: "Trésorerie", icon: Wallet },
      { href: "/app/compte-de-resultat", label: "Compte de résultat", icon: Scale },
      { href: "/app/budget", label: "Budget", icon: PieChart },
      { href: "/app/rapprochement", label: "Rapprochement", icon: BookCheck },
      { href: "/app/rapports", label: "Rapports & exports", icon: FileBarChart },
    ],
  },
  {
    label: "Aide & paramètres",
    items: [
      { href: "/app/guide", label: "Guide d'utilisation", icon: BookOpen },
      { href: "/app/admin", label: "Administration", icon: Settings },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/app", label: "Accueil", icon: LayoutDashboard },
  { href: "/app/offrandes", label: "Offrandes", icon: HandCoins },
  { href: "/app/depenses", label: "Dépenses", icon: Receipt },
  { href: "/app/a-valider", label: "À valider", icon: CheckCheck, badgeKey: "approvals" },
];

export function isActive(pathname: string, item: NavItem | string) {
  const href = typeof item === "string" ? item : item.href;
  const exact = typeof item === "string" ? false : item.exact;
  if (href === "/app") return pathname === "/app";
  if (exact) return pathname === href || (pathname.startsWith(href + "/") && !pathname.startsWith(href + "/nouvelle"));
  return pathname === href || pathname.startsWith(href + "/");
}
