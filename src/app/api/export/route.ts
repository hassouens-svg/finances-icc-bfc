import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/server/context";
import { buildReport, REPORTS } from "@/server/reports";
import { toXlsx, toPdf } from "@/server/export";
import { audit } from "@/server/data";
import { REGION } from "@/lib/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const kind = sp.report ?? "";
  if (!REPORTS[kind]) return NextResponse.json({ error: "Rapport inconnu" }, { status: 400 });
  if (kind === "regional" && !ctx.isRegional) return NextResponse.json({ error: "Réservé à l'église mère" }, { status: 403 });
  const report = await buildReport(ctx, kind, sp);
  const label = ctx.view === "all" ? "Toutes les églises" : ctx.activeChurch?.name ?? "";
  const slug = `${kind}-${(ctx.activeChurch?.slug ?? "region")}-${new Date().toISOString().slice(0, 10)}`;
  await audit(ctx, ctx.activeChurch?.$id ?? REGION, "export", "report", null, `Export ${sp.format === "pdf" ? "PDF" : "Excel"} : ${report.title}`);
  if (sp.format === "pdf") {
    const buf = await toPdf(report, label);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slug}.pdf"` } });
  }
  const buf = await toXlsx(report, label);
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${slug}.xlsx"` } });
}
