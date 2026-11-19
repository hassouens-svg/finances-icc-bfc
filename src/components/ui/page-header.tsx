import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({ title, description, actions, back, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: React.ReactNode }) {
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
    </div>
  );
}
