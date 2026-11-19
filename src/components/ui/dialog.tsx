"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Fenêtre centrée sur ordinateur, panneau du bas (bottom sheet) sur téléphone. */
export function DialogContent({
  title, description, children, className, wide,
}: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_.2s_ease]" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-bg shadow-pop outline-none",
          "inset-x-0 bottom-0 rounded-t-3xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
          "data-[state=open]:animate-[fade-up_.25s_cubic-bezier(.2,.7,.2,1)]",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <D.Title className="text-[16px] font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
          </div>
          <D.Close className="-mr-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fermer">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-safe">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
