import { Logo } from "@/components/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12 animate-fade-up">{children}</div>
        <p className="text-[12px] text-muted">© {new Date().getFullYear()} Impact Centre Chrétien · Usage interne</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#0B0716] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(124,58,237,0.55),transparent_70%),radial-gradient(50%_45%_at_20%_90%,rgba(76,29,149,0.6),transparent_70%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <div className="mb-10 grid max-w-md grid-cols-2 gap-3">
            {[
              ["Argent entré", "12 480,00 €", "+8 %"],
              ["En caisse", "1 320,00 €", "à déposer"],
              ["À la banque", "34 905,50 €", "3 comptes"],
              ["À valider", "4 dépenses", "dont 1 urgente"],
            ].map(([l, v, h]) => (
              <div key={l} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <p className="text-[12px] text-white/60">{l}</p>
                <p className="num mt-1 text-[19px] font-semibold tracking-tight">{v}</p>
                <p className="mt-0.5 text-[12px] text-violet-300">{h}</p>
              </div>
            ))}
          </div>
          <p className="max-w-md text-[26px] font-semibold leading-tight tracking-tight">Des finances claires, pour servir avec fidélité.</p>
          <p className="mt-3 max-w-md text-[14px] text-white/60">Offrandes, dépenses, dépôts et demandes de toutes les églises de la région, au même endroit.</p>
        </div>
      </aside>
    </main>
  );
}
