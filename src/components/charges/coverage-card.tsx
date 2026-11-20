import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChargeCoverage } from "@/lib/charges";

const TONE = {
  ok: { cls: "bg-success-soft text-success", icon: CheckCircle2, title: "Les charges du mois sont couvertes" },
  tight: { cls: "bg-warning-soft text-warning", icon: AlertTriangle, title: "C'est juste : les charges sont couvertes, sans marge" },
  short: { cls: "bg-danger-soft text-danger", icon: XCircle, title: "Les entrées ne couvrent pas encore toutes les charges" },
};

/** « Est-ce que ce qui rentre couvre le loyer et les charges ? » — lisible en 5 secondes. */
export function CoverageCard({ coverage, income, avg3, runway, available, compact, href }: { coverage: ChargeCoverage; income: number; avg3: number; runway: number; available: number; compact?: boolean; href?: string }) {
  const t = TONE[coverage.status];
  const Icon = t.icon;
  return (
    <Card>
      <CardHeader
        title="Charges fixes du mois"
        description={`${formatEuro(coverage.total)} à couvrir · ${formatEuro(income)} entrés ce mois`}
        action={href ? <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">Gérer <ArrowRight className="size-3.5" /></Link> : undefined}
      />
      <CardBody className="space-y-4">
        <div className={cn("flex items-start gap-3 rounded-xl px-4 py-3", t.cls)}>
          <Icon className="mt-0.5 size-5 shrink-0" />
          <div className="text-[14px]">
            <p className="font-semibold">{t.title}</p>
            <p className="mt-0.5 opacity-90">
              {coverage.status === "short" ? `Il manque ${formatEuro(coverage.missing)} ce mois-ci.` : `Marge : ${formatEuro(income - coverage.total)}.`}{" "}
              Moyenne des 3 derniers mois : {formatEuro(avg3)} ({avg3 >= coverage.total ? "suffisant" : `${formatEuro(coverage.total - avg3)} de moins que les charges`}).
            </p>
          </div>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Couverture des charges" aria-valuenow={Math.round(coverage.ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full", coverage.status === "short" ? "bg-danger" : coverage.status === "tight" ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, coverage.ratio * 100)}%` }} />
        </div>
        {!compact && (
          <ul className="space-y-2">
            {coverage.items.map((i) => (
              <li key={i.name} className="flex items-center gap-2.5 text-[14px]">
                {i.state === "covered" ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : i.state === "partial" ? <AlertTriangle className="size-4 shrink-0 text-warning" /> : <XCircle className="size-4 shrink-0 text-danger" />}
                <span className="min-w-0 flex-1 truncate">{i.name}</span>
                <span className="num text-[13px] text-muted">{i.state === "partial" ? `${formatEuro(i.coveredCents)} / ` : ""}{formatEuro(i.monthly)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[13px] text-muted">
          Trésorerie disponible : <span className="num font-medium text-fg">{formatEuro(available)}</span>
          {Number.isFinite(runway) ? <> — de quoi payer <b className="text-fg">{runway.toFixed(1).replace(".", ",")} mois</b> de charges fixes.</> : null}
        </p>
      </CardBody>
    </Card>
  );
}
