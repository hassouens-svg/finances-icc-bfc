import Link from "next/link";
import { cn } from "@/lib/utils";

/** Choix de l'église pour les écrans propres à une église quand la vue est « Toutes les églises ». */
export function ChurchPicker({ churches, current, basePath }: { churches: { id: string; name: string }[]; current: string; basePath: string }) {
  if (churches.length <= 1) return null;
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1.5 rounded-xl bg-surface-2 p-1">
        {churches.map((c) => (
          <Link
            key={c.id}
            href={`${basePath}?church=${c.id}`}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium", c.id === current ? "bg-bg text-fg shadow-card" : "text-muted hover:text-fg")}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
