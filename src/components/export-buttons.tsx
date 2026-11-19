import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons({ entity, sp = {} }: { entity: string; sp?: Record<string, string | undefined> }) {
  const q = (format: string) => {
    const p = new URLSearchParams({ report: entity, format });
    for (const [k, v] of Object.entries(sp)) if (v && ["p", "from", "to"].includes(k)) p.set(k, v);
    return `/api/export?${p.toString()}`;
  };
  return (
    <>
      <Button asChild variant="secondary" size="md"><a href={q("xlsx")} aria-label="Exporter en Excel"><FileSpreadsheet /> <span className="hidden sm:inline">Excel</span></a></Button>
      <Button asChild variant="secondary" size="md"><a href={q("pdf")} aria-label="Exporter en PDF"><FileText /> <span className="hidden sm:inline">PDF</span></a></Button>
    </>
  );
}
