"use client";
import * as React from "react";
import { Copy, Check, Share2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { copyText, shareLink } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/** Bouton « Copier » : copie immédiate, retour visuel « Copié ✓ », et repli manuel si le navigateur refuse. */
export function CopyButton({ value, label = "Copier", size = "sm", variant = "secondary", className }: { value: string; label?: string; size?: ButtonProps["size"]; variant?: ButtonProps["variant"]; className?: string }) {
  const [done, setDone] = React.useState(false);
  const [manual, setManual] = React.useState(false);
  return (
    <>
      <Button
        size={size}
        variant={done ? "success" : variant}
        type="button"
        className={className}
        onClick={async () => {
          const ok = await copyText(value);
          if (ok) {
            setDone(true);
            toast.success("Lien copié : collez-le où vous voulez.");
            setTimeout(() => setDone(false), 2000);
          } else setManual(true);
        }}
      >
        {done ? <Check /> : <Copy />} {done ? "Copié" : label}
      </Button>
      <ManualCopyDialog open={manual} onOpenChange={setManual} value={value} />
    </>
  );
}

function ManualCopyDialog({ open, onOpenChange, value }: { open: boolean; onOpenChange: (o: boolean) => void; value: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => { if (open) setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 100); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Copier le lien" description="Votre navigateur bloque la copie automatique : le lien est sélectionné, faites « Copier » (appui long sur téléphone).">
        <textarea ref={ref} readOnly value={value} rows={3} className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-[13px]" onFocus={(e) => e.currentTarget.select()} />
      </DialogContent>
    </Dialog>
  );
}

/** Partage natif (WhatsApp, SMS, email…) sur téléphone ; sur ordinateur, ouvre WhatsApp Web. */
export function ShareButton({ url, title, text, size = "sm", className }: { url: string; title: string; text?: string; size?: ButtonProps["size"]; className?: string }) {
  return (
    <Button
      size={size}
      variant="secondary"
      type="button"
      className={className}
      onClick={async () => {
        const r = await shareLink(url, title, text);
        if (r === "unsupported") window.open(`https://wa.me/?text=${encodeURIComponent(`${text ?? title}\n${url}`)}`, "_blank", "noopener");
      }}
    >
      <Share2 /> Partager
    </Button>
  );
}

/** Encadré lien + Copier + Partager + WhatsApp, utilisé partout où un lien doit être transmis. */
export function LinkBox({ url, title, text, className }: { url: string; title: string; text?: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted" title={url}>{url}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <CopyButton value={url} label="Copier le lien" variant="primary" />
        <ShareButton url={url} title={title} text={text} />
        <Button asChild size="sm" variant="secondary">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${text ?? title}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a>
        </Button>
      </div>
    </div>
  );
}
