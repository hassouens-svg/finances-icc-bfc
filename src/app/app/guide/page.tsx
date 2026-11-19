import Link from "next/link";
import { ArrowRight, Lightbulb, UserCog, Rocket, Smartphone } from "lucide-react";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { MODULES, ROLES_GUIDE, FIRST_STEPS } from "@/lib/guide";

export const metadata = { title: "Guide d'utilisation" };

function Steps({ steps }: { steps: { title: string; text: string; href?: string; cta?: string }[] }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-accent-soft pl-6">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className="num absolute -left-[37px] grid size-7 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white ring-4 ring-bg">{i + 1}</span>
          <p className="text-[15px] font-medium">{s.title}</p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-muted">{s.text}</p>
          {s.href && s.cta && <Link href={s.href} className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">{s.cta} <ArrowRight className="size-3.5" /></Link>}
        </li>
      ))}
    </ol>
  );
}

export default async function GuidePage() {
  const ctx = await requireContext();
  return (
    <>
      <PageHeader title="Guide d'utilisation" description="Le parcours pas à pas, module par module. Chaque écran rappelle aussi ses étapes dans « Comment ça marche ? »." />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Sommaire du guide">
        <a href="#demarrer" className="rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium hover:border-accent/40">Premiers pas</a>
        <a href="#roles" className="rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium hover:border-accent/40">Qui fait quoi</a>
        {MODULES.map((m) => <a key={m.id} href={`#${m.id}`} className="rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium hover:border-accent/40"><span className="num mr-1 text-accent">{m.num}</span>{m.title.split(" — ")[0]}</a>)}
        <a href="#public" className="rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium hover:border-accent/40">Liens publics</a>
      </nav>
      <div className="space-y-5">
        {ctx.isRegional && (
          <Card id="demarrer" className="scroll-mt-24">
            <CardHeader title={<span className="flex items-center gap-2"><Rocket className="size-4 text-accent" /> Premiers pas (mise en place)</span>} description="À faire une fois, dans cet ordre." />
            <CardBody><Steps steps={FIRST_STEPS} /></CardBody>
          </Card>
        )}
        <Card id="roles" className="scroll-mt-24">
          <CardHeader title={<span className="flex items-center gap-2"><UserCog className="size-4 text-accent" /> Qui fait quoi</span>} description="Une même personne peut avoir des rôles différents dans plusieurs églises." />
          <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ROLES_GUIDE.map((r) => (
              <div key={r.role} className="rounded-xl border border-border p-4">
                <p className="text-[14px] font-semibold">{r.role}</p>
                <ul className="mt-2 space-y-1 text-[13px] text-muted">{r.does.map((d) => <li key={d}>• {d}</li>)}</ul>
              </div>
            ))}
          </CardBody>
        </Card>
        {MODULES.map((m) => (
          <Card key={m.id} id={m.id} className="scroll-mt-24">
            <CardHeader
              title={<span className="flex items-center gap-2.5"><span className="num grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-semibold text-white">{m.num}</span>{m.title}</span>}
              description={<>{m.summary}<br /><span className="text-[12px]">Pour : {m.who}</span></>}
              action={<Link href={m.href} className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-accent hover:underline sm:inline-flex">Ouvrir <ArrowRight className="size-3.5" /></Link>}
            />
            <CardBody>
              <Steps steps={m.steps} />
              {m.tips && (
                <ul className="mt-5 space-y-1.5 rounded-xl bg-accent-soft/60 p-3.5">
                  {m.tips.map((t) => <li key={t} className="flex gap-2 text-[13px] text-accent-strong"><Lightbulb className="mt-0.5 size-3.5 shrink-0" />{t}</li>)}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
        <Card id="public" className="scroll-mt-24">
          <CardHeader title={<span className="flex items-center gap-2"><Smartphone className="size-4 text-accent" /> Parcours des personnes sans compte</span>} />
          <CardBody>
            <Steps steps={[
              { title: "Elle ouvre le lien ou scanne le QR code", text: "Partagé par le trésorier dans le groupe WhatsApp ou affiché à l'église." },
              { title: "Elle remplit le formulaire sur son téléphone", text: "Besoin d'un département ou demande de remboursement (avec photo du ticket)." },
              { title: "Elle garde son lien de suivi", text: "Il s'affiche après l'envoi (et par email si elle en a donné un). Il montre le statut et les étapes, sans compte." },
            ]} />
          </CardBody>
        </Card>
        <p className="text-center text-[13px] text-muted">Installer l&apos;application sur téléphone : ouvrez-la dans le navigateur, puis « Ajouter à l&apos;écran d&apos;accueil ».</p>
      </div>
    </>
  );
}
