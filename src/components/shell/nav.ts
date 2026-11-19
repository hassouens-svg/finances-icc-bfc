import {
  LayoutDashboard, CheckCheck, HandCoins, Users, Receipt, RotateCcw, Lightbulb, FolderKanban, Landmark, Wallet,
  Crown, FileBarChart, PieChart, Scale, Settings, BookCheck, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: "approvals" | "reimbursements" | "funding" };
export type NavGroup = { label?: string; items: NavItem[]; adminOnly?: boolean };

export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/app", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/app/a-valider", label: "À valider", icon: CheckCheck, badgeKey: "approvals" },
    ],
  },
  {
    label: "Argent entré",
    items: [
      { href: "/app/offrandes", label: "Dons & offrandes", icon: HandCoins },
      { href: "/app/donateurs", label: "Donateurs", icon: Users },
    ],
  },
  {
    label: "Argent sorti",
    items: [
      { href: "/app/depenses", label: "Dépenses", icon: Receipt },
      { href: "/app/remboursements", label: "Remboursements", icon: RotateCcw, badgeKey: "reimbursements" },
      { href: "/app/besoins", label: "Besoins départements", icon: Lightbulb, badgeKey: "funding" },
      { href: "/app/projets", label: "Projets & événements", icon: FolderKanban },
    ],
  },
  {
    label: "Banque & caisse",
    items: [
      { href: "/app/depots", label: "Dépôts bancaires", icon: Landmark },
      { href: "/app/tresorerie", label: "Trésorerie", icon: Wallet },
    ],
  },
  {
    label: "Cité Royale",
    items: [{ href: "/app/cite-royale", label: "Demandes", icon: Crown }],
  },
  {
    label: "Comptabilité",
    items: [
      { href: "/app/compte-de-resultat", label: "Compte de résultat", icon: Scale },
      { href: "/app/budget", label: "Budget", icon: PieChart },
      { href: "/app/rapprochement", label: "Rapprochement", icon: BookCheck },
      { href: "/app/rapports", label: "Rapports & exports", icon: FileBarChart },
    ],
  },
  {
    label: "Paramètres",
    adminOnly: true,
    items: [{ href: "/app/admin", label: "Administration", icon: Settings }],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/app", label: "Accueil", icon: LayoutDashboard },
  { href: "/app/offrandes", label: "Entrées", icon: HandCoins },
  { href: "/app/depenses", label: "Sorties", icon: Receipt },
  { href: "/app/a-valider", label: "À valider", icon: CheckCheck, badgeKey: "approvals" },
];

export function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}
