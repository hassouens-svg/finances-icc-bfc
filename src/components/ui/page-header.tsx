import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MODULES } from "@/lib/guide";
import { ModuleHelp } from "@/components/module-help";

export function PageHeader({ title, description, actions, back, eyebrow, module, help }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: React.ReactNode; module?: number; help?: string }) {
  const mod = module ? MODULES.find((m) => m.num === module) : undefined;
  if (mod && !eyebrow) eyebrow = <ModuleTag num={mod.num!} title={mod.title.split(" — ")[0]!} />;
  return (
    <div className="mb-6 animate-fade-up">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
          <ChevronLeft className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {help && <div className="mt-5 -mb-1"><ModuleHelp id={help} /></div>}
    </div>
  );
}

export function ModuleTag({ num, title }: { num: number; title: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-medium text-accent">
      <span className="num grid size-5 place-items-center rounded-md bg-accent text-[11px] font-semibold text-white">{num}</span>
      Module {num} · {title}
    </span>
  );
}
