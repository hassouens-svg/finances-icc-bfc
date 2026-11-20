"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Select, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEuro, formatDate } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import {
  detectOfferings, detectExpenses, buildOfferingRows, buildExpenseRows, norm,
  type OfferingMapping, type ExpenseMapping, type OfferingImportRow, type ExpenseImportRow,
} from "@/lib/import-map";
import { parseSpreadsheetAction, importOfferingsAction, importExpensesAction, type ParsedSheet } from "@/server/actions/import";

type Opt = { id: string; name: string };
type Kind = "offerings" | "expenses";
const CHUNK = 300;

function ColSelect({ label, value, onChange, headers, optional = true, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; headers: string[]; optional?: boolean; hint?: string }) {
  return (
    <Field label={label} optional={optional} hint={hint}>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={cn(value == null && !optional && "border-danger")}>
        <option value="">— Aucune —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </Select>
    </Field>
  );
}

export function ImportWizard({ kind, churches, donationTypes, categories }: { kind: Kind; churches: Opt[]; donationTypes: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const [churchId, setChurchId] = React.useState(churches[0]?.id ?? "");
  const [fileName, setFileName] = React.useState("");
  const [sheets, setSheets] = React.useState<ParsedSheet[] | null>(null);
  const [sheetIdx, setSheetIdx] = React.useState(0);
  const [om, setOm] = React.useState<OfferingMapping | null>(null);
  const [em, setEm] = React.useState<ExpenseMapping | null>(null);
  const [defaultType, setDefaultType] = React.useState(donationTypes.find((t) => /offrande simple/i.test(t.name))?.id ?? donationTypes[0]?.id ?? "");
  const [defaultMethod, setDefaultMethod] = React.useState(kind === "offerings" ? "cash" : "bank_transfer");
  const [updateTreasury, setUpdateTreasury] = React.useState(false);
  const [parsing, startParse] = React.useTransition();
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const sheet = sheets?.[sheetIdx];

  const detect = (s: ParsedSheet) => {
    if (kind === "offerings") setOm(detectOfferings(s.headers, s.rows, donationTypes));
    else setEm(detectExpenses(s.headers, s.rows));
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    startParse(async () => {
      const fd = new FormData();
      fd.set("file", f);
      const r = await parseSpreadsheetAction(fd);
      if (!r.ok) { toast.error(r.error); return; }
      // feuille la plus pertinente : celle qui a le plus de lignes
      const best = r.sheets.reduce((b, s, i) => (s.rows.length > r.sheets[b]!.rows.length ? i : b), 0);
      setSheets(r.sheets);
      setSheetIdx(best);
      detect(r.sheets[best]!);
    });
  };

  const built = React.useMemo(() => {
    if (!sheet) return null;
    if (kind === "offerings" && om) return buildOfferingRows(sheet.rows, om, { defaultTypeId: defaultType, defaultMethod, types: donationTypes, headerRow: sheet.headerRow });
    if (kind === "expenses" && em) return buildExpenseRows(sheet.rows, em, { defaultMethod, headerRow: sheet.headerRow });
    return null;
  }, [sheet, kind, om, em, defaultType, defaultMethod, donationTypes]);

  const rows = (built?.rows ?? []) as (OfferingImportRow | ExpenseImportRow)[];
  const total = rows.reduce((a, r) => a + r.amountCents, 0);
  const dates = rows.map((r) => r.date).sort();
  const ready = kind === "offerings" ? om?.date != null && (om?.amounts.length ?? 0) > 0 : em?.date != null && (em?.amount != null || em?.debit != null);
  const typeName = (id: string) => donationTypes.find((t) => t.id === id)?.name ?? "—";
  const newDonors = kind === "offerings" ? new Set((rows as OfferingImportRow[]).filter((r) => r.donorName).map((r) => norm(r.donorName))).size : 0;
  const unknownCats = kind === "expenses" ? [...new Set((rows as ExpenseImportRow[]).map((r) => r.categoryName).filter((c): c is string => !!c && !categories.some((x) => norm(x.name) === norm(c))))] : [];

  const runImport = async () => {
    const batchId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    setProgress({ done: 0, total: rows.length });
    let done = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const r = kind === "offerings"
        ? await importOfferingsAction({ churchId, batchId, fileName, rows: chunk as OfferingImportRow[], updateTreasury })
        : await importExpensesAction({ churchId, batchId, fileName, rows: chunk as ExpenseImportRow[], updateTreasury });
      if (!r.ok) {
        toast.error(`${r.error}${done ? ` (${done} lignes déjà importées : vous pouvez annuler l'import ci-dessous)` : ""}`);
        setProgress(null);
        router.refresh();
        return;
      }
      done += chunk.length;
      setProgress({ done, total: rows.length });
    }
    setProgress(null);
    setResult(`${done} ${kind === "offerings" ? "dons" : "dépenses"} importé(e)s pour ${formatEuro(total)}.`);
    toast.success("Import terminé.");
    setSheets(null);
    router.refresh();
  };

  if (result) {
    return (
      <Card><CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <p className="text-[17px] font-semibold">Import terminé</p>
        <p className="text-[14px] text-muted">{result}</p>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => setResult(null)}>Importer un autre fichier</Button><Button onClick={() => router.push(kind === "offerings" ? "/app/offrandes?p=all" : "/app/depenses?p=all")}>Voir les {kind === "offerings" ? "offrandes" : "dépenses"}</Button></div>
      </CardBody></Card>
    );
  }

  if (!sheet) {
    return (
      <Card>
        <CardHeader title="1. Choisir le fichier" description="Excel (.xlsx) ou CSV. Les colonnes sont reconnues automatiquement ; vous pourrez vérifier avant d'importer." />
        <CardBody className="space-y-4">
          {churches.length > 1 && <Field label="Église"><Select value={churchId} onChange={(e) => setChurchId(e.target.value)}>{churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
          <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-10 text-center hover:border-accent/50", parsing && "pointer-events-none opacity-60")}>
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">{parsing ? <Loader2 className="size-6 animate-spin" /> : <FileSpreadsheet className="size-6" />}</span>
            <span className="text-[15px] font-medium">{parsing ? `Lecture de « ${fileName} »…` : "Choisir un fichier Excel ou CSV"}</span>
            <span className="text-[13px] text-muted">
              {kind === "offerings"
                ? "Accepte « une ligne par don » (date, nom, type, montant) ou « une ligne par culte » (date, dîmes, offrandes…)."
                : "Une ligne par dépense : date, libellé, catégorie, fournisseur, montant…"}
            </span>
            <input type="file" accept=".xlsx,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="flex items-center gap-1.5 text-[12px] text-muted"><Upload className="size-3.5" /> Ancien format .xls ? Ouvrez-le dans Excel puis « Enregistrer sous » .xlsx.</p>
        </CardBody>
      </Card>
    );
  }

  const preview = rows.slice(0, 12);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={`2. Vérifier — « ${fileName} »`} description={`${sheet.total} ligne(s) lue(s) dans la feuille « ${sheet.name} » (en-têtes ligne ${sheet.headerRow}).`}
          action={<Button variant="ghost" size="sm" onClick={() => setSheets(null)}><ArrowLeft /> Autre fichier</Button>} />
        <CardBody className="space-y-4">
          {sheets!.length > 1 && (
            <Field label="Feuille">
              <Select value={sheetIdx} onChange={(e) => { const i = Number(e.target.value); setSheetIdx(i); detect(sheets![i]!); }}>
                {sheets!.map((s, i) => <option key={i} value={i}>{s.name} ({s.rows.length} lignes)</option>)}
              </Select>
            </Field>
          )}
          {kind === "offerings" && om && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <ColSelect label="Date" optional={false} value={om.date} onChange={(v) => setOm({ ...om, date: v })} headers={sheet.headers} />
                <ColSelect label="Donateur (nom)" value={om.donor} onChange={(v) => setOm({ ...om, donor: v })} headers={sheet.headers} hint="Vide = dons anonymes" />
                <ColSelect label="Moyen de paiement" value={om.method} onChange={(v) => setOm({ ...om, method: v })} headers={sheet.headers} />
                <ColSelect label="Type de don" value={om.type} onChange={(v) => setOm({ ...om, type: v })} headers={sheet.headers} />
                <ColSelect label="Culte" value={om.service} onChange={(v) => setOm({ ...om, service: v })} headers={sheet.headers} />
                <ColSelect label="N° de chèque" value={om.cheque} onChange={(v) => setOm({ ...om, cheque: v })} headers={sheet.headers} />
              </div>
              <div className="rounded-xl border border-border p-3.5">
                <p className="mb-2 text-[13px] font-medium">Colonnes de montants {om.amounts.length > 1 && <span className="font-normal text-muted">— une colonne par type de don (format « une ligne par culte »)</span>}</p>
                <div className="space-y-2">
                  {om.amounts.map((a, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Select value={a.col} onChange={(e) => setOm({ ...om, amounts: om.amounts.map((x, j) => (j === i ? { ...x, col: Number(e.target.value) } : x)) })} className="h-10 w-56">
                        {sheet.headers.map((h, k) => <option key={k} value={k}>{h}</option>)}
                      </Select>
                      <span className="text-[13px] text-muted">→</span>
                      <Select value={a.typeId ?? ""} onChange={(e) => setOm({ ...om, amounts: om.amounts.map((x, j) => (j === i ? { ...x, typeId: e.target.value || null } : x)) })} className="h-10 w-56">
                        <option value="">{om.type != null ? "Type lu dans la colonne « type »" : "Type par défaut"}</option>
                        {donationTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => setOm({ ...om, amounts: om.amounts.filter((_, j) => j !== i) })}>Retirer</Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setOm({ ...om, amounts: [...om.amounts, { col: 0, typeId: null }] })}>+ Ajouter une colonne de montant</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type par défaut" hint="Quand le type n'est pas reconnu"><Select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>{donationTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
                <Field label="Moyen par défaut"><Select value={defaultMethod} onChange={(e) => setDefaultMethod(e.target.value)}>{["cash", "cheque", "transfer", "card", "mobile"].map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}</Select></Field>
              </div>
            </>
          )}
          {kind === "expenses" && em && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <ColSelect label="Date" optional={false} value={em.date} onChange={(v) => setEm({ ...em, date: v })} headers={sheet.headers} />
                <ColSelect label="Montant" optional={false} value={em.amount} onChange={(v) => setEm({ ...em, amount: v })} headers={sheet.headers} />
                <ColSelect label="Libellé / objet" value={em.title} onChange={(v) => setEm({ ...em, title: v })} headers={sheet.headers} />
                <ColSelect label="Catégorie" value={em.category} onChange={(v) => setEm({ ...em, category: v })} headers={sheet.headers} />
                <ColSelect label="Fournisseur" value={em.supplier} onChange={(v) => setEm({ ...em, supplier: v })} headers={sheet.headers} />
                <ColSelect label="Moyen de paiement" value={em.method} onChange={(v) => setEm({ ...em, method: v })} headers={sheet.headers} />
                <ColSelect label="Département" value={em.department} onChange={(v) => setEm({ ...em, department: v })} headers={sheet.headers} />
                <ColSelect label="Débit (si colonne séparée)" value={em.debit} onChange={(v) => setEm({ ...em, debit: v })} headers={sheet.headers} />
                <ColSelect label="Notes" value={em.notes} onChange={(v) => setEm({ ...em, notes: v })} headers={sheet.headers} />
              </div>
              <Field label="Moyen par défaut"><Select value={defaultMethod} onChange={(e) => setDefaultMethod(e.target.value)} className="sm:w-64"><option value="bank_transfer">Virement</option><option value="card">Carte</option><option value="cheque">Chèque</option><option value="cash">Espèces</option></Select></Field>
              {unknownCats.length > 0 && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent-strong">Nouvelles catégories créées automatiquement : {unknownCats.slice(0, 8).join(", ")}{unknownCats.length > 8 ? "…" : ""}</p>}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Aperçu" description={ready ? `${rows.length} ${kind === "offerings" ? "dons" : "dépenses"} · ${formatEuro(total)}${dates.length ? ` · du ${formatDate(dates[0]!)} au ${formatDate(dates[dates.length - 1]!)}` : ""}${kind === "offerings" ? ` · ${newDonors} donateur(s) nommé(s)` : ""}` : "Indiquez au moins la date et le montant."} />
        {ready && (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="bg-surface text-[12px] text-muted">
                {(kind === "offerings" ? ["Date", "Donateur", "Type", "Moyen", "Montant"] : ["Date", "Libellé", "Catégorie", "Fournisseur", "Montant"]).map((h, i) => <th key={h} className={cn("h-9 px-3 text-left font-medium", i === 4 && "text-right")}>{h}</th>)}
              </tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="h-9 px-3">{formatDate(r.date)}</td>
                    {"typeId" in r ? (
                      <><td className="px-3">{r.donorName ?? <span className="text-muted">Anonyme</span>}</td><td className="px-3">{typeName(r.typeId)}</td><td className="px-3">{METHOD_LABELS[r.method]}</td></>
                    ) : (
                      <><td className="px-3">{r.title}</td><td className="px-3">{r.categoryName ?? "—"}</td><td className="px-3">{r.supplier ?? "—"}</td></>
                    )}
                    <td className="num px-3 text-right font-medium">{formatEuro(r.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > preview.length && <p className="border-t border-border px-3 py-2 text-[12px] text-muted">… et {rows.length - preview.length} autre(s) ligne(s).</p>}
          </div>
        )}
        {built && built.errors.length > 0 && (
          <div className="border-t border-border px-5 py-3 text-[13px] text-warning">
            <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> {built.errors.length} ligne(s) ignorée(s)</p>
            <p className="mt-0.5 text-muted">{built.errors.slice(0, 6).map((e) => `ligne ${e.row} : ${e.message}`).join(" · ")}{built.errors.length > 6 ? "…" : ""}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="3. Importer" />
        <CardBody className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-3.5">
            <Checkbox checked={updateTreasury} onChange={(e) => setUpdateTreasury(e.target.checked)} label="Mettre aussi à jour la trésorerie (caisse et banque)" />
            <p className="mt-1.5 pl-7 text-[12px] text-muted">
              Laissez décoché pour un <b>historique</b> : il alimente les rapports, le compte de résultat{kind === "offerings" ? " et les fiches donateurs" : ""}, sans toucher aux soldes (déjà indiqués par le solde de départ du compte bancaire).
            </p>
          </div>
          {progress ? (
            <div className="space-y-2">
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
              <p className="flex items-center gap-2 text-[13px] text-muted"><Loader2 className="size-4 animate-spin" /> {progress.done} / {progress.total} lignes importées…</p>
            </div>
          ) : (
            <Button size="lg" disabled={!ready || !rows.length} onClick={runImport}>Importer {rows.length} ligne(s) <ArrowRight /></Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
