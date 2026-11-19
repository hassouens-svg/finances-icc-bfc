"use client";
import * as React from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { FileCapture } from "@/components/detail/client";
import { createDepositAction } from "@/server/actions/deposits";
import { formatEuro, formatDate, parseEuroToCents } from "@/lib/format";
import { cn } from "@/lib/utils";

type S = { id: string; reference: string; date: string; serviceName?: string | null; cashCents: number; cheques: { id: string; amountCents: number; ref?: string | null; donor?: string | null }[] };

export function DepositForm({ churchId, accounts, sessions }: { churchId: string; accounts: { id: string; label: string }[]; sessions: S[] }) {
  const [mode, setMode] = React.useState<"sessions" | "free">(sessions.length ? "sessions" : "free");
  const [selected, setSelected] = React.useState<string[]>(sessions.map((s) => s.id));
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [freeCash, setFreeCash] = React.useState("");
  const [freeCheque, setFreeCheque] = React.useState("");
  const chosen = sessions.filter((s) => selected.includes(s.id));
  const cash = mode === "sessions" ? chosen.reduce((a, s) => a + s.cashCents, 0) : parseEuroToCents(freeCash) || 0;
  const chequeList = chosen.flatMap((s) => s.cheques).filter((c) => !excluded.includes(c.id));
  const cheque = mode === "sessions" ? chequeList.reduce((a, c) => a + c.amountCents, 0) : parseEuroToCents(freeCheque) || 0;
  return (
    <ActionForm action={createDepositAction} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="churchId" value={churchId} />
      <input type="hidden" name="mode" value={mode} />
      {mode === "sessions" && selected.map((id) => <input key={id} type="hidden" name="sessionIds[]" value={id} />)}
      {excluded.map((id) => <input key={id} type="hidden" name="excludedCheques[]" value={id} />)}
      <div className="space-y-5">
        <Card>
          <CardHeader title="1. Que déposez-vous ?" />
          <CardBody className="space-y-4">
            <div className="flex gap-1.5 rounded-xl bg-surface-2 p-1">
              {(["sessions", "free"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-lg px-3 py-2 text-[13px] font-medium", mode === m ? "bg-bg shadow-card" : "text-muted")}>
                  {m === "sessions" ? "Séances d'offrandes" : "Montant libre"}
                </button>
              ))}
            </div>
            {mode === "sessions" ? (
              sessions.length === 0 ? <p className="text-[14px] text-muted">Toutes les séances validées sont déjà déposées. 🎉</p> : (
                <ul className="space-y-2">
                  {sessions.map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <li key={s.id} className={cn("rounded-xl border p-3", on ? "border-accent bg-accent-soft/40" : "border-border")}>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={on} onChange={() => setSelected(on ? selected.filter((x) => x !== s.id) : [...selected, s.id])} className="size-[18px] accent-[var(--accent)]" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium">{s.serviceName ?? "Culte"} du {formatDate(s.date)}</span>
                            <span className="block text-[12px] text-muted">{s.reference} · espèces {formatEuro(s.cashCents)} · {s.cheques.length} chèque(s)</span>
                          </span>
                          <span className="num font-semibold">{formatEuro(s.cashCents + s.cheques.reduce((a, c) => a + c.amountCents, 0))}</span>
                        </label>
                        {on && s.cheques.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-border pt-2 pl-8">
                            {s.cheques.map((c) => (
                              <Checkbox key={c.id} className="text-[13px]" checked={!excluded.includes(c.id)} onChange={() => setExcluded(excluded.includes(c.id) ? excluded.filter((x) => x !== c.id) : [...excluded, c.id])}
                                label={<span className="num">Chèque {c.ref ? `n° ${c.ref}` : ""} {c.donor ? `— ${c.donor}` : ""} · {formatEuro(c.amountCents)}</span>} />
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Espèces"><AmountInput name="freeCash" value={freeCash} onChange={(e) => setFreeCash(e.target.value)} /></Field>
                <Field label="Chèques"><AmountInput name="freeCheque" value={freeCheque} onChange={(e) => setFreeCheque(e.target.value)} /></Field>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="2. Le dépôt" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Compte bancaire"><Select name="bankAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Field>
            <Field label="Date du dépôt"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
            <Field label="Déposant" optional><Input name="depositorName" placeholder="Qui va à la banque ?" /></Field>
            <Field label="N° de bordereau" optional><Input name="slipNumber" inputMode="numeric" /></Field>
            <div className="sm:col-span-2"><FileCapture label="Photo du bordereau / reçu de dépôt" /></div>
            <Checkbox name="alreadyDeposited" defaultChecked label="L'argent a déjà été remis à la banque" className="sm:col-span-2" />
          </CardBody>
        </Card>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader title="Récapitulatif" />
          <CardBody className="space-y-2.5 text-[14px]">
            <div className="flex justify-between"><span className="text-muted">Espèces</span><span className="num">{formatEuro(cash)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Chèques {mode === "sessions" ? `(${chequeList.length})` : ""}</span><span className="num">{formatEuro(cheque)}</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-[17px] font-semibold"><span>Total déposé</span><span className="num text-accent">{formatEuro(cash + cheque)}</span></div>
            <p className="text-[12px] text-muted">Une fois « Déposé », la caisse diminue et la banque augmente du même montant.</p>
            <SubmitButton size="lg" className="w-full" disabled={cash + cheque <= 0}>Enregistrer le dépôt</SubmitButton>
          </CardBody>
        </Card>
      </aside>
    </ActionForm>
  );
}
