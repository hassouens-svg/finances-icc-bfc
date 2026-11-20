import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ActionButton } from "@/components/action-form";
import { InviteDialog, BankAccountDialog } from "@/components/admin/forms";
import { quickPublicLinkAction, defaultDepartmentsAction } from "@/server/actions/admin";
import type { ChurchSetup } from "@/server/setup";
import { cn } from "@/lib/utils";

function Step({ done, title, text, children }: { done: boolean; title: string; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted" />}
        <div>
          <p className={cn("text-[14px] font-medium", done && "text-muted line-through decoration-muted/40")}>{title}</p>
          <p className="text-[13px] text-muted">{text}</p>
        </div>
      </div>
      {!done && <div className="flex flex-wrap gap-2 pl-8 sm:pl-0">{children}</div>}
    </li>
  );
}

/** « Prochaines étapes » d'une église : tout se fait d'ici, en un ou deux clics. */
export function ChurchSteps({ s, canInvite }: { s: ChurchSetup; canInvite: boolean }) {
  const c = s.church;
  return (
    <Card className={cn(s.done < s.total && "border-accent/30")}>
      <CardHeader title={s.done < s.total ? "Prochaines étapes" : "Église prête ✓"} description={`${s.done}/${s.total} étapes — tout se fait d'ici, sans chercher dans les menus.`} />
      <CardBody>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(s.done / s.total) * 100}%` }} /></div>
        <ol className="divide-y divide-border">
          <Step done={s.treasurers > 0} title="1. Créer le compte du trésorier" text="Il pourra saisir offrandes, dépenses et dépôts. Ajoutez aussi pasteur et lecteurs si besoin.">
            {canInvite && <InviteDialog churches={[{ value: c.$id, label: c.name }]} defaultChurchId={c.$id} canMother={false} />}
          </Step>
          <Step done={s.bankAccounts > 0} title="2. Ajouter le compte bancaire" text="Avec le solde de départ : la trésorerie sera juste dès le premier jour.">
            <BankAccountDialog churchId={c.$id} />
          </Step>
          <Step done={s.departments > 0} title="3. Ajouter les départements" text="Louange, accueil, jeunesse, enfants, médias… (modifiables ensuite).">
            <ActionButton variant="primary" action={defaultDepartmentsAction} payload={{ churchId: c.$id }}>Ajouter les départements courants</ActionButton>
            <Link href={`/app/admin/departements?church=${c.$id}`} className="inline-flex h-10 items-center gap-1 px-2 text-[13px] font-medium text-accent">Personnaliser <ArrowRight className="size-3.5" /></Link>
          </Step>
          <Step done={s.fundingLink && s.reimbursementLink} title="4. Créer les liens publics" text="Besoins des départements et remboursements, à partager par WhatsApp ou QR code.">
            {!s.fundingLink && <ActionButton variant="primary" action={quickPublicLinkAction} payload={{ churchId: c.$id, kind: "funding" }}>Lien besoins</ActionButton>}
            {!s.reimbursementLink && <ActionButton variant="primary" action={quickPublicLinkAction} payload={{ churchId: c.$id, kind: "reimbursement" }}>Lien remboursements</ActionButton>}
          </Step>
        </ol>
      </CardBody>
    </Card>
  );
}

/** Mise en place globale (tableau de bord du super admin / de l'église mère). */
export function SetupChecklist({ hasMother, setups }: { hasMother: boolean; setups: ChurchSetup[] }) {
  const ready = setups.filter((s) => s.done === s.total).length;
  const items = [
    { done: hasMother, title: "Créer l'église mère (Dijon) avec son logo", href: "/app/admin/eglises", cta: "Créer" },
    { done: setups.length > 1, title: "Créer les églises filles", href: "/app/admin/eglises", cta: "Ajouter" },
    { done: setups.length > 0 && ready === setups.length, title: `Préparer chaque église (${ready}/${setups.length} prêtes) : trésorier, compte bancaire, départements, liens`, href: "/app/admin/eglises", cta: "Continuer" },
  ];
  if (items.every((i) => i.done)) return null;
  const n = items.filter((i) => i.done).length;
  return (
    <Card className="mb-5 border-accent/30 bg-accent-soft/30">
      <CardHeader title="Mise en place" description={`${n}/${items.length} — suivez ces étapes dans l'ordre, la liste se coche toute seule.`} />
      <CardBody>
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-bg px-3.5 py-3 shadow-card">
              {it.done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">{i + 1}</span>}
              <span className={cn("min-w-0 flex-1 text-[14px]", it.done && "text-muted line-through decoration-muted/40")}>{it.title}</span>
              {!it.done && <Link href={it.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">{it.cta} <ArrowRight className="size-3.5" /></Link>}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
