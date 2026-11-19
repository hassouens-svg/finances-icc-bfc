"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-types";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

const FieldErrorsCtx = React.createContext<Record<string, string>>({});
export const useFieldError = (name: string) => React.useContext(FieldErrorsCtx)[name];

export function ActionForm({
  action, children, className, onSuccess, successMessage, resetOnSuccess, id,
}: { action: Action; children: React.ReactNode; className?: string; onSuccess?: (r: ActionResult) => void; successMessage?: string; resetOnSuccess?: boolean; id?: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction] = React.useActionState(action, null);
  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message || successMessage) toast.success(state.message ?? successMessage);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
      if (state.redirect) router.push(state.redirect);
      else router.refresh();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <FieldErrorsCtx.Provider value={state && !state.ok ? state.fieldErrors ?? {} : {}}>
      <form ref={formRef} action={formAction} className={className} id={id} noValidate={false}>
        {children}
      </form>
    </FieldErrorsCtx.Provider>
  );
}

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Bouton qui déclenche une action serveur simple (sans formulaire visible), avec confirmation optionnelle. */
export function ActionButton({
  action, confirm, children, payload, ...props
}: Omit<ButtonProps, "action"> & { action: (fd: FormData) => Promise<ActionResult>; confirm?: string; payload?: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(payload ?? {})) fd.set(k, v);
          const r = await action(fd);
          if (r.ok) {
            if (r.message) toast.success(r.message);
            if (r.redirect) router.push(r.redirect);
            else router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
