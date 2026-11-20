"use client";
import * as React from "react";
import { Trash2, Loader2, CheckCircle2, AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro, parseEuroToCents, centsToInput } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import type { EntryInput, SavedLine } from "@/server/actions/offerings";

type Opt = { id: string; name: string };
export type GridLine = SavedLine & { key: string; state: "saving" | "saved" | "error"; error?: string };
type Draft = { donor: string; typeId: string; method: string; amount: string; cheque: string };

const METHODS = ["cash", "cheque", "transfer", "card", "mobile"] as const;
const COLS = ["donor", "type", "method", "amount", "cheque"] as const;
type Col = (typeof COLS)[number];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Suggestions de donateurs : d'abord ceux qui commencent par la saisie, puis ceux qui la contiennent. */
function suggest(donors: Opt[], q: string) {
  const n = norm(q);
  if (!n) return [];
  const starts = donors.filter((d) => norm(d.name).startsWith(n) || norm(d.name).split(" ").some((w) => w.startsWith(n)));
  const contains = donors.filter((d) => !starts.includes(d) && norm(d.name).includes(n));
  return [...starts, ...contains].slice(0, 6);
}

function toDraft(l: GridLine): Draft {
  return { donor: l.anonymous ? "" : l.donorName ?? "", typeId: l.donationTypeId, method: l.method, amount: centsToInput(l.amountCents), cheque: l.chequeRef ?? "" };
}

function toInput(d: Draft, donors: Opt[]): EntryInput | string {
  const cents = parseEuroToCents(d.amount);
  if (isNaN(cents) || cents <= 0) return "Montant invalide";
  const name = d.donor.trim();
  const match = donors.find((x) => norm(x.name) === norm(name));
  return {
    donationTypeId: d.typeId, amountCents: cents, method: d.method as EntryInput["method"], anonymous: !name,
    donorId: match?.id ?? null, donorName: name ? match?.name ?? name : null, chequeRef: d.method === "cheque" ? d.cheque || null : null,
  };
}

function DonorCell({ value, onChange, donors, onCommit, cellRef, onNav }: {
  value: string; onChange: (v: string) => void; donors: Opt[]; onCommit: () => void; cellRef: (el: HTMLInputElement | null) => void; onNav: (dir: "up" | "down") => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const list = open ? suggest(donors, value) : [];
  const exact = list.some((d) => norm(d.name) === norm(value));
  const choose = (name: string) => { onChange(name); setOpen(false); };
  return (
    <div className="relative">
      <input
        ref={cellRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (list.length && !exact && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setHi((h) => (e.key === "ArrowDown" ? Math.min(list.length - 1, h + 1) : Math.max(0, h - 1)));
            return;
          }
          if ((e.key === "Enter" || e.key === "Tab") && list.length && !exact && value.trim()) {
            choose(list[hi]!.name);
            if (e.key === "Enter") { e.preventDefault(); onCommit(); }
            return;
          }
          if (e.key === "Enter") { e.preventDefault(); setOpen(false); onCommit(); return; }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); onNav(e.key === "ArrowDown" ? "down" : "up"); }
        }}
        placeholder="Anonyme"
        autoComplete="off"
        spellCheck={false}
        aria-label="Donateur (vide = anonyme)"
        className="h-10 w-full bg-transparent px-3 text-[14px] outline-none placeholder:text-muted/60"
      />
      {list.length > 0 && !exact && (
        <ul className="absolute left-0 top-full z-20 mt-1 w-full min-w-56 overflow-hidden rounded-xl border border-border bg-bg py-1 shadow-pop" role="listbox">
          {list.map((d, i) => (
            <li key={d.id} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); choose(d.name); }}
              className={cn("cursor-pointer px-3 py-1.5 text-[14px]", i === hi && "bg-accent-soft text-accent-strong")}>{d.name}</li>
          ))}
          <li className="border-t border-border px-3 py-1 text-[11px] text-muted">↑↓ pour choisir · Entrée pour valider</li>
        </ul>
      )}
      {value.trim() && !donors.some((d) => norm(d.name) === norm(value)) && !open && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-strong">nouveau</span>
      )}
    </div>
  );
}

/** Saisie des enveloppes façon tableur (ordinateur). */
export function EnvelopeGrid({
  lines, donationTypes, donors, onAdd, onUpdate, onDelete, onRetry,
}: {
  lines: GridLine[];
  donationTypes: Opt[];
  donors: Opt[];
  onAdd: (input: EntryInput) => void;
  onUpdate: (line: GridLine, input: EntryInput) => void;
  onDelete: (line: GridLine) => void;
  onRetry: (line: GridLine) => void;
}) {
  const rows = React.useMemo(() => [...lines].reverse(), [lines]); // ordre de saisie, de haut en bas
  const last = rows[rows.length - 1];
  const blank = React.useCallback((): Draft => ({ donor: "", typeId: last?.donationTypeId ?? donationTypes.find((t) => /d[iî]me/i.test(t.name))?.id ?? donationTypes[0]?.id ?? "", method: last?.method ?? "cash", amount: "", cheque: "" }), [last, donationTypes]);
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [newRow, setNewRow] = React.useState<Draft>(blank);
  const [err, setErr] = React.useState<string | null>(null);
  const cells = React.useRef<Record<string, HTMLElement | null>>({});
  const focus = (rowKey: string, col: Col) => setTimeout(() => { const el = cells.current[`${rowKey}:${col}`]; el?.focus(); if (el instanceof HTMLInputElement) el.select(); }, 0);

  const draftOf = (l: GridLine) => drafts[l.key] ?? toDraft(l);
  const setDraft = (l: GridLine, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [l.key]: { ...draftOf(l), ...patch } }));

  // Enregistre une ligne existante modifiée quand on la quitte
  const commitExisting = (l: GridLine) => {
    const d = drafts[l.key];
    if (!d) return;
    const before = toDraft(l);
    if (JSON.stringify(d) === JSON.stringify(before)) { setDrafts(({ [l.key]: _, ...rest }) => rest); return; }
    const input = toInput(d, donors);
    if (typeof input === "string") { setErr(`Ligne n°${rows.indexOf(l) + 1} : ${input}`); return; }
    setErr(null);
    onUpdate(l, input);
    setDrafts(({ [l.key]: _, ...rest }) => rest);
  };

  const commitNew = () => {
    if (!newRow.amount.trim()) { focus("new", "amount"); return; }
    const input = toInput(newRow, donors);
    if (typeof input === "string") { setErr(input); focus("new", "amount"); return; }
    setErr(null);
    onAdd(input);
    setNewRow({ ...newRow, donor: "", amount: "", cheque: "" });
    focus("new", "donor");
  };

  const nav = (rowIndex: number, col: Col, dir: "up" | "down") => {
    const target = dir === "down" ? rowIndex + 1 : rowIndex - 1;
    if (target < 0) return;
    if (target >= rows.length) focus("new", col);
    else focus(rows[target]!.key, col);
  };

  const rowLeave = (l: GridLine) => (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitExisting(l);
  };

  const cellCls = "border-r border-border last:border-r-0 focus-within:bg-accent-soft/40 focus-within:shadow-[inset_0_0_0_2px_var(--accent)]";
  const inputCls = "h-10 w-full bg-transparent px-3 text-[14px] outline-none";
  const selectCls = "h-10 w-full cursor-pointer appearance-none bg-transparent px-3 text-[14px] outline-none";

  const renderRow = (key: string, i: number | null, d: Draft, set: (p: Partial<Draft>) => void, onEnter: () => void, line?: GridLine) => (
    <>
      <td className={cn("num w-12 border-r border-border px-2 text-center text-[12px] text-muted", !line && "text-accent")}>{line ? i! + 1 : "+"}</td>
      <td className={cn(cellCls, "min-w-[220px]")}>
        <DonorCell value={d.donor} onChange={(v) => set({ donor: v })} donors={donors} onCommit={() => (line ? nav(i!, "donor", "down") : focus("new", "amount"))} cellRef={(el) => { cells.current[`${key}:donor`] = el; }} onNav={(dir) => i !== null ? nav(i, "donor", dir) : dir === "up" && rows.length && focus(rows[rows.length - 1]!.key, "donor")} />
      </td>
      <td className={cn(cellCls, "w-48")}>
        <select ref={(el) => { cells.current[`${key}:type`] = el; }} value={d.typeId} onChange={(e) => set({ typeId: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} className={selectCls} aria-label="Type de don">
          {donationTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </td>
      <td className={cn(cellCls, "w-40")}>
        <select ref={(el) => { cells.current[`${key}:method`] = el; }} value={d.method} onChange={(e) => set({ method: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} className={selectCls} aria-label="Moyen de paiement">
          {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </select>
      </td>
      <td className={cn(cellCls, "w-36")}>
        <input ref={(el) => { cells.current[`${key}:amount`] = el; }} value={d.amount} onChange={(e) => set({ amount: e.target.value })} inputMode="decimal" placeholder="0,00" aria-label="Montant"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onEnter(); }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (i !== null) nav(i, "amount", e.key === "ArrowDown" ? "down" : "up"); else if (e.key === "ArrowUp" && rows.length) focus(rows[rows.length - 1]!.key, "amount"); }
          }}
          className={cn(inputCls, "num text-right font-medium")} />
      </td>
      <td className={cn(cellCls, "w-32")}>
        <input ref={(el) => { cells.current[`${key}:cheque`] = el; }} value={d.cheque} onChange={(e) => set({ cheque: e.target.value })} disabled={d.method !== "cheque"} placeholder={d.method === "cheque" ? "N°" : "—"} aria-label="Numéro du chèque"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} className={cn(inputCls, "disabled:cursor-not-allowed disabled:text-muted/40")} />
      </td>
      <td className="w-20 px-2">
        <div className="flex items-center justify-end gap-0.5">
          {line ? (
            <>
              <span className="grid size-7 place-items-center" title={line.state === "error" ? line.error : line.state === "saving" ? "Enregistrement…" : "Enregistrée"}>
                {line.state === "saving" ? <Loader2 className="size-4 animate-spin text-muted" /> : line.state === "saved" ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-danger" />}
              </span>
              {line.state === "error" ? (
                <button type="button" onClick={() => onRetry(line)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2" aria-label="Réessayer"><RotateCw className="size-4" /></button>
              ) : (
                <button type="button" onClick={() => onDelete(line)} disabled={line.state === "saving"} className="grid size-7 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Supprimer la ligne ${i! + 1}`}><Trash2 className="size-4" /></button>
              )}
            </>
          ) : (
            <button type="button" onClick={commitNew} className="rounded-lg bg-accent px-2.5 py-1 text-[12px] font-semibold text-white">Ajouter</button>
          )}
        </div>
      </td>
    </>
  );

  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface text-[12px] font-medium text-muted">
              <th className="w-12 border-r border-border px-2 py-2 text-center">N°</th>
              <th className="border-r border-border px-3 py-2">Donateur <span className="font-normal">(vide = anonyme)</span></th>
              <th className="border-r border-border px-3 py-2">Type de don</th>
              <th className="border-r border-border px-3 py-2">Moyen</th>
              <th className="border-r border-border px-3 py-2 text-right">Montant</th>
              <th className="border-r border-border px-3 py-2">N° chèque</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (
              <tr key={l.key} onBlur={rowLeave(l)} className={cn("border-b border-border", l.state === "error" && "bg-danger-soft/60", drafts[l.key] && "bg-warning-soft/40")}>
                {renderRow(l.key, i, draftOf(l), (p) => setDraft(l, p), () => { commitExisting(l); nav(i, "donor", "down"); }, l)}
              </tr>
            ))}
            <tr className="bg-accent-soft/20">
              {renderRow("new", null, newRow, (p) => setNewRow({ ...newRow, ...p }), commitNew)}
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface text-[14px] font-semibold">
              <td colSpan={4} className="px-3 py-2.5">{lines.length} enveloppe(s)</td>
              <td className="num px-3 py-2.5 text-right text-accent">{formatEuro(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-[12px] text-muted">
        <span><b className="text-fg">Nom</b> ↵ → <b className="text-fg">Montant</b> ↵ : la ligne est enregistrée et une nouvelle ligne s&apos;ouvre. Tab pour changer de colonne, ↑↓ pour changer de ligne. Type et moyen sont repris de la ligne précédente.</span>
        {err && <span className="font-medium text-danger">{err}</span>}
      </div>
    </div>
  );
}
