"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { ActionResult } from "@/lib/action-types";

/** Suppression définitive, confirmée en recopiant le nom (ou l'email) : rien ne part par un clic malheureux. */
export function DeleteDialog({ action, fields, confirmText, title, warning, label = "Supprimer", size = "sm" }: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  confirmText: string;
  title: string;
  warning: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const ok = typed.trim().toLowerCase() === confirmText.trim().toLowerCase();
  return (
    <>
      <Button type="button" variant="danger-soft" size={size} onClick={() => { setTyped(""); setOpen(true); }}><Trash2 /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} description="Suppression définitive : impossible de revenir en arrière.">
          <ActionForm action={action} onSuccess={() => setOpen(false)} className="space-y-4">
            {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-[14px] text-danger">{warning}</p>
            <label className="block space-y-1.5">
              <span className="text-[14px]">Pour confirmer, recopiez : <b className="select-all">{confirmText}</b></span>
              <Input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label="Confirmation de suppression" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <SubmitButton variant="danger" disabled={!ok}>Supprimer définitivement</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
