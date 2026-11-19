"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, UserRound, EyeOff, Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { formatEuro, parseEuroToCents, centsToInput } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import { sessionTotals } from "@/lib/finance";
import { saveOfferingSessionAction, type SessionPayload } from "@/server/actions/offerings";

type Opt = { id: string; name: string; churchId: string };
type Line = { key: string; donationTypeId: string; amountCents: number; method: string; anonymous: boolean; donorId?: string | null; donorName?: string | null; chequeRef?: string | null };

const METHODS = ["cash", "cheque", "transfer", "card", "mobile"] as const;

export function SessionForm({
  churches, donationTypes, services, donors, initial,
}: {
  churches: { id: string; name: string }[];
  donationTypes: Opt[];
  services: Opt[];
  donors: Opt[];
  initial?: { id: string; churchId: string; date: string; serviceId?: string | null; counter1Name?: string | null; counter2Name?: string | null; countedCashCents: number; countedChequeCents: number; notes?: string | null; lines: Omit<Line, "key">[] };
}) {
  const router = useRouter();
  const [churchId, setChurchId] = React.useState(initial?.churchId ?? churches[0]?.id ?? "");
  const types = donationTypes.filter((t) => t.churchId === "region" || t.churchId === churchId);
  const servs = services.filter((t) => t.churchId === "region" || t.churchId === churchId);
  const churchDonors = donors.filter((d) => d.churchId === churchId);
  const today = new Date();
  const lastSunday = new Date(today.getTime() - today.getDay() * 86400000);
  const [date, setDate] = React.useState(initial?.date ?? lastSunday.toISOString().slice(0, 10));
  const [serviceId, setServiceId] = React.useState(initial?.serviceId ?? servs[0]?.id ?? "");
  const [lines, setLines] = React.useState<Line[]>(initial?.lines.map((l, i) => ({ ...l, key: `i${i}` })) ?? []);
  const [counter1, setCounter1] = React.useState(initial?.counter1Name ?? "");
  const [counter2, setCounter2] = React.useState(initial?.counter2Name ?? "");
  const [countedCash, setCountedCash] = React.useState(initial ? centsToInput(initial.countedCashCents) : "");
  const [countedCheque, setCountedCheque] = React.useState(initial ? centsToInput(initial.countedChequeCents) : "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [pending, start] = React.useTransition();

  // ligne en cours de saisie
  const [typeId, setTypeId] = React.useState(types[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<string>("cash");
  const [nominative, setNominative] = React.useState(false);
  const [donorName, setDonorName] = React.useState("");
  const [chequeRef, setChequeRef] = React.useState("");
  const amountRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!types.some((t) => t.id === typeId)) setTypeId(types[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId]);

  const addLine = () => {
    const cents = parseEuroToCents(amount);
    if (!typeId) return toast.error("Choisissez un type de don.");
    if (isNaN(cents) || cents <= 0) return toast.error("Saisissez un montant valide.");
    if (nominative && !donorName.trim()) return toast.error("Indiquez le nom du donateur.");
    const match = churchDonors.find((d) => d.name.toLowerCase() === donorName.trim().toLowerCase());
    setLines((ls) => [
      ...ls,
      { key: crypto.randomUUID(), donationTypeId: typeId, amountCents: cents, method, anonymous: !nominative, donorId: nominative ? match?.id ?? null : null, donorName: nominative ? donorName.trim() : null, chequeRef: method === "cheque" ? chequeRef || null : null },
    ]);
    setAmount("");
    setDonorName("");
    setChequeRef("");
    amountRef.current?.focus();
  };

  const t = sessionTotals(lines, parseEuroToCents(countedCash) || 0, parseEuroToCents(countedCheque) || 0);
  const countedFilled = countedCash !== "" || countedCheque !== "";
  const byType = types.map((ty) => ({ ...ty, total: lines.filter((l) => l.donationTypeId === ty.id).reduce((a, l) => a + l.amountCents, 0) })).filter((x) => x.total > 0);

  const submit = (validate: boolean) => {
    if (validate && !countedFilled && t.cash + t.cheque > 0) return toast.error("Renseignez le montant compté (espèces et chèques) avant de valider.");
    const payload: SessionPayload = {
      id: initial?.id ?? null, churchId, date, serviceId: serviceId || null, counter1Name: counter1 || null, counter2Name: counter2 || null,
      countedCashCents: parseEuroToCents(countedCash) || 0, countedChequeCents: parseEuroToCents(countedCheque) || 0, notes: notes || null,
      lines: lines.map(({ key: _k, ...l }) => l) as SessionPayload["lines"], validate,
    };
    if (validate && t.gap !== 0 && countedFilled && !window.confirm(`Écart de ${formatEuro(t.gap)} entre le comptage et la saisie. Valider quand même ? L'écart sera signalé.`)) return;
    start(async () => {
      const r = await saveOfferingSessionAction(payload);
      if (r.ok) {
        toast.success(r.message);
        if (r.redirect) router.push(r.redirect);
      } else toast.error(r.error);
    });
  };

  return (
    <div className="grid gap-5 pb-28 lg:grid-cols-[1fr_340px] lg:pb-0">
      <div className="space-y-5">
        <Card>
          <CardHeader title="1. Le culte" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            {churches.length > 1 && (
              <Field label="Église" htmlFor="church">
                <Select id="church" value={churchId} onChange={(e) => setChurchId(e.target.value)} disabled={!!initial}>
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Date" htmlFor="date"><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
            <Field label="Culte / événement" htmlFor="service">
              <Select id="service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {servs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="">Autre</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="2. Les dons" description="Ajoutez une ligne par type et par moyen de paiement. Entrée = ajouter." />
          <CardBody className="space-y-4">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Type de don">
              {types.map((ty) => (
                <button key={ty.id} type="button" role="radio" aria-checked={typeId === ty.id} onClick={() => setTypeId(ty.id)}
                  className={cn("h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors", typeId === ty.id ? "border-accent bg-accent text-white" : "border-border bg-bg hover:bg-surface")}>
                  {ty.name}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <AmountInput ref={amountRef} size="lg" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }} aria-label="Montant" autoFocus />
              <Button type="button" size="lg" onClick={addLine} className="h-14"><Plus /> Ajouter</Button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Moyen de paiement">
              {METHODS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                  className={cn("h-10 rounded-xl border text-[13px] font-medium", method === m ? "border-accent bg-accent-soft text-accent-strong" : "border-border hover:bg-surface")}>
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setNominative(false)} className={cn("flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium", !nominative ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}><EyeOff className="size-4" /> Anonyme</button>
              <button type="button" onClick={() => setNominative(true)} className={cn("flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium", nominative ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}><UserRound className="size-4" /> Nominatif</button>
            </div>
            {(nominative || method === "cheque") && (
              <div className="grid gap-3 sm:grid-cols-2">
                {nominative && (
                  <Field label="Nom du donateur" htmlFor="donor">
                    <Input id="donor" list="donors-list" value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Rechercher ou saisir un nom" autoComplete="off" />
                    <datalist id="donors-list">{churchDonors.map((d) => <option key={d.id} value={d.name} />)}</datalist>
                  </Field>
                )}
                {method === "cheque" && <Field label="N° du chèque" optional htmlFor="cheque"><Input id="cheque" inputMode="numeric" value={chequeRef} onChange={(e) => setChequeRef(e.target.value)} /></Field>}
              </div>
            )}

            {lines.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 px-3.5 py-2.5 text-[14px]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{types.find((x) => x.id === l.donationTypeId)?.name ?? "—"}</p>
                      <p className="truncate text-[12px] text-muted">{METHOD_LABELS[l.method]}{l.anonymous ? " · anonyme" : ` · ${l.donorName}`}{l.chequeRef ? ` · n° ${l.chequeRef}` : ""}</p>
                    </div>
                    <span className="num font-semibold">{formatEuro(l.amountCents)}</span>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} aria-label="Supprimer la ligne"><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="3. Comptage sécurisé" description="Deux personnes comptent ensemble les espèces et les chèques." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Compteur 1" htmlFor="c1"><Input id="c1" value={counter1} onChange={(e) => setCounter1(e.target.value)} placeholder="Nom et prénom" /></Field>
            <Field label="Compteur 2" htmlFor="c2"><Input id="c2" value={counter2} onChange={(e) => setCounter2(e.target.value)} placeholder="Nom et prénom" /></Field>
            <Field label="Espèces comptées" htmlFor="cc" hint={`Saisi : ${formatEuro(t.cash)}`}><AmountInput id="cc" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} /></Field>
            <Field label="Chèques comptés" htmlFor="cq" hint={`Saisi : ${formatEuro(t.cheque)}`}><AmountInput id="cq" value={countedCheque} onChange={(e) => setCountedCheque(e.target.value)} /></Field>
            <Field label="Remarque" optional htmlFor="notes" className="sm:col-span-2"><Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </CardBody>
        </Card>
      </div>

      {/* Récapitulatif */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="hidden lg:block">
          <CardHeader title="Récapitulatif" />
          <CardBody className="space-y-3 text-[14px]">
            {byType.map((b) => <div key={b.id} className="flex justify-between"><span className="text-muted">{b.name}</span><span className="num">{formatEuro(b.total)}</span></div>)}
            {byType.length > 0 && <hr className="border-border" />}
            <div className="flex justify-between"><span className="text-muted">Espèces</span><span className="num">{formatEuro(t.cash)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Chèques</span><span className="num">{formatEuro(t.cheque)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Virement / carte / mobile</span><span className="num">{formatEuro(t.other)}</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-[16px] font-semibold"><span>Total saisi</span><span className="num text-accent">{formatEuro(t.entered)}</span></div>
            {countedFilled && (
              <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium", t.gap === 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                {t.gap === 0 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                {t.gap === 0 ? "Comptage conforme à la saisie" : `Écart de comptage : ${formatEuro(t.gap, { sign: true })}`}
              </div>
            )}
            <div className="grid gap-2 pt-2">
              <Button onClick={() => submit(true)} disabled={pending || !lines.length} size="lg">{pending ? <Loader2 className="animate-spin" /> : <Lock />} Valider et verrouiller</Button>
              <Button variant="secondary" onClick={() => submit(false)} disabled={pending || !lines.length}>Enregistrer en brouillon</Button>
            </div>
          </CardBody>
        </Card>
      </aside>

      {/* Barre d'action mobile */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="text-muted">{lines.length} ligne(s){countedFilled && t.gap !== 0 ? <span className="ml-2 font-medium text-warning">écart {formatEuro(t.gap, { sign: true })}</span> : null}</span>
          <span className="num text-[17px] font-semibold text-accent">{formatEuro(t.entered)}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" onClick={() => submit(false)} disabled={pending || !lines.length}>Brouillon</Button>
          <Button onClick={() => submit(true)} disabled={pending || !lines.length}>{pending ? <Loader2 className="animate-spin" /> : <Lock />} Valider</Button>
        </div>
      </div>
    </div>
  );
}
