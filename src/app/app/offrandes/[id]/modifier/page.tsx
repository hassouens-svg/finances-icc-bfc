import { redirect } from "next/navigation";

export default async function EditSession({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/app/offrandes/${(await params).id}/saisie`);
}
