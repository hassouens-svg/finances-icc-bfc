"use client";
import * as React from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionForm, SubmitButton, useFieldError } from "@/components/action-form";
import { LinkBox } from "@/components/copy-button";
import { MODULES, PRESETS, computeAccess, type Level, type Preset } from "@/lib/access";
import { inviteUserAction, updateMemberRolesAction } from "@/server/actions/admin";
import type { ActionResult } from "@/lib/action-types";
import { cn } from "@/lib/utils";

const LEVELS: { v: Level; l: string }[] = [{ v: "none", l: "Aucun accès" }, { v: "view", l: "Voir" }, { v: "edit", l: "Gérer" }];

/**
 * Choix des droits : un rôle prêt à l'emploi en un clic, ou « Personnalisé » module par module
 * (Aucun accès / Voir / Gérer) + validation des dépenses.
 */
export function AccessEditor({ roles = ["treasurer"], allowRemove = false }: { roles?: string[]; allowRemove?: boolean }) {
  const initial = computeAccess(roles);
  const [preset, setPreset] = React.useState<Preset | "none">(initial.preset);
  const [modules, setModules] = React.useState(initial.modules);
  const [ap, setAp] = React.useState(initial.approve);
  const options: { key: Preset | "none"; label: string; desc: string }[] = [
    ...PRESETS,
    { key: "custom", label: "Personnalisé", desc: "Partir de zéro et choisir module par module ce que la personne voit ou gère" },
    ...(allowRemove ? [{ key: "none" as const, label: "Retirer l'accès", desc: "La personne ne voit plus rien de cette église" }] : []),
  ];
  return (
    <div className="space-y-3">
      <input type="hidden" name="preset" value={preset} />
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button key={o.key} type="button" onClick={() => { if (o.key === "custom" && preset !== "custom") { setModules(Object.fromEntries(MODULES.map((m) => [m.key, "none"])) as typeof modules); setAp({ treasurer: false, pastor: false }); } setPreset(o.key); }} aria-pressed={preset === o.key}
            className={cn("rounded-xl border p-3 text-left transition-colors", preset === o.key ? (o.key === "none" ? "border-danger bg-danger-soft" : "border-accent bg-accent-soft/60") : "border-border hover:bg-surface")}>
            <span className="flex items-center gap-1.5 text-[14px] font-medium">{o.key === "custom" && <SlidersHorizontal className="size-3.5" />}{o.label}</span>
            <span className="mt-0.5 block text-[12px] text-muted">{o.desc}</span>
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead><tr className="bg-surface text-[12px] text-muted"><th className="h-9 px-3 text-left font-medium">Module</th>{LEVELS.map((l) => <th key={l.v} className="w-20 px-1 font-medium">{l.l}</th>)}</tr></thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key} className="border-t border-border">
                  <td className="px-3 py-2">{m.num ? <span className="num mr-1.5 text-accent">{m.num}</span> : null}{m.label}</td>
                  {LEVELS.map((l) => (
                    <td key={l.v} className="text-center">
                      <input type="radio" name={`mod_${m.key}`} value={l.v} checked={modules[m.key] === l.v} onChange={() => setModules({ ...modules, [m.key]: l.v })}
                        className="size-[18px] cursor-pointer accent-[var(--accent)]" aria-label={`${m.label} : ${l.l}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1.5 border-t border-border bg-surface px-3 py-2.5">
            <Checkbox name="ap_treasurer" checked={ap.treasurer} onChange={(e) => setAp({ ...ap, treasurer: e.target.checked })} label="Valide les dépenses à l'étape « Trésorier »" className="text-[13px]" />
            <Checkbox name="ap_pastor" checked={ap.pastor} onChange={(e) => setAp({ ...ap, pastor: e.target.checked })} label="Valide les dépenses à l'étape « Pasteur / Responsable »" className="text-[13px]" />
          </div>
        </div>
      )}
    </div>
  );
}

function F({ name, ...p }: { name: string; label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return <Field {...p} htmlFor={name} error={useFieldError(name)} />;
}

/** Créer un compte (avec mot de passe ou lien d'invitation) et lui donner ses droits. */
export function CreateAccountDialog({ churches, defaultChurchId, canMother = false, canSuper = false, label = "Créer un compte", variant = "primary" }: {
  churches: { value: string; label: string }[]; defaultChurchId?: string; canMother?: boolean; canSuper?: boolean; label?: string; variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [churchId, setChurchId] = React.useState(defaultChurchId ?? churches[0]?.value ?? "");
  return (
    <>
      <Button variant={variant} onClick={() => { setLink(null); setOpen(true); }}><Plus /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Créer un compte" description="Choisissez un mot de passe maintenant, ou laissez vide pour obtenir un lien d'invitation." wide>
          {link ? (
            <div className="space-y-4">
              <p className="text-[14px]">Compte créé. Envoyez ce lien à la personne (valable 7 jours) pour qu&apos;elle choisisse son mot de passe :</p>
              <LinkBox url={link} title="Votre accès à ICC BFC Finances" text="Bonjour, voici le lien pour activer votre compte ICC BFC Finances :" />
              <Button variant="secondary" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          ) : (
            <ActionForm action={inviteUserAction} onSuccess={(r: ActionResult) => { if (r.ok && r.data?.link) setLink(String(r.data.link)); else setOpen(false); }} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <F name="name" label="Nom complet"><Input id="name" name="name" required /></F>
                <F name="email" label="Email"><Input id="email" name="email" type="email" required /></F>
                <F name="password" label="Mot de passe" optional hint="10 caractères minimum. Vide = lien d'invitation."><Input id="password" name="password" type="text" autoComplete="off" minLength={10} /></F>
                <F name="churchId" label="Église">
                  <Select id="churchId" name="churchId" value={churchId} onChange={(e) => setChurchId(e.target.value)} disabled={churches.length === 1}>
                    {canMother && <option value="">Aucune église précise</option>}
                    {churches.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                  {churches.length === 1 && <input type="hidden" name="churchId" value={churchId} />}
                </F>
              </div>
              {churchId && (
                <div>
                  <p className="mb-2 text-[13px] font-medium">Droits dans cette église</p>
                  <AccessEditor roles={["treasurer"]} />
                </div>
              )}
              {(canMother || canSuper) && (
                <div className="space-y-2 rounded-xl border border-border bg-surface p-3.5">
                  {canMother && <Checkbox name="motherAdmin" label="Administrateur église mère — voit et pilote toutes les églises" />}
                  {canSuper && <Checkbox name="superAdmin" label="Super administrateur — tous les droits" />}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                <SubmitButton>Créer le compte</SubmitButton>
              </div>
            </ActionForm>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Modifier les droits d'un membre (ou retirer son accès). */
export function EditAccessDialog({ teamId, userId, roles, userName, churchName }: { teamId: string; userId: string; roles: string[]; userName: string; churchName: string }) {
  const [open, setOpen] = React.useState(false);
  const mother = teamId === "eglise-mere";
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><SlidersHorizontal /> Droits</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Droits de ${userName}`} description={churchName} wide>
          <ActionForm action={updateMemberRolesAction} onSuccess={() => setOpen(false)} className="space-y-4">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="userId" value={userId} />
            {mother ? <Checkbox name="motherAdmin" defaultChecked label="Administrateur église mère (décochez pour retirer)" /> : <AccessEditor roles={roles} allowRemove />}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <SubmitButton>Enregistrer</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
