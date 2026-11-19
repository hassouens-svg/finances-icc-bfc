import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="grid min-h-dvh place-items-center p-6"><EmptyState icon={<Compass />} title="Page introuvable" description="Ce contenu n'existe pas ou vous n'y avez pas accès." action={<Button asChild><Link href="/app">Retour au tableau de bord</Link></Button>} /></main>;
}
