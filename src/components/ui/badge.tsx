import { cn } from "@/lib/utils";
import { statusDef, PRIORITY_LABELS, type Tone } from "@/lib/status";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-border",
  progress: "bg-accent-soft text-accent-strong ring-accent/15",
  waiting: "bg-warning-soft text-warning ring-warning/20",
  positive: "bg-success-soft text-success ring-success/20",
  done: "bg-success text-white ring-success",
  negative: "bg-danger-soft text-danger ring-danger/20",
};
const DOTS: Record<Tone, string> = {
  neutral: "bg-muted", progress: "bg-accent", waiting: "bg-warning", positive: "bg-success", done: "bg-white", negative: "bg-danger",
};

export function Badge({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ entity, status, suffix, className }: { entity: string; status: string; suffix?: string; className?: string }) {
  const d = statusDef(entity, status);
  return (
    <Badge tone={d.tone} className={className}>
      {d.label}
      {suffix ? ` ${suffix}` : ""}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.normal!;
  return <Badge tone={p.tone} dot={false}>{p.label}</Badge>;
}
