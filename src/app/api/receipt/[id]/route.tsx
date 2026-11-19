import { NextResponse, type NextRequest } from "next/server";
import { Query } from "node-appwrite";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getContext, canManage } from "@/server/context";
import { adminGet, adminList, audit } from "@/server/data";
import { getSettings } from "@/server/lookups";
import { formatEuro } from "@/lib/format";
import type { Church, Donor, OfferingLine } from "@/lib/types";

export const runtime = "nodejs";
const s = StyleSheet.create({ page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", lineHeight: 1.5 }, h: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#4C1D95", marginBottom: 4 }, box: { border: "1pt solid #EAEAEE", borderRadius: 6, padding: 12, marginVertical: 10 }, b: { fontFamily: "Helvetica-Bold" } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  if (!(await getSettings()).fiscalReceipts) return NextResponse.json({ error: "Reçus fiscaux désactivés" }, { status: 403 });
  const donor = await adminGet<Donor>("donors", id);
  if (!donor || !canManage(ctx, donor.churchId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getUTCFullYear() - 1;
  const church = await adminGet<Church>("churches", donor.churchId);
  const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("donorId", id), Query.greaterThanEqual("date", `${year}-01-01`), Query.lessThan("date", `${year + 1}-01-01`)]);
  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  const doc = (
    <Document title={`Reçu ${year} — ${donor.fullName}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h}>Reçu au titre des dons — année {year}</Text>
        <Text>Articles 200, 238 bis et 978 du code général des impôts</Text>
        <View style={s.box}><Text style={s.b}>Bénéficiaire</Text><Text>{church?.name}</Text><Text>{church?.address ?? ""}</Text></View>
        <View style={s.box}><Text style={s.b}>Donateur</Text><Text>{donor.fullName}</Text><Text>{donor.address ?? "Adresse non renseignée"}</Text></View>
        <View style={s.box}>
          <Text>Le bénéficiaire reconnaît avoir reçu au titre des dons et versements ouvrant droit à réduction d&apos;impôt la somme de :</Text>
          <Text style={[s.b, { fontSize: 16, marginVertical: 6 }]}>{formatEuro(total)}</Text>
          <Text>{lines.length} versement(s) entre le 1er janvier et le 31 décembre {year}. Forme du don : déclaration de don manuel. Nature : numéraire.</Text>
        </View>
        <Text style={{ marginTop: 30 }}>Fait le {new Date().toLocaleDateString("fr-FR")} — Le trésorier (signature)</Text>
        <Text style={{ marginTop: 40, fontSize: 8, color: "#6B6B76" }}>Document généré par ICC BFC Finances. À vérifier par le trésorier avant remise (conformité du statut fiscal de l&apos;association).</Text>
      </Page>
    </Document>
  );
  const buf = await renderToBuffer(doc);
  await audit(ctx, donor.churchId, "export", "donor", id, `Reçu fiscal ${year} généré`);
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="recu-fiscal-${year}.pdf"` } });
}
