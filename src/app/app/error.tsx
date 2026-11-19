"use client";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <EmptyState className="mt-10" icon={<AlertTriangle />} title="Un problème est survenu" description="Le chargement a échoué. Vérifiez votre connexion puis réessayez." action={<Button onClick={reset}>Réessayer</Button>} />;
}
