import { notFound, redirect } from "next/navigation";
import { requireContext, canManage } from "@/server/context";
import { getScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { CrForm } from "../../cr-form";
import { crFormData } from "../../form-data";
import type { CrRequest } from "@/lib/types";

export default async function EditCr({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const cr = await getScoped<CrRequest>(ctx, "cr_requests", id);
  if (!cr) notFound();
  if (!canManage(ctx, cr.churchId, "citeroyale") || ["closed"].includes(cr.status)) redirect(`/app/cite-royale/${id}`);
  const data = await crFormData(ctx, cr.churchId);
  return (<><PageHeader back={{ href: `/app/cite-royale/${id}`, label: cr.reference }} title="Modifier la demande" /><CrForm {...data} initial={{ ...cr, id: cr.$id }} /></>);
}
