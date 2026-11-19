import Link from "next/link";
import { Building2, MapPin, Crown, ChevronRight } from "lucide-react";
import { requireContext, assertRegional } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Section } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchDialog, CityDialog } from "@/components/admin/forms";

export const metadata = { title: "Villes & églises" };

export default async function ChurchesPage() {
  const ctx = await requireContext();
  assertRegional(ctx);
  const cities = ctx.cities.map((c) => ({ value: c.$id, label: c.name }));
  return (
    <>
      <PageHeader
        back={{ href: "/app/admin", label: "Administration" }}
        title="Villes & églises"
        description="L'église mère pilote les églises filles. Chaque église ne voit que ses propres données."
        actions={<><CityDialog />{cities.length > 0 && <ChurchDialog cities={cities} isSuperAdmin={ctx.isSuperAdmin} />}</>}
      />
      {ctx.cities.length === 0 ? (
        <EmptyState icon={<MapPin />} title="Commencez par créer une ville" description="Ex. Dijon, puis Besançon, Chalon-sur-Saône, Auxerre…" action={<CityDialog />} />
      ) : (
        <div className="space-y-6">
          {ctx.cities.map((city) => {
            const churches = ctx.allChurches.filter((c) => c.cityId === city.$id);
            return (
              <Section key={city.$id} title={city.name} description={city.region ?? undefined} action={<CityDialog city={{ id: city.$id, name: city.name, region: city.region }} />}>
                {churches.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-[14px] text-muted">Aucune église dans cette ville.</p>
                ) : (
                  <Card className="divide-y divide-border">
                    {churches.map((c) => (
                      <Link key={c.$id} href={`/app/admin/eglises/${c.$id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface">
                        <span className={`grid size-10 place-items-center rounded-xl ${c.isMother ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
                          {c.isMother ? <Crown className="size-5" /> : <Building2 className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[15px] font-medium">{c.name}{c.isMother && <Badge tone="progress" dot={false}>Église mère</Badge>}{!c.active && <Badge tone="neutral" dot={false}>Archivée</Badge>}</span>
                          <span className="block text-[13px] text-muted">Préfixe {c.refPrefix}{c.pastorName ? ` · ${c.pastorName}` : ""}</span>
                        </span>
                        <ChevronRight className="size-4 text-muted" />
                      </Link>
                    ))}
                  </Card>
                )}
              </Section>
            );
          })}
          {ctx.allChurches.some((c) => !c.cityId) && (
            <Card><CardHeader title="Églises sans ville" /></Card>
          )}
        </div>
      )}
    </>
  );
}
