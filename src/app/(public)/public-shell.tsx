import { Logo } from "@/components/logo";
import { ChurchLogo } from "@/components/church-logo";

export function PublicShell({ children, church, logo }: { children: React.ReactNode; church?: string; logo?: string | null }) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
          <Logo subtitle={false} image={<ChurchLogo src={logo ?? "/api/logo/mother"} alt="Logo" />} />
          {church && <span className="truncate pl-3 text-[13px] font-medium text-muted">{church}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6 pb-16 animate-fade-up">{children}</main>
    </div>
  );
}
