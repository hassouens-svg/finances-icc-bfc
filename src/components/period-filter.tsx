"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PERIOD_LABELS, type PeriodKey } from "@/lib/period";
import { Input } from "@/components/ui/input";

const KEYS: PeriodKey[] = ["month", "last_month", "quarter", "year", "last_year", "custom"];

export function PeriodFilter({ value, from, to }: { value: string; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? q.set(k, v) : q.delete(k));
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <select
          value={value}
          onChange={(e) => set({ p: e.target.value, from: undefined, to: undefined })}
          className="h-10 appearance-none rounded-xl border border-border bg-bg pl-9 pr-8 text-[14px] font-medium shadow-card"
          aria-label="Période"
        >
          {KEYS.map((k) => <option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}
        </select>
      </div>
      {value === "custom" && (
        <>
          <Input type="date" defaultValue={from} onChange={(e) => set({ from: e.target.value })} className="h-10 w-auto text-[14px]" aria-label="Du" />
          <Input type="date" defaultValue={to} onChange={(e) => set({ to: e.target.value })} className="h-10 w-auto text-[14px]" aria-label="Au" />
        </>
      )}
    </div>
  );
}
