"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { formatEuro } from "@/lib/format";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const mLabel = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;
const tip = { contentStyle: { borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13 }, formatter: (v: unknown) => formatEuro(Number(v)) };
const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false };

export function FlowChart({ data }: { data: { month: string; in: number; out: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} margin={{ left: -8, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={mLabel} {...axis} />
          <YAxis tickFormatter={(v) => `${Math.round(v / 100000)}k`} {...axis} width={40} />
          <Tooltip {...tip} labelFormatter={(l) => mLabel(String(l))} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="in" name="Argent entré" fill="#6D28D9" radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Bar dataKey="out" name="Argent sorti" fill="#C4B5FD" radius={[6, 6, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -8, right: 4, top: 8 }}>
          <defs><linearGradient id="bal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6D28D9" stopOpacity={0.25} /><stop offset="1" stopColor="#6D28D9" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={mLabel} {...axis} />
          <YAxis tickFormatter={(v) => `${Math.round(v / 100000)}k`} {...axis} width={40} />
          <Tooltip {...tip} labelFormatter={(l) => mLabel(String(l))} />
          <Area dataKey="total" name="Trésorerie" stroke="#6D28D9" strokeWidth={2} fill="url(#bal)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const PALETTE = ["#6D28D9", "#8B5CF6", "#A78BFA", "#C4B5FD", "#4C1D95", "#DDD6FE", "#7C3AED", "#EDE9FE", "#5B21B6", "#9CA3AF"];

export function Donut({ data, empty = "Aucune donnée" }: { data: { label: string; cents: number }[]; empty?: string }) {
  const total = data.reduce((a, d) => a + d.cents, 0);
  if (!total) return <p className="py-10 text-center text-[13px] text-muted">{empty}</p>;
  const top = data.slice(0, 7);
  const rest = data.slice(7).reduce((a, d) => a + d.cents, 0);
  const rows = rest ? [...top, { label: "Autres", cents: rest }] : top;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="cents" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none">
              {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-[11px] text-muted">Total</p><p className="num text-[14px] font-semibold">{formatEuro(total, { short: true })}</p></div></div>
      </div>
      <ul className="w-full space-y-1.5 text-[13px]">
        {rows.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="num text-muted">{Math.round((d.cents / total) * 100)} %</span>
            <span className="num w-24 text-right font-medium">{formatEuro(d.cents, { short: true })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
