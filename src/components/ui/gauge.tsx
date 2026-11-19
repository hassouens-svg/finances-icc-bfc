import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/format";

export function Gauge({ used, total, className, showLabels = true }: { used: number; total: number; className?: string; showLabels?: boolean }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const over = total > 0 && used > total;
  const tone = over ? "bg-danger" : pct > 85 ? "bg-warning" : "bg-accent";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-700", tone)} style={{ width: `${pct}%` }} />
      </div>
      {showLabels && (
        <div className="num flex justify-between text-[12px] text-muted">
          <span>{formatEuro(used)} consommé</span>
          <span className={over ? "font-medium text-danger" : ""}>{over ? `Dépassement ${formatEuro(used - total)}` : `${formatEuro(total - used)} restant`}</span>
        </div>
      )}
    </div>
  );
}
