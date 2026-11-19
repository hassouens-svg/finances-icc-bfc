import { Receipt } from "lucide-react";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { expenseFormData } from "../form-data";

export const metadata = { title: "Nouvelle dépense" };

export default async function NewExpense({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requireContext();
  const data = await expenseFormData(ctx);
  if (!data.churches.length) return <EmptyState icon={<Receipt />} title="Vous n'avez pas les droits de saisie" />;
  return (
    <>
      <PageHeader module={5} back={{ href: "/app/depenses", label: "Dépenses" }} title="Nouvelle dépense" />
      <ExpenseForm {...data} defaultProjectId={(await searchParams).project} />
    </>
  );
}
