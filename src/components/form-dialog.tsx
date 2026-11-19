"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-types";

export function FormDialog({
  trigger, title, description, action, children, submitLabel = "Enregistrer", wide, triggerProps, successMessage,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  wide?: boolean;
  triggerProps?: ButtonProps;
  successMessage?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent title={title} description={description} wide={wide}>
        <ActionForm action={action} onSuccess={() => setOpen(false)} successMessage={successMessage} className="space-y-4">
          {children}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
