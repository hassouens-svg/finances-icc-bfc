import { notFound, redirect } from "next/navigation";
import { requireContext, canManage } from "@/server/context";
import { getScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { expenseFormData } from "../../form-data";
import type { Expense } from "@/lib/types";

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const e = await getScoped<Expense>(ctx, "expenses", id);
  if (!e) notFound();
  if (!canManage(ctx, e.churchId, "depenses") || !["draft", "rejected", "in_approval"].includes(e.status)) redirect(`/app/depenses/${id}`);
  const data = await expenseFormData(ctx, e.churchId);
  return (
    <>
      <PageHeader back={{ href: `/app/depenses/${id}`, label: e.reference }} title="Modifier la dépense" description={e.status !== "draft" ? "Toute modification relance le circuit de validation depuis le début." : undefined} />
      <ExpenseForm {...data} initial={{ ...e, id: e.$id, $permissions: undefined } as never} />
    </>
  );
}
