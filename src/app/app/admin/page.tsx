import Link from "next/link";
import { Building2, Users, Network, ListChecks, Landmark, GitBranch, Link2, Bell, ScrollText, Download, ChevronRight } from "lucide-react";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const ctx = await requireContext();
  const tiles = [
    { href: "/app/admin/eglises", icon: Building2, title: "Villes & églises", desc: "Créer les églises, désigner l'église mère", regional: true },
    { href: "/app/admin/utilisateurs", icon: Users, title: "Utilisateurs", desc: "Invitations et rôles par église", regional: true },
    { href: "/app/admin/departements", icon: Network, title: "Départements", desc: "Louange, accueil, jeunesse… et budgets" },
    { href: "/app/admin/listes", icon: ListChecks, title: "Listes configurables", desc: "Catégories, types de dons, cultes, types de demandes" },
    { href: "/app/admin/comptes", icon: Landmark, title: "Comptes bancaires", desc: "Plusieurs comptes possibles par église" },
    { href: "/app/admin/workflows", icon: GitBranch, title: "Circuits de validation", desc: "Seuils, étapes et délais des dépenses", regional: true },
    { href: "/app/admin/liens", icon: Link2, title: "Liens publics & QR codes", desc: "Besoins et remboursements sans compte" },
    { href: "/app/admin/parametres", icon: Bell, title: "Alertes & paramètres", desc: "Seuils de caisse, délais, reçus fiscaux", regional: true },
    { href: "/app/admin/audit", icon: ScrollText, title: "Journal d'audit", desc: "Qui a fait quoi, quand" },
    { href: "/app/rapports", icon: Download, title: "Export & sauvegarde", desc: "Export complet Excel d'une église" },
  ].filter((t) => !t.regional || ctx.isRegional);
  return (
    <>
      <PageHeader title="Administration" description="Tout est configurable : rien n'est figé dans l'application." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="group flex items-center gap-4 rounded-2xl border border-border bg-bg p-4 shadow-card transition-colors hover:border-accent/40">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><t.icon className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t.title}</span>
              <span className="block text-[13px] text-muted">{t.desc}</span>
            </span>
            <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </>
  );
}
