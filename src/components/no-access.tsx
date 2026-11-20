import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function NoAccess() {
  return <EmptyState className="mt-10" icon={<Lock />} title="Vous n'avez pas accès à ce module" description="Demandez au responsable de votre église d'ajuster vos droits (Mon équipe › Droits)." />;
}
