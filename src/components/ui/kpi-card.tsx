"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/format";

function useCountUp(target: number, duration = 700) {
  const [v, setV] = React.useState(target);
  const first = React.useRef(true);
  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(target); return; }
    const from = first.current ? 0 : v;
    first.current = false;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

export function KpiCard({
  label, value, kind = "money", hint, tone = "default", href, icon,
}: { label: string; value: number; kind?: "money" | "count"; hint?: React.ReactNode; tone?: "default" | "accent" | "positive" | "negative" | "warning"; href?: string; icon?: React.ReactNode }) {
  const v = useCountUp(value);
  const color = { default: "text-fg", accent: "text-accent", positive: "text-success", negative: "text-danger", warning: "text-warning" }[tone];
  const body = (
    <div className={cn("group relative h-full rounded-2xl border border-border bg-bg p-4 shadow-card transition-colors sm:p-5", href && "hover:border-accent/40")}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted [&_svg]:size-3.5">{icon}{label}</p>
        {href && <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className={cn("num mt-2 text-[22px] font-semibold tracking-tight sm:text-[26px]", color)}>{kind === "money" ? formatEuro(v) : v.toLocaleString("fr-FR")}</p>
      {hint && <div className="mt-1 text-[12px] text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
