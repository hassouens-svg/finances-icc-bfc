"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Textarea, Checkbox } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { uploadAttachmentAction, addCommentAction, transitionAction } from "@/server/actions/common";

/** Ajout de fichiers : sur téléphone, ouvre directement l'appareil photo. */
export function FileCapture({ name = "files", required, label = "Prendre une photo ou choisir un fichier" }: { name?: string; required?: boolean; label?: string }) {
  const [files, setFiles] = React.useState<File[]>([]);
  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-surface px-4 py-5 text-center hover:border-accent/50">
        <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent"><Camera className="size-5" /></span>
        <span className="text-[14px] font-medium">{label}</span>
        <span className="text-[12px] text-muted">JPG, PNG, WEBP, HEIC ou PDF — 10 Mo max par fichier</span>
        <input type="file" name={name} accept="image/*,application/pdf" capture="environment" multiple required={required} className="sr-only"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </label>
      {files.length > 0 && <p className="mt-2 text-[13px] text-muted">{files.length} fichier(s) : {files.map((f) => f.name).join(", ")}</p>}
    </div>
  );
}

export function UploadForm({ entityType, entityId }: { entityType: string; entityId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => {
        const fl = Array.from(e.target.files ?? []);
        if (!fl.length) return;
        start(async () => {
          const fd = new FormData();
          fd.set("entityType", entityType); fd.set("entityId", entityId);
          fl.forEach((f) => fd.append("files", f));
          const r = await uploadAttachmentAction(fd);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
          if (ref.current) ref.current.value = "";
        });
      }} />
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Upload />} Ajouter un fichier</Button>
    </>
  );
}

export function CommentForm({ entityType, entityId }: { entityType: string; entityId: string }) {
  return (
    <ActionForm action={addCommentAction} resetOnSuccess className="space-y-2">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <Textarea name="body" placeholder="Ajouter un commentaire…" className="min-h-16" required />
      <div className="flex items-center justify-between gap-2">
        {["reimbursement", "funding_request"].includes(entityType) ? <Checkbox name="internal" defaultChecked label="Interne (non visible du demandeur)" className="text-[13px]" /> : <span />}
        <SubmitButton size="sm" variant="secondary">Commenter</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Bouton de changement de statut, avec commentaire (obligatoire ou facultatif). */
export function TransitionButton({ entityType, entityId, to, label, comment, tone = "primary" }: { entityType: string; entityId: string; to: string; label: string; comment?: "required" | "optional"; tone?: string }) {
  const [open, setOpen] = React.useState(false);
  const variant = ({ primary: "primary", secondary: "secondary", danger: "danger-soft", success: "success" } as Record<string, ButtonProps["variant"]>)[tone] ?? "primary";
  const form = (
    <ActionForm action={transitionAction} onSuccess={() => setOpen(false)} className="space-y-3">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="to" value={to} />
      {comment && <Textarea name="comment" placeholder={comment === "required" ? "Motif (obligatoire)" : "Commentaire (facultatif)"} required={comment === "required"} />}
      <div className="flex justify-end gap-2">
        {comment && <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>}
        <SubmitButton variant={variant} className={comment ? "" : "w-full sm:w-auto"}>{label}</SubmitButton>
      </div>
    </ActionForm>
  );
  if (!comment) return form;
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={label}>{form}</DialogContent>
      </Dialog>
    </>
  );
}
