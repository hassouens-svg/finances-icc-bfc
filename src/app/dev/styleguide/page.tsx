import { HandCoins, Wallet, Receipt, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Gauge } from "@/components/ui/gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { Timeline } from "@/components/ui/timeline";
import { Logo } from "@/components/logo";
import { STATUS } from "@/lib/status";

export const metadata = { title: "Design system" };

const COLORS = [["Fond", "#FFFFFF"], ["Sections", "#FAFAFA"], ["Texte", "#0A0A0A"], ["Secondaire", "#6B6B76"], ["Bordures", "#EAEAEE"], ["Violet", "#6D28D9"], ["Violet clair", "#F3EEFF"], ["Violet foncé", "#4C1D95"], ["Succès", "#16A34A"], ["Attention", "#D97706"], ["Erreur", "#DC2626"]];

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-8">
      <div className="flex items-center justify-between"><Logo /><span className="text-[13px] text-muted">Design system · /dev/styleguide</span></div>
      <section className="space-y-3"><h2 className="text-[18px] font-semibold">Couleurs</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{COLORS.map(([n, c]) => <div key={n}><div className="h-16 rounded-xl border border-border" style={{ background: c }} /><p className="mt-1.5 text-[13px] font-medium">{n}</p><p className="font-mono text-[12px] text-muted">{c}</p></div>)}</div>
      </section>
      <section className="space-y-3"><h2 className="text-[18px] font-semibold">Typographie</h2>
        <Card className="space-y-2 p-5"><p className="text-[28px] font-semibold tracking-tight">Titre de page — Geist 28</p><p className="text-[15px] font-semibold">Titre de carte — 15 semibold</p><p className="text-[15px]">Texte courant — 15</p><p className="text-[13px] text-muted">Texte secondaire — 13</p><p className="num text-[26px] font-semibold text-accent">1 250,00 € <span className="text-[14px] text-muted">chiffres tabulaires · 19 nov. 2026</span></p></Card>
      </section>
      <section className="space-y-3"><h2 className="text-[18px] font-semibold">Boutons</h2>
        <div className="flex flex-wrap gap-2"><Button>Action principale</Button><Button variant="secondary">Secondaire</Button><Button variant="soft">Douce</Button><Button variant="ghost">Fantôme</Button><Button variant="success">Approuver</Button><Button variant="danger-soft">Refuser</Button><Button variant="danger">Supprimer</Button><Button size="sm">Petit</Button><Button size="lg">Grand</Button></div>
      </section>
      <section className="space-y-3"><h2 className="text-[18px] font-semibold">Badges de statut (identiques dans toute l&apos;app)</h2>
        {Object.entries(STATUS).map(([entity, map]) => <div key={entity} className="flex flex-wrap gap-1.5"><span className="w-36 text-[13px] text-muted">{entity}</span>{Object.keys(map).map((s) => <StatusBadge key={s} entity={entity} status={s} />)}</div>)}
        <div className="flex gap-1.5"><span className="w-36 text-[13px] text-muted">priorité</span>{["low", "normal", "high", "urgent"].map((p) => <PriorityBadge key={p} priority={p} />)}</div>
      </section>
      <section className="space-y-3"><h2 className="text-[18px] font-semibold">KPI</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="Argent entré" value={1248000} tone="accent" icon={<HandCoins />} hint="+8 % vs mois dernier" /><KpiCard label="Argent sorti" value={512050} icon={<Receipt />} /><KpiCard label="En caisse" value={132000} tone="warning" icon={<Wallet />} hint="à déposer" /><KpiCard label="À valider" value={4} kind="count" /></div>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Formulaire" description="Une question par bloc, gros champs" /><CardBody className="space-y-4">
          <Field label="Objet"><Input placeholder="Ex. Achat de micros" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Montant"><AmountInput size="lg" defaultValue="125,00" /></Field><Field label="Catégorie"><Select><option>Matériel</option></Select></Field></div>
          <Field label="Description" optional><Textarea /></Field><Checkbox label="Dépense déjà avancée (régularisation)" />
        </CardBody></Card>
        <div className="space-y-5">
          <Card className="p-5"><p className="mb-2 text-[13px] font-medium">Jauge budget</p><Gauge used={380000} total={500000} /><div className="mt-4"><Gauge used={540000} total={500000} /></div></Card>
          <Card className="space-y-2 p-5"><p className="text-[13px] font-medium">Chargement</p><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24 w-full" /></Card>
          <Card className="p-5"><Timeline items={[{ id: "1", date: new Date().toISOString(), actor: "Paul K.", status: "approved", entity: "expense", kind: "status", text: "Étape 2/3 approuvée" }, { id: "2", date: new Date(Date.now() - 86400000).toISOString(), actor: "Grace N.", kind: "comment", text: "Devis joint." }]} /></Card>
        </div>
      </section>
      <EmptyState icon={<Inbox />} title="Aucune offrande ce mois-ci" description="Saisissez la première séance : cela prend moins de 2 minutes." action={<Button>Ajouter la première</Button>} />
      <div className="flex gap-2"><Badge tone="progress">Info</Badge><Badge tone="waiting">Attention</Badge><Badge tone="negative">Erreur</Badge><Badge tone="positive">Succès</Badge></div>
    </main>
  );
}
