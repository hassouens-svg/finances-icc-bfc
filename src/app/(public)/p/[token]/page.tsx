import { Query } from "node-appwrite";
import { Link2Off } from "lucide-react";
import { adminList, adminGet } from "@/server/data";
import { EmptyState } from "@/components/ui/empty-state";
import { PublicShell } from "../../public-shell";
import { PublicForm } from "./public-form";
import type { Church, Department, PublicLink } from "@/lib/types";

export const metadata = { title: "Formulaire", robots: { index: false } };

export default async function PublicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = (await adminList<PublicLink>("public_links", [Query.equal("token", token), Query.limit(1)]))[0];
  const church = link ? await adminGet<Church>("churches", link.churchId) : null;
  const valid = link && church?.active && link.active && !(link.expiresAt && new Date(link.expiresAt) < new Date());
  if (!valid) {
    return <PublicShell><EmptyState icon={<Link2Off />} title="Ce lien n'est plus actif" description="Il a peut-être expiré ou été désactivé. Demandez un nouveau lien à votre trésorier." /></PublicShell>;
  }
  const deps = await adminList<Department>("departments", [Query.equal("churchId", church.$id), Query.equal("archived", false), Query.orderAsc("name")]);
  const fixedDep = link.departmentId ? deps.find((d) => d.$id === link.departmentId) : undefined;
  return (
    <PublicShell church={church.name}>
      <h1 className="text-[24px] font-semibold tracking-tight">{link.kind === "funding" ? "Exprimer un besoin" : "Demander un remboursement"}</h1>
      <p className="mb-6 mt-1 text-[15px] text-muted">
        {link.kind === "funding" ? `Votre demande sera étudiée par la trésorerie de ${church.name}${fixedDep ? ` pour le département ${fixedDep.name}` : ""}.` : `Pour une dépense que vous avez avancée pour ${church.name}. Joignez obligatoirement la photo du justificatif.`}
      </p>
      <PublicForm token={token} kind={link.kind} churchName={church.name} departments={deps.map((d) => ({ id: d.$id, name: d.name }))} fixedDepartment={fixedDep?.name} />
    </PublicShell>
  );
}
