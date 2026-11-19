import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#lg-${id})`} />
      <path d="M11 27.5h18M13 27.5l-1.5-11 5.5 4.5L20 13l3 8 5.5-4.5-1.5 11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">ICC Finances</p>
        {subtitle && <p className="text-[12px] text-muted">Bourgogne-Franche-Comté</p>}
      </div>
    </div>
  );
}
