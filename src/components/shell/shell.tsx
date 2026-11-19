"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronsUpDown, Check, Building2, Globe2, LogOut, Moon, Sun, Plus, MoreHorizontal, KeyRound, HandCoins, Receipt, Landmark, X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { Logo } from "@/components/logo";
import { ChurchLogo } from "@/components/church-logo";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { NAV, MOBILE_TABS, isActive, type NavItem } from "./nav";
import { setViewAction, logoutAction } from "@/server/actions/auth";

export type ShellProps = {
  user: { name: string; email: string; roleLabel: string };
  churches: { id: string; name: string; isMother: boolean; city?: string; logo?: string | null }[];
  brandLogo?: string | null;
  view: string;
  isRegional: boolean;
  canAdmin: boolean;
  canWrite: boolean;
  unread: number;
  badges: Partial<Record<"approvals" | "reimbursements" | "funding", number>>;
  children: React.ReactNode;
};

function NavLink({ item, pathname, badge, onClick }: { item: NavItem; pathname: string; badge?: number; onClick?: () => void }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[14px] transition-colors",
        active ? "bg-accent-soft font-medium text-accent-strong" : "text-fg/80 hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted group-hover:text-fg")} strokeWidth={1.8} />
      <span className="truncate">{item.label}</span>
      {!!badge && <span className="num ml-auto min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{badge}</span>}
    </Link>
  );
}

function NavList({ pathname, canAdmin, badges, onNavigate }: { pathname: string; canAdmin: boolean; badges: ShellProps["badges"]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-5" aria-label="Navigation principale">
      {NAV.filter((g) => !g.adminOnly || canAdmin).map((g, i) => (
        <div key={i} className="space-y-0.5">
          {g.label && (
            <p className="flex items-center gap-2 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              {g.num && <span className="num grid size-[18px] place-items-center rounded-md bg-accent-soft text-[10px] font-semibold tracking-normal text-accent-strong">{g.num}</span>}
              <span className="truncate">{g.label}</span>
            </p>
          )}
          {g.items.filter((it) => it.href !== "/app/admin" || canAdmin).map((it) => (
            <NavLink key={it.href} item={it} pathname={pathname} badge={it.badgeKey ? badges[it.badgeKey] : undefined} onClick={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function ChurchSwitcher({ churches, view, isRegional, compact }: Pick<ShellProps, "churches" | "view" | "isRegional"> & { compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const current = view === "all" ? null : churches.find((c) => c.id === view);
  const choose = (v: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("view", v);
      await setViewAction(fd);
      router.refresh();
    });
  if (!isRegional && churches.length <= 1) {
    return (
      <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl px-2 text-[14px] font-medium">
        <Building2 className="size-4 text-muted" />
        <span className="truncate">{current?.name ?? "—"}</span>
      </div>
    );
  }
  return (
    <Dropdown>
      <DropdownTrigger
        className={cn(
          "flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg pl-2.5 pr-2 text-left text-[14px] font-medium shadow-card hover:bg-surface",
          pending && "opacity-60",
          compact ? "max-w-[58vw]" : "w-full max-w-[300px]",
        )}
        aria-label="Changer d'église ou de vue"
      >
        {current?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.logo} alt="" className="size-6 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-lg", view === "all" ? "bg-accent text-white" : "bg-accent-soft text-accent")}>
            {view === "all" ? <Globe2 className="size-3.5" /> : <Building2 className="size-3.5" />}
          </span>
        )}
        <span className="truncate">{view === "all" ? "Toutes les églises" : current?.name}</span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted" />
      </DropdownTrigger>
      <DropdownContent align="start" className="w-72">
        {isRegional && (
          <>
            <DropdownLabel>Vue régionale</DropdownLabel>
            <DropdownItem onSelect={() => choose("all")}>
              <Globe2 /> Toutes les églises {view === "all" && <Check className="ml-auto !text-accent" />}
            </DropdownItem>
            <DropdownSeparator />
          </>
        )}
        <DropdownLabel>Églises</DropdownLabel>
        {churches.map((c) => (
          <DropdownItem key={c.id} onSelect={() => choose(c.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.logo ? <img src={c.logo} alt="" className="size-5 rounded-md object-cover" /> : <Building2 />}
            <span className="truncate">{c.name}</span>
            {c.isMother && <span className="rounded-md bg-accent-soft px-1.5 text-[11px] font-medium text-accent-strong">Mère</span>}
            {view === c.id && <Check className="ml-auto !text-accent" />}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

function ThemeToggle() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  return (
    <DropdownItem
      onSelect={(e) => {
        e.preventDefault();
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("icc-theme", next); } catch {}
        setDark(!dark);
      }}
    >
      {dark ? <Sun /> : <Moon />} {dark ? "Mode clair" : "Mode sombre"}
    </DropdownItem>
  );
}

function UserMenu({ user, compact }: { user: ShellProps["user"]; compact?: boolean }) {
  return (
    <Dropdown>
      <DropdownTrigger className={cn("flex items-center gap-2.5 rounded-xl text-left hover:bg-surface-2", compact ? "p-1" : "w-full p-2")} aria-label="Menu utilisateur">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fg text-[12px] font-semibold text-bg">{initials(user.name)}</span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">{user.name}</span>
            <span className="block truncate text-[12px] text-muted">{user.roleLabel}</span>
          </span>
        )}
      </DropdownTrigger>
      <DropdownContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"}>
        <DropdownLabel>{user.email}</DropdownLabel>
        <DropdownItem asChild><Link href="/app/compte"><KeyRound /> Mon compte</Link></DropdownItem>
        <ThemeToggle />
        <DropdownSeparator />
        <DropdownItem onSelect={() => logoutAction()} className="text-danger [&_svg]:!text-danger"><LogOut /> Se déconnecter</DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function Bell_({ unread }: { unread: number }) {
  return (
    <Link href="/app/notifications" className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
      <Bell className="size-[19px]" strokeWidth={1.8} />
      {unread > 0 && <span className="num absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-bg">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}

function Fab() {
  const [open, setOpen] = React.useState(false);
  const items = [
    { href: "/app/offrandes/nouvelle", label: "Des offrandes", icon: HandCoins },
    { href: "/app/depenses/nouvelle", label: "Une dépense", icon: Receipt },
    { href: "/app/depots/nouveau", label: "Un dépôt", icon: Landmark },
  ];
  return (
    <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 lg:hidden">
      {open && <button aria-label="Fermer" className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />}
      <div className={cn("mb-3 flex flex-col items-end gap-2 transition-all", open ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0")}>
        {items.map((it) => (
          <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-full border border-border bg-bg py-2 pl-4 pr-2 text-[14px] font-medium shadow-pop">
            Ajouter {it.label.toLowerCase()}
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent"><it.icon className="size-4" /></span>
          </Link>
        ))}
      </div>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le menu d'ajout" : "Ajouter"}
        aria-expanded={open}
        className="ml-auto grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-[0_10px_24px_-6px_rgba(109,40,217,0.6)] transition-transform active:scale-95"
      >
        <Plus className={cn("size-6 transition-transform", open && "rotate-45")} />
      </button>
    </div>
  );
}

export function Shell(p: ShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  return (
    <div className="min-h-dvh bg-surface">
      {/* Sidebar (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-bg lg:flex">
        <div className="px-4 pb-3 pt-5">
          <Link href="/app"><Logo image={<ChurchLogo src={p.brandLogo} alt="Logo de l'église mère" />} /></Link>
        </div>
        <div className="px-3 pb-3">
          <ChurchSwitcher churches={p.churches} view={p.view} isRegional={p.isRegional} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          <NavList pathname={pathname} canAdmin={p.canAdmin} badges={p.badges} />
        </div>
        <div className="border-t border-border p-2">
          <UserMenu user={p.user} />
        </div>
      </aside>

      {/* En-tête */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md lg:ml-[264px]">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:h-16 lg:px-8">
          <Link href="/app" className="lg:hidden" aria-label="Accueil"><ChurchLogo src={p.brandLogo} alt="Accueil" className="size-8 rounded-[9px]" /></Link>
          <div className="min-w-0 lg:hidden">
            <ChurchSwitcher churches={p.churches} view={p.view} isRegional={p.isRegional} compact />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Bell_ unread={p.unread} />
            <div className="lg:hidden"><UserMenu user={p.user} compact /></div>
          </div>
        </div>
      </header>

      <main className="lg:ml-[264px]">
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">{p.children}</div>
      </main>

      {p.canWrite && !/\/(nouvelle|nouveau|modifier|saisie)$/.test(pathname) && <Fab />}

      {/* Barre du bas (téléphone) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-safe backdrop-blur-md lg:hidden" aria-label="Navigation mobile">
        <div className="grid h-16 grid-cols-5">
          {MOBILE_TABS.map((t) => {
            const active = isActive(pathname, t);
            const badge = t.badgeKey ? p.badges[t.badgeKey] : 0;
            return (
              <Link key={t.href} href={t.href} className={cn("relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-accent" : "text-muted")}>
                <t.icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.8} />
                {t.label}
                {!!badge && <span className="num absolute left-1/2 top-2 ml-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">{badge}</span>}
              </Link>
            );
          })}
          <D.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <D.Trigger className={cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium", moreOpen ? "text-accent" : "text-muted")}>
              <MoreHorizontal className="size-[22px]" strokeWidth={1.8} /> Plus
            </D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <D.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-bg px-4 pb-8 pt-3 shadow-pop pb-safe">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
                <div className="mb-4 flex items-center justify-between">
                  <D.Title className="text-[16px] font-semibold">Menu</D.Title>
                  <D.Description className="sr-only">Toutes les rubriques</D.Description>
                  <D.Close className="rounded-lg p-1.5 text-muted" aria-label="Fermer"><X className="size-4" /></D.Close>
                </div>
                <NavList pathname={pathname} canAdmin={p.canAdmin} badges={p.badges} onNavigate={() => setMoreOpen(false)} />
              </D.Content>
            </D.Portal>
          </D.Root>
        </div>
      </nav>
    </div>
  );
}
