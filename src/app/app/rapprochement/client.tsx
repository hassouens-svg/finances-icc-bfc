"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { importStatementAction, matchStatementLineAction } from "@/server/actions/accounting";

export function ImportForm({ churchId, bankAccountId }: { churchId: string; bankAccountId: string }) {
  return (
    <ActionForm action={importStatementAction} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="churchId" value={churchId} />
      <input type="hidden" name="bankAccountId" value={bankAccountId} />
      <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-medium file:text-accent-strong" />
      <SubmitButton className="w-full">Importer</SubmitButton>
    </ActionForm>
  );
}

export function MatchControl({ id, matchedId, suggestion, candidates }: { id: string; matchedId: string; suggestion?: string; candidates: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const save = (value: string) => start(async () => {
    const fd = new FormData();
    fd.set("id", id); fd.set("matchedType", value ? "movement" : ""); fd.set("matchedId", value);
    const r = await matchStatementLineAction(fd);
    if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
  });
  return (
    <div className="flex items-center gap-2">
      {suggestion && !matchedId && <Button size="sm" variant="soft" disabled={pending} onClick={() => save(suggestion)}>Pointer (suggéré)</Button>}
      <select disabled={pending} value={matchedId} onChange={(e) => save(e.target.value)} className="h-8 max-w-[220px] rounded-lg border border-border bg-bg px-2 text-[12px]" aria-label="Pointer avec">
        <option value="">— Pointer avec…</option>
        {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </div>
  );
}
