"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EnvelopeGrid } from "./envelope-grid";
import {
  Table2, Rows3, Plus, Trash2, Pencil, UserRound, EyeOff, Lock, Loader2, AlertTriangle, CheckCircle2, CloudCheck, RotateCw, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { formatEuro, parseEuroToCents, centsToInput } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import { sessionTotals } from "@/lib/finance";
import {
  addLinesAction, updateLineAction, deleteLineAction, saveSessionMetaAction, validateSessionAction,
  type SavedLine, type EntryInput, type SessionMeta,
} from "@/server/actions/offerings";

type Opt = { id: string; name: string };
type Line = SavedLine & { key: string; state: "saving" | "saved" | "error"; error?: string; input?: EntryInput };
const METHODS = ["cash", "cheque", "transfer", "card", "mobile"] as const;

function useLocal<T>(key: string, initial: T) {
  const [v, setV] = React.useState<T>(initial);
  React.useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch {}
  }, [key]);
  const set = (x: T) => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch {} };
  return [v, set] as const;
}

export function EnvelopeEntry({
  session, initialLines, donationTypes, services, initialDonors,
}: {
  session: { id: string; reference: string; churchName: string; date: string; serviceId?: string | null; counter1Name?: string | null; counter2Name?: string | null; countedCashCents: number; countedChequeCents: number; notes?: string | null };
  initialLines: SavedLine[];
  donationTypes: Opt[];
  services: Opt[];
  initialDonors: Opt[];
}) {
  const router = useRouter();
  const [lines, setLines] = React.useState<Line[]>(() => initialLines.map((l) => ({ ...l, key: l.id, state: "saved" })));
  const [donors, setDonors] = React.useState<Opt[]>(initialDonors);
  const [saving, setSaving] = React.useState(0);
  const queue = React.useRef<Promise<unknown>>(Promise.resolve());

  // Saisie en cours (préférences mémorisées entre deux enveloppes et deux séances)
  const [nominative, setNominative] = useLocal("icc-env-nominative", true);
  const [typeId, setTypeId] = useLocal("icc-env-type", donationTypes.find((t) => /d[iî]me/i.test(t.name))?.id ?? donationTypes[0]?.id ?? "");
  const [method, setMethod] = useLocal<string>("icc-env-method", "cash");
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [chequeRef, setChequeRef] = React.useState("");
  const [editing, setEditing] = React.useState<Line | null>(null);
  const [filter, setFilter] = React.useState("");
  const nameRef = React.useRef<HTMLInputElement>(null);
  const amountRef = React.useRef<HTMLInputElement>(null);
  const type = donationTypes.some((t) => t.id === typeId) ? typeId : donationTypes[0]?.id ?? "";

  // En-tête & comptage (enregistrement automatique)
  const [date, setDate] = React.useState(session.date);
  const [serviceId, setServiceId] = React.useState(session.serviceId ?? "");
  const [c1, setC1] = React.useState(session.counter1Name ?? "");
  const [c2, setC2] = React.useState(session.counter2Name ?? "");
  const [countedCash, setCountedCash] = React.useState(session.countedCashCents ? centsToInput(session.countedCashCents) : "");
  const [countedCheque, setCountedCheque] = React.useState(session.countedChequeCents ? centsToInput(session.countedChequeCents) : "");
  const [validating, startValidate] = React.useTransition();
  // Tableur sur ordinateur, fiche sur téléphone (modifiable)
  const [mode, setMode] = React.useState<"grid" | "cards">("cards");
  React.useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("icc-env-mode"); } catch {}
    setMode(saved === "grid" || saved === "cards" ? saved : window.matchMedia("(min-width: 1024px)").matches ? "grid" : "cards");
  }, []);
  const changeMode = (m: "grid" | "cards") => { setMode(m); try { localStorage.setItem("icc-env-mode", m); } catch {} };

  const enqueue = <T,>(fn: () => Promise<T>) => {
    setSaving((n) => n + 1);
    const p = queue.current.then(fn).finally(() => setSaving((n) => n - 1));
    queue.current = p.catch(() => {});
    return p;
  };

  const saveMeta = (m: SessionMeta) =>
    enqueue(async () => {
      const r = await saveSessionMetaAction(session.id, m);
      if (!r.ok) toast.error(r.error);
    });

  const matchDonor = (n: string) => donors.find((d) => d.name.toLowerCase() === n.trim().toLowerCase());

  const resetEntry = () => {
    setName("");
    setAmount("");
    setChequeRef("");
    setEditing(null);
    (nominative ? nameRef : amountRef).current?.focus();
  };

  const submit = () => {
    const cents = parseEuroToCents(amount);
    if (isNaN(cents) || cents <= 0) { toast.error("Saisissez le montant de l'enveloppe."); amountRef.current?.focus(); return; }
    if (nominative && !name.trim()) { toast.error("Indiquez le nom du donateur, ou choisissez « Anonyme »."); nameRef.current?.focus(); return; }
    const d = nominative ? matchDonor(name) : undefined;
    const input: EntryInput = { donationTypeId: type, amountCents: cents, method: method as EntryInput["method"], anonymous: !nominative, donorId: d?.id ?? null, donorName: nominative ? name.trim() : null, chequeRef: method === "cheque" ? chequeRef || null : null };
    if (editing) updateInput(editing, input);
    else addInput(input);
    resetEntry();
  };

  const optimisticOf = (input: EntryInput): SavedLine => {
    const d = input.donorId ? donors.find((x) => x.id === input.donorId) : undefined;
    return { id: "", donationTypeId: input.donationTypeId, donationTypeName: donationTypes.find((t) => t.id === input.donationTypeId)?.name ?? "", amountCents: input.amountCents, method: input.method, anonymous: input.anonymous, donorId: input.donorId ?? null, donorName: input.anonymous ? null : d?.name ?? input.donorName ?? null, chequeRef: input.chequeRef ?? null };
  };
  function addInput(input: EntryInput) {
    const key = crypto.randomUUID();
    setLines((ls) => [{ ...optimisticOf(input), key, state: "saving", input }, ...ls]);
    pending.current.push({ key, input });
    flush();
  }
  function updateInput(line: Line, input: EntryInput) {
    const key = line.key;
    const lineId = line.id;
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...optimisticOf(input), id: lineId, state: "saving", input } : l)));
    enqueue(() => persist(key, input, lineId));
  }

  // Envois groupés : tout ce qui est saisi pendant un envoi part dans le lot suivant.
  const pending = React.useRef<{ key: string; input: EntryInput }[]>([]);
  const flushing = React.useRef<Promise<void> | null>(null);
  const flush = () => {
    if (flushing.current) return flushing.current;
    setSaving((n) => n + 1);
    flushing.current = (async () => {
      while (pending.current.length) {
        const batch = pending.current.splice(0, 100);
        const r = await addLinesAction(session.id, batch.map((b) => b.input)).catch(() => ({ ok: false as const, error: "Connexion perdue : réessayez." }));
        if (r.ok) {
          const byKey = new Map(batch.map((b, i) => [b.key, r.results[i]!]));
          setLines((ls) => ls.map((l) => {
            const res = byKey.get(l.key);
            if (!res) return l;
            return res.ok ? { ...l, ...res.line, state: "saved", error: undefined } : { ...l, state: "error", error: res.error };
          }));
          if (r.newDonors.length) setDonors((ds) => [...ds, ...r.newDonors].sort((a, b) => a.name.localeCompare(b.name)));
          const errs = r.results.filter((x) => !x.ok).length;
          if (errs) toast.error(`${errs} enveloppe(s) non enregistrée(s) : voir la liste.`);
        } else {
          const keys = new Set(batch.map((b) => b.key));
          setLines((ls) => ls.map((l) => (keys.has(l.key) ? { ...l, state: "error", error: r.error } : l)));
          toast.error(r.error);
        }
      }
    })().finally(() => { flushing.current = null; setSaving((n) => n - 1); });
    return flushing.current;
  };

  async function persist(key: string, input: EntryInput, lineId?: string) {
    if (!lineId) { pending.current.push({ key, input }); await flush(); return; }
    const r = await updateLineAction(lineId, input);
    if (r.ok) {
      setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...r.line, state: "saved", error: undefined } : l)));
      if (r.newDonor) setDonors((ds) => [...ds, r.newDonor!].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setLines((ls) => ls.map((l) => (l.key === key ? { ...l, state: "error", error: r.error } : l)));
      toast.error(r.error);
    }
  }

  const retry = (l: Line) => {
    if (!l.input) return;
    setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, state: "saving" } : x)));
    enqueue(() => persist(l.key, l.input!, l.id || undefined));
  };

  const del = (l: Line) => {
    if (!window.confirm(`Supprimer l'enveloppe de ${formatEuro(l.amountCents)}${l.donorName ? ` (${l.donorName})` : ""} ?`)) return;
    setLines((ls) => ls.filter((x) => x.key !== l.key));
    if (l.id) enqueue(async () => { const r = await deleteLineAction(l.id); if (!r.ok) toast.error(r.error); });
  };

  const edit = (l: Line) => {
    setEditing(l);
    setNominative(!l.anonymous);
    setName(l.donorName ?? "");
    setAmount(centsToInput(l.amountCents));
    setTypeId(l.donationTypeId);
    setMethod(l.method);
    setChequeRef(l.chequeRef ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => amountRef.current?.focus(), 200);
  };

  const t = sessionTotals(lines, parseEuroToCents(countedCash) || 0, parseEuroToCents(countedCheque) || 0);
  const countedFilled = countedCash !== "" || countedCheque !== "";
  const byType = donationTypes.map((ty) => ({ ...ty, total: lines.filter((l) => l.donationTypeId === ty.id).reduce((a, l) => a + l.amountCents, 0) })).filter((x) => x.total > 0);
  const failed = lines.filter((l) => l.state === "error").length;
  const shown = filter ? lines.filter((l) => `${l.donorName ?? "anonyme"} ${l.donationTypeName} ${centsToInput(l.amountCents)}`.toLowerCase().includes(filter.toLowerCase())) : lines;
  const nominativeCount = lines.filter((l) => !l.anonymous).length;

  const validate = () => {
    if (saving > 0 || lines.some((l) => l.state === "saving")) return toast.info("Patientez : les dernières enveloppes s'enregistrent.");
    if (failed) return toast.error("Certaines enveloppes n'ont pas été enregistrées : réessayez-les ou supprimez-les.");
    if (!c1.trim() || !c2.trim()) return toast.error("Indiquez le nom des deux compteurs.");
    if (t.cash + t.cheque > 0 && !countedFilled) return toast.error("Renseignez le montant compté (espèces et chèques).");
    if (countedFilled && t.gap !== 0 && !window.confirm(`Écart de ${formatEuro(t.gap, { sign: true })} entre le comptage et la saisie. Valider quand même ? L'écart sera signalé.`)) return;
    startValidate(async () => {
      await queue.current;
      await flushing.current;
      const r = await validateSessionAction(session.id);
      if (r.ok) { toast.success(r.message); router.push(r.redirect!); } else toast.error(r.error);
    });
  };

  const status = (
    <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", failed ? "text-danger" : saving ? "text-muted" : "text-success")} aria-live="polite">
      {failed ? <><AlertTriangle className="size-3.5" /> {failed} non enregistrée(s)</> : saving ? <><Loader2 className="size-3.5 animate-spin" /> Enregistrement…</> : <><CloudCheck className="size-3.5" /> Tout est enregistré</>}
    </span>
  );

  return (
    <div className="grid gap-5 pb-32 lg:grid-cols-[1fr_340px] lg:pb-0">
      <div className="space-y-5">
        {/* 1. Le culte */}
        <Card>
          <CardHeader title="1. Le culte" description={`${session.churchName} · ${session.reference}`} action={status} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value) saveMeta({ date: e.target.value }); }} /></Field>
            <Field label="Culte / événement">
              <Select value={serviceId} onChange={(e) => { setServiceId(e.target.value); saveMeta({ serviceId: e.target.value || null }); }}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="">Autre</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        {/* Bascule tableur / fiche */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight">2. Les enveloppes</h3>
          <div className="flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Mode de saisie">
            <button type="button" role="tab" aria-selected={mode === "grid"} onClick={() => changeMode("grid")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium", mode === "grid" ? "bg-bg shadow-card" : "text-muted")}><Table2 className="size-4" /> Tableur</button>
            <button type="button" role="tab" aria-selected={mode === "cards"} onClick={() => changeMode("cards")} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium", mode === "cards" ? "bg-bg shadow-card" : "text-muted")}><Rows3 className="size-4" /> Fiche</button>
          </div>
        </div>
        {mode === "grid" ? (
          <EnvelopeGrid lines={lines} donationTypes={donationTypes} donors={donors} onAdd={addInput} onUpdate={(l, input) => updateInput(l as Line, input)} onDelete={(l) => del(l as Line)} onRetry={(l) => retry(l as Line)} />
        ) : (
          <>
        {/* 2. Les enveloppes */}
        <Card className={cn(editing && "border-accent ring-4 ring-accent-soft")}>
          <CardHeader
            title={editing ? `Modifier l'enveloppe n°${lines.length - lines.findIndex((l) => l.key === editing.key)}` : "2. Les enveloppes"}
            description={editing ? undefined : "Une enveloppe = une ligne. Elle est enregistrée dès que vous appuyez sur Entrée ou « Ajouter »."}
            action={editing ? <Button variant="ghost" size="sm" onClick={resetEntry}><X /> Annuler</Button> : undefined}
          />
          <CardBody>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Donateur">
                <button type="button" role="radio" aria-checked={nominative} onClick={() => { setNominative(true); setTimeout(() => nameRef.current?.focus(), 0); }}
                  className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium", nominative ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}>
                  <UserRound className="size-4" /> Nominatif
                </button>
                <button type="button" role="radio" aria-checked={!nominative} onClick={() => { setNominative(false); setName(""); setTimeout(() => amountRef.current?.focus(), 0); }}
                  className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium", !nominative ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}>
                  <EyeOff className="size-4" /> Anonyme
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
                {nominative ? (
                  <Field label="Nom du donateur" hint={name && !matchDonor(name) ? "Nouveau donateur : sa fiche sera créée automatiquement." : name ? "Donateur connu ✓" : "Tapez les premières lettres pour retrouver un donateur."}>
                    <Input ref={nameRef} list="env-donors" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" autoComplete="off" autoCapitalize="words"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); amountRef.current?.focus(); } }} autoFocus />
                  </Field>
                ) : (
                  <div className="flex items-center rounded-xl border border-dashed border-border bg-surface px-4 text-[14px] text-muted sm:mt-[26px] sm:h-14">Enveloppe anonyme : aucun nom enregistré.</div>
                )}
                <Field label="Montant">
                  <AmountInput ref={amountRef} size="lg" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!nominative} />
                </Field>
              </div>
              <datalist id="env-donors">{donors.map((d) => <option key={d.id} value={d.name} />)}</datalist>
              <div>
                <p className="mb-1.5 text-[13px] font-medium">Type de don</p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Type de don">
                  {donationTypes.map((ty) => (
                    <button key={ty.id} type="button" role="radio" aria-checked={type === ty.id} onClick={() => setTypeId(ty.id)}
                      className={cn("h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium", type === ty.id ? "border-accent bg-accent text-white" : "border-border bg-bg hover:bg-surface")}>
                      {ty.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium">Moyen de paiement</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Moyen de paiement">
                  {METHODS.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                      className={cn("h-10 rounded-xl border text-[13px] font-medium", method === m ? "border-accent bg-accent-soft text-accent-strong" : "border-border hover:bg-surface")}>
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
              {method === "cheque" && <Field label="N° du chèque" optional><Input inputMode="numeric" value={chequeRef} onChange={(e) => setChequeRef(e.target.value)} /></Field>}
              <Button type="submit" size="lg" className="w-full">{editing ? <><CheckCircle2 /> Enregistrer la modification</> : <><Plus /> Ajouter l&apos;enveloppe</>}</Button>
              <p className="hidden text-center text-[12px] text-muted sm:block">Astuce : Nom → Entrée → Montant → Entrée. Le type et le moyen restent sélectionnés pour l&apos;enveloppe suivante.</p>
            </form>
          </CardBody>
        </Card>

        {/* Liste des enveloppes */}
        <Card>
          <CardHeader title={`Enveloppes saisies (${lines.length})`} description={`${nominativeCount} nominative(s) · ${lines.length - nominativeCount} anonyme(s)`} />
          {lines.length > 8 && (
            <div className="px-5 pb-3">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Retrouver une enveloppe (nom, montant)…" className="h-10 pl-9 text-[14px]" /></div>
            </div>
          )}
          {lines.length === 0 ? (
            <p className="border-t border-border px-5 py-8 text-center text-[14px] text-muted">Aucune enveloppe pour l&apos;instant. Commencez la saisie ci-dessus.</p>
          ) : (
            <ol className="divide-y divide-border border-t border-border">
              {shown.map((l) => {
                const n = lines.length - lines.indexOf(l);
                return (
                  <li key={l.key} className={cn("flex items-center gap-3 px-4 py-2.5 text-[14px] sm:px-5", l.state === "error" && "bg-danger-soft", editing?.key === l.key && "bg-accent-soft")}>
                    <span className="num w-8 shrink-0 text-[12px] text-muted">n°{n}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.anonymous ? <span className="text-muted">Anonyme</span> : l.donorName}</p>
                      <p className="truncate text-[12px] text-muted">{l.donationTypeName} · {METHOD_LABELS[l.method]}{l.chequeRef ? ` · n° ${l.chequeRef}` : ""}{l.state === "error" ? ` · ${l.error}` : ""}</p>
                    </div>
                    <span className="num font-semibold">{formatEuro(l.amountCents)}</span>
                    <span className="w-5" aria-label={l.state === "saved" ? "Enregistrée" : l.state === "saving" ? "Enregistrement" : "Erreur"}>
                      {l.state === "saving" ? <Loader2 className="size-4 animate-spin text-muted" /> : l.state === "saved" ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-danger" />}
                    </span>
                    {l.state === "error" ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => retry(l)} aria-label="Réessayer"><RotateCw /></Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => edit(l)} disabled={l.state === "saving"} aria-label="Modifier"><Pencil /></Button>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => del(l)} disabled={l.state === "saving"} aria-label="Supprimer"><Trash2 /></Button>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

          </>
        )}

        {/* 3. Comptage */}
        <Card>
          <CardHeader title="3. Comptage sécurisé" description="À la fin : deux personnes recomptent ensemble espèces et chèques." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Compteur 1"><Input id="c1" value={c1} onChange={(e) => setC1(e.target.value)} onBlur={() => saveMeta({ counter1Name: c1 || null })} placeholder="Nom et prénom" /></Field>
            <Field label="Compteur 2"><Input id="c2" value={c2} onChange={(e) => setC2(e.target.value)} onBlur={() => saveMeta({ counter2Name: c2 || null })} placeholder="Nom et prénom" /></Field>
            <Field label="Espèces comptées" hint={`Saisi : ${formatEuro(t.cash)}`}>
              <AmountInput id="cc" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} onBlur={() => saveMeta({ countedCashCents: parseEuroToCents(countedCash) || 0 })} />
            </Field>
            <Field label="Chèques comptés" hint={`Saisi : ${formatEuro(t.cheque)}`}>
              <AmountInput id="cq" value={countedCheque} onChange={(e) => setCountedCheque(e.target.value)} onBlur={() => saveMeta({ countedChequeCents: parseEuroToCents(countedCheque) || 0 })} />
            </Field>
            {countedFilled && (
              <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium sm:col-span-2", t.gap === 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                {t.gap === 0 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                {t.gap === 0 ? "Comptage conforme à la saisie" : `Écart de comptage : ${formatEuro(t.gap, { sign: true })}`}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Récapitulatif */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <Card>
          <CardHeader title="Récapitulatif" action={status} />
          <CardBody className="space-y-3 text-[14px]">
            <div className="flex justify-between"><span className="text-muted">Enveloppes</span><span className="num">{lines.length}</span></div>
            {byType.map((b) => <div key={b.id} className="flex justify-between"><span className="text-muted">{b.name}</span><span className="num">{formatEuro(b.total)}</span></div>)}
            <hr className="border-border" />
            <div className="flex justify-between"><span className="text-muted">Espèces</span><span className="num">{formatEuro(t.cash)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Chèques</span><span className="num">{formatEuro(t.cheque)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Virement / carte / mobile</span><span className="num">{formatEuro(t.other)}</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-[16px] font-semibold"><span>Total</span><span className="num text-accent">{formatEuro(t.entered)}</span></div>
            <Button onClick={validate} disabled={validating || !lines.length} size="lg" className="w-full">{validating ? <Loader2 className="animate-spin" /> : <Lock />} Valider la séance</Button>
            <p className="text-[12px] text-muted">Vous pouvez fermer cette page à tout moment : la saisie est conservée et reprend où vous en étiez.</p>
          </CardBody>
        </Card>
      </aside>

      {/* Barre mobile */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-3"><span className="text-muted">{lines.length} env.</span>{status}</span>
          <span className="num text-[17px] font-semibold text-accent">{formatEuro(t.entered)}</span>
        </div>
        <Button onClick={validate} disabled={validating || !lines.length} className="w-full">{validating ? <Loader2 className="animate-spin" /> : <Lock />} Valider la séance</Button>
      </div>
    </div>
  );
}
