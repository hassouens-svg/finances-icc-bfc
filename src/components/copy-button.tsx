"use client";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copier" }: { value: string; label?: string }) {
  return (
    <Button size="sm" variant="secondary" type="button" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copié dans le presse-papiers."))}>
      <Copy /> {label}
    </Button>
  );
}
