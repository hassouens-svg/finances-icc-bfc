"use client";
import * as React from "react";
import Link from "next/link";
import { HelpCircle, ChevronDown, ArrowRight, Lightbulb } from "lucide-react";
import { guideFor } from "@/lib/guide";
import { cn } from "@/lib/utils";

/** Aide contextuelle « Comment ça marche ? » en haut de chaque module (ouverte la première fois, puis mémorisée). */
export function ModuleHelp({ id }: { id: string }) {
  const g = guideFor(id);
  const key = `icc-help-${id}`;
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try { setOpen(localStorage.getItem(key) !== "closed"); } catch { setOpen(true); }
  }, [key]);
  if (!g) return null;
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem(key, n ? "open" : "closed"); } catch {} };
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft/50">
      <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5">
        <HelpCircle className="size-5 shrink-0 text-accent" />
        <span className="flex-1 text-[14px] font-medium text-accent-strong">Comment ça marche ? <span className="font-normal text-accent-strong/70">— {g.steps.length} étapes</span></span>
        <ChevronDown className={cn("size-4 text-accent transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-accent/15 px-4 pb-4 pt-3 sm:px-5">
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-bg p-3 shadow-card">
                <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{s.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.text}</p>
                  {s.href && s.cta && <Link href={s.href} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">{s.cta} <ArrowRight className="size-3.5" /></Link>}
                </div>
              </li>
            ))}
          </ol>
          {g.tips && (
            <ul className="mt-3 space-y-1.5">
              {g.tips.map((t, i) => <li key={i} className="flex gap-2 text-[13px] text-accent-strong"><Lightbulb className="mt-0.5 size-3.5 shrink-0" />{t}</li>)}
            </ul>
          )}
          <Link href={`/app/guide#${g.id}`} className="mt-3 inline-block text-[12px] font-medium text-accent-strong/80 hover:underline">Voir le guide complet →</Link>
        </div>
      )}
    </div>
  );
}
