"use client";
import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input, Select, Checkbox } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ActionForm, SubmitButton, useFieldError } from "@/components/action-form";
import { centsToInput, toDateInput } from "@/lib/format";
import {
  saveCityAction, saveChurchAction, inviteUserAction, saveDepartmentAction, saveListItemAction, saveBankAccountAction,
  saveWorkflowAction, createPublicLinkAction, updateMemberRolesAction,
} from "@/server/actions/admin";
import type { ActionResult } from "@/lib/action-types";

type Opt = { value: string; label: string };

function FieldErr({ name, children, ...p }: { name: string; label: string; hint?: React.ReactNode; children: React.ReactNode; optional?: boolean }) {
  const e = useFieldError(name);
  return <Field {...p} error={e} htmlFor={name}>{children}</Field>;
}

export function CityDialog({ city }: { city?: { id: string; name: string; region?: string | null } }) {
  return (
    <FormDialog
      trigger={city ? <><Pencil /> Modifier</> : <><Plus /> Nouvelle ville</>}
      triggerProps={{ variant: city ? "ghost" : "secondary", size: city ? "sm" : "md" }}
      title={city ? "Modifier la ville" : "Nouvelle ville"}
      action={saveCityAction}
    >
      {city && <input type="hidden" name="id" value={city.id} />}
      <FieldErr name="name" label="Nom de la ville"><Input id="name" name="name" defaultValue={city?.name} required /></FieldErr>
      <FieldErr name="region" label="Région" optional><Input id="region" name="region" defaultValue={city?.region ?? "Bourgogne-Franche-Comté"} /></FieldErr>
    </FormDialog>
  );
}

function LogoPicker({ current }: { current?: string | null }) {
  const [preview, setPreview] = React.useState<string | null>(current ?? null);
  return (
    <Field label="Logo de l'église" optional hint="JPG, PNG ou WEBP carré de préférence — 2 Mo max.">
      <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-border bg-surface p-3 hover:border-accent/50">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="Aperçu du logo" className="size-full object-cover" /> : <span className="text-[11px] text-muted">Aucun</span>}
        </span>
        <span className="text-[14px] font-medium">{preview ? "Changer le logo" : "Choisir une image"}</span>
        <input type="file" name="logo" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
      </label>
    </Field>
  );
}

function suggestPrefix(text: string) {
  const w = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(icc|impact|centre|chretien|eglise|de|du|la|le|sur)\b/gi, " ").replace(/[^a-zA-Z ]/g, " ").trim();
  return (w.split(/\s+/)[0] ?? "").slice(0, 3).toUpperCase();
}

/** Nom, ville (tapée librement : créée automatiquement si nouvelle) et préfixe proposé automatiquement. */
function ChurchNameCityPrefix({ church, cities }: { church?: { name: string; cityId?: string | null; refPrefix: string }; cities: Opt[] }) {
  const [name, setName] = React.useState(church?.name ?? "");
  const [city, setCity] = React.useState(cities.find((c) => c.value === church?.cityId)?.label ?? "");
  const [prefix, setPrefix] = React.useState(church?.refPrefix ?? "");
  const [touched, setTouched] = React.useState(!!church);
  React.useEffect(() => { if (!touched) setPrefix(suggestPrefix(city || name)); }, [name, city, touched]);
  const known = cities.some((c) => c.label.toLowerCase() === city.trim().toLowerCase());
  return (
    <>
      <FieldErr name="name" label="Nom de l'église"><Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ICC Besançon" required /></FieldErr>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldErr name="cityName" label="Ville" hint={city && !known ? "Nouvelle ville : elle sera créée automatiquement." : "Choisissez ou tapez le nom de la ville."}>
          <Input id="cityName" name="cityName" list="cities-list" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Besançon" autoComplete="off" required />
        </FieldErr>
        <FieldErr name="refPrefix" label="Préfixe des références" hint="Proposé automatiquement (ex. BES-2026-0001)">
          <Input id="refPrefix" name="refPrefix" value={prefix} onChange={(e) => { setTouched(true); setPrefix(e.target.value.toUpperCase()); }} maxLength={5} className="uppercase" required />
        </FieldErr>
      </div>
      <datalist id="cities-list">{cities.map((c) => <option key={c.value} value={c.label} />)}</datalist>
    </>
  );
}

/** Accès de l'église, créés en même temps qu'elle (obligatoires). */
function ChurchAccessFields() {
  const [pwd, setPwd] = React.useState("");
  const gen = () => {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const r = crypto.getRandomValues(new Uint32Array(12));
    setPwd(Array.from(r, (x) => a[x % a.length]).join(""));
  };
  return (
    <div className="space-y-3 rounded-xl border border-accent/25 bg-accent-soft/40 p-3.5">
      <div>
        <p className="text-[14px] font-medium">Accès de l&apos;église</p>
        <p className="text-[12px] text-muted">Le compte du responsable de l&apos;église : il voit et gère tout pour son église et crée lui-même les accès de son équipe. Pour l&apos;église mère : il pilote toutes les églises (sauf le journal d&apos;audit, réservé au super admin).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldErr name="accessName" label="Nom du responsable"><Input id="accessName" name="accessName" placeholder="Prénom Nom" required /></FieldErr>
        <FieldErr name="accessEmail" label="Email de connexion"><Input id="accessEmail" name="accessEmail" type="email" placeholder="eglise.besancon@…" required /></FieldErr>
      </div>
      <FieldErr name="accessPassword" label="Mot de passe" hint={<>10 caractères minimum, à transmettre au responsable. <button type="button" onClick={gen} className="font-medium text-accent underline-offset-2 hover:underline">Générer un mot de passe</button></>}>
        <Input id="accessPassword" name="accessPassword" type="text" autoComplete="off" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={10} required />
      </FieldErr>
    </div>
  );
}

export function ChurchDialog({
  church, cities, isSuperAdmin,
}: { church?: { id: string; name: string; cityId?: string | null; address?: string | null; pastorName?: string | null; refPrefix: string; isMother: boolean; allowLocalLists: boolean; logoUrl?: string | null }; cities: Opt[]; isSuperAdmin: boolean }) {
  return (
    <FormDialog
      trigger={church ? <><Pencil /> Modifier</> : <><Plus /> Nouvelle église</>}
      triggerProps={{ variant: church ? "secondary" : "primary" }}
      title={church ? "Modifier l'église" : "Nouvelle église"}
      description={church ? undefined : "L'église et ses accès sont créés en une fois : le responsable pourra se connecter tout de suite."}
      action={saveChurchAction}
    >
      {church && <input type="hidden" name="id" value={church.id} />}
      <ChurchNameCityPrefix church={church} cities={cities} />
      {!church && <ChurchAccessFields />}
      <FieldErr name="address" label="Adresse" optional><Input id="address" name="address" defaultValue={church?.address ?? ""} /></FieldErr>
      <FieldErr name="pastorName" label="Pasteur / responsable" optional><Input id="pastorName" name="pastorName" defaultValue={church?.pastorName ?? ""} /></FieldErr>
      <LogoPicker current={church?.logoUrl} />
      <div className="space-y-2.5 rounded-xl bg-surface p-3.5">
        <Checkbox name="allowLocalLists" label="Autoriser cette église à ajouter ses propres catégories et types" defaultChecked={church?.allowLocalLists ?? true} />
        {isSuperAdmin && <Checkbox name="isMother" label="Église mère régionale (pilote les autres églises)" defaultChecked={church?.isMother} />}
      </div>
    </FormDialog>
  );
}

export function DepartmentDialog({ churchId, dep }: { churchId: string; dep?: { id: string; name: string; leaderName?: string | null; leaderEmail?: string | null; annualBudgetCents?: number | null } }) {
  return (
    <FormDialog
      trigger={dep ? <Pencil /> : <><Plus /> Département</>}
      triggerProps={dep ? { variant: "ghost", size: "icon-sm", "aria-label": "Modifier" } : { variant: "primary" }}
      title={dep ? "Modifier le département" : "Nouveau département"}
      action={saveDepartmentAction}
    >
      <input type="hidden" name="churchId" value={churchId} />
      {dep && <input type="hidden" name="id" value={dep.id} />}
      <FieldErr name="name" label="Nom"><Input id="name" name="name" defaultValue={dep?.name} placeholder="Louange" required /></FieldErr>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldErr name="leaderName" label="Responsable" optional><Input id="leaderName" name="leaderName" defaultValue={dep?.leaderName ?? ""} /></FieldErr>
        <FieldErr name="leaderEmail" label="Email du responsable" optional><Input id="leaderEmail" name="leaderEmail" type="email" defaultValue={dep?.leaderEmail ?? ""} /></FieldErr>
      </div>
      <FieldErr name="annualBudget" label="Budget annuel" optional hint="Affiche une jauge consommé / restant."><AmountInput id="annualBudget" name="annualBudget" defaultValue={centsToInput(dep?.annualBudgetCents)} /></FieldErr>
    </FormDialog>
  );
}

export const LIST_KINDS: Record<string, { title: string; one: string; placeholder: string }> = {
  expense_category: { title: "Catégories de dépenses", one: "catégorie", placeholder: "Énergie" },
  donation_type: { title: "Types de dons", one: "type de don", placeholder: "Offrande spéciale" },
  cr_request_type: { title: "Types de demandes Cité Royale", one: "type de demande", placeholder: "Matériel" },
  service: { title: "Cultes & événements récurrents", one: "culte", placeholder: "Culte du dimanche" },
};

export function ListItemDialog({ churchId, kind, item }: { churchId: string; kind: string; item?: { id: string; name: string; code?: string | null; isTithe?: boolean; sortOrder?: number } }) {
  const k = LIST_KINDS[kind]!;
  return (
    <FormDialog
      trigger={item ? <Pencil /> : <><Plus /> Ajouter</>}
      triggerProps={item ? { variant: "ghost", size: "icon-sm", "aria-label": "Modifier" } : { variant: "secondary", size: "sm" }}
      title={item ? `Modifier` : `Nouveau : ${k.one}`}
      action={saveListItemAction}
    >
      <input type="hidden" name="churchId" value={churchId} />
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FieldErr name="name" label="Nom"><Input id="name" name="name" defaultValue={item?.name} placeholder={k.placeholder} required /></FieldErr>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldErr name="code" label="Code comptable" optional><Input id="code" name="code" defaultValue={item?.code ?? ""} placeholder="6061" /></FieldErr>
        <FieldErr name="sortOrder" label="Ordre d'affichage"><Input id="sortOrder" name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} /></FieldErr>
      </div>
      {kind === "donation_type" && <Checkbox name="isTithe" label="C'est une dîme" defaultChecked={item?.isTithe} />}
    </FormDialog>
  );
}

export function BankAccountDialog({ churchId, acc }: { churchId: string; acc?: { id: string; label: string; bankName?: string | null; ibanMasked?: string | null; openingBalanceCents: number; openingDate?: string | null } }) {
  return (
    <FormDialog
      trigger={acc ? <Pencil /> : <><Plus /> Compte bancaire</>}
      triggerProps={acc ? { variant: "ghost", size: "icon-sm", "aria-label": "Modifier" } : { variant: "primary" }}
      title={acc ? "Modifier le compte" : "Nouveau compte bancaire"}
      description="Ne saisissez jamais l'IBAN complet : seuls les 4 derniers chiffres servent à reconnaître le compte."
      action={saveBankAccountAction}
    >
      <input type="hidden" name="churchId" value={churchId} />
      {acc && <input type="hidden" name="id" value={acc.id} />}
      <FieldErr name="label" label="Libellé"><Input id="label" name="label" defaultValue={acc?.label} placeholder="Compte courant" required /></FieldErr>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldErr name="bankName" label="Banque" optional><Input id="bankName" name="bankName" defaultValue={acc?.bankName ?? ""} placeholder="Crédit Mutuel" /></FieldErr>
        <FieldErr name="ibanLast4" label="4 derniers chiffres" optional><Input id="ibanLast4" name="ibanLast4" inputMode="numeric" maxLength={4} defaultValue={acc?.ibanMasked?.slice(-4) ?? ""} /></FieldErr>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldErr name="openingBalance" label="Solde de départ"><AmountInput id="openingBalance" name="openingBalance" defaultValue={centsToInput(acc?.openingBalanceCents ?? 0)} /></FieldErr>
        <FieldErr name="openingDate" label="À la date du"><Input id="openingDate" name="openingDate" type="date" defaultValue={toDateInput(acc?.openingDate ?? new Date())} required /></FieldErr>
      </div>
    </FormDialog>
  );
}

export function WorkflowDialog({
  churches, categories, wf,
}: { churches: Opt[]; categories: Opt[]; wf?: { id: string; churchId: string; name: string; minCents: number; maxCents?: number | null; stepRoles: string[]; stepDelaysHours: number[]; categoryIds: string[]; priority: number } }) {
  const [steps, setSteps] = React.useState<{ role: string; delay: number }[]>(
    wf ? wf.stepRoles.map((r, i) => ({ role: r, delay: wf.stepDelaysHours[i] ?? 72 })) : [{ role: "treasurer", delay: 48 }],
  );
  return (
    <FormDialog
      trigger={wf ? <Pencil /> : <><Plus /> Nouvelle règle</>}
      triggerProps={wf ? { variant: "ghost", size: "icon-sm", "aria-label": "Modifier" } : { variant: "primary" }}
      title={wf ? "Modifier la règle" : "Nouvelle règle de validation"}
      description="La règle la plus précise s'applique : église > région, puis catégorie, puis montant."
      action={saveWorkflowAction}
      wide
    >
      {wf && <input type="hidden" name="id" value={wf.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldErr name="name" label="Nom de la règle"><Input id="name" name="name" defaultValue={wf?.name} placeholder="Plus de 500 €" required /></FieldErr>
        <FieldErr name="churchId" label="S'applique à">
          <Select id="churchId" name="churchId" defaultValue={wf?.churchId ?? "region"}>
            <option value="region">Toutes les églises</option>
            {churches.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </FieldErr>
        <FieldErr name="min" label="À partir de (inclus)"><AmountInput id="min" name="min" defaultValue={centsToInput(wf?.minCents ?? 0)} /></FieldErr>
        <FieldErr name="max" label="Jusqu'à (exclu)" optional hint="Vide = sans limite"><AmountInput id="max" name="max" defaultValue={centsToInput(wf?.maxCents)} /></FieldErr>
      </div>
      <Field label="Catégories concernées" optional hint="Laissez vide pour toutes les catégories.">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.value} className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-[13px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong">
              <input type="checkbox" name="categoryIds[]" value={c.value} defaultChecked={wf?.categoryIds.includes(c.value)} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Étapes de validation (dans l'ordre)">
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">{i + 1}</span>
              <Select name="stepRoles[]" value={s.role} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} className="h-10">
                <option value="treasurer">Trésorier</option>
                <option value="pastor">Pasteur / Responsable</option>
                <option value="mother_admin">Église mère</option>
              </Select>
              <div className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
                <Input name="stepDelays[]" type="number" min={1} max={720} value={s.delay} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, delay: Number(e.target.value) } : x)))} className="h-10 w-20" aria-label="Délai en heures" />h
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))} disabled={steps.length === 1} aria-label="Retirer l'étape"><Trash2 /></Button>
            </li>
          ))}
        </ol>
        <Button type="button" variant="secondary" size="sm" className="mt-2 self-start" onClick={() => setSteps([...steps, { role: "pastor", delay: 72 }])}><Plus /> Ajouter une étape</Button>
      </Field>
      <input type="hidden" name="priority" value={wf?.priority ?? 0} />
    </FormDialog>
  );
}

export function PublicLinkDialog({ churchId, departments }: { churchId: string; departments: Opt[] }) {
  const [kind, setKind] = React.useState("funding");
  return (
    <FormDialog trigger={<><Plus /> Nouveau lien</>} title="Nouveau lien public" description="À partager par WhatsApp ou par QR code. Aucun compte n'est nécessaire pour l'utiliser." action={createPublicLinkAction}>
      <input type="hidden" name="churchId" value={churchId} />
      <FieldErr name="kind" label="Type de formulaire">
        <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="funding">Besoin d&apos;un département (demande de financement)</option>
          <option value="reimbursement">Demande de remboursement</option>
        </Select>
      </FieldErr>
      {kind === "funding" && (
        <FieldErr name="departmentId" label="Département" hint="Laissez « Tous » pour un lien général avec liste déroulante.">
          <Select id="departmentId" name="departmentId" defaultValue="">
            <option value="">Tous les départements</option>
            {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </FieldErr>
      )}
      <FieldErr name="label" label="Nom interne" optional><Input id="label" name="label" placeholder="Lien affiché dans le groupe des responsables" /></FieldErr>
      <FieldErr name="expiresAt" label="Expire le" optional><Input id="expiresAt" name="expiresAt" type="date" /></FieldErr>
    </FormDialog>
  );
}
