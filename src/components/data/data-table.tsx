"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, ChevronRight as Chevron } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEuro, formatDate } from "@/lib/format";
import { StatusBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ColType = "text" | "money" | "date" | "status" | "priority" | "badge" | "strong" | "muted" | "number";
export type Col = { key: string; label: string; type?: ColType; entity?: string; align?: "left" | "right"; hideOnMobile?: boolean; mobilePrimary?: boolean; mobileSecondary?: boolean; sortable?: boolean };
export type DataRow = Record<string, string | number | boolean | null | undefined> & { id: string; href?: string };

function Cell({ col, row }: { col: Col; row: DataRow }) {
  const v = row[col.key];
  switch (col.type) {
    case "money":
      return <span className={cn("num whitespace-nowrap font-medium", typeof v === "number" && v < 0 && "text-danger")}>{v == null ? "—" : formatEuro(Number(v))}</span>;
    case "number":
      return <span className="num">{v ?? "—"}</span>;
    case "date":
      return <span className="whitespace-nowrap text-muted">{formatDate(v as string)}</span>;
    case "status":
      return v ? <StatusBadge entity={col.entity!} status={String(v)} suffix={(row[`${col.key}Suffix`] as string) ?? undefined} /> : null;
    case "priority":
      return v ? <PriorityBadge priority={String(v)} /> : null;
    case "badge":
      return v ? <Badge tone="progress" dot={false}>{String(v)}</Badge> : null;
    case "strong":
      return <span className="font-medium">{v ?? "—"}</span>;
    case "muted":
      return <span className="text-muted">{v ?? "—"}</span>;
    default:
      return <span>{v === null || v === undefined || v === "" ? "—" : String(v)}</span>;
  }
}

export function DataTable({
  columns, rows, searchPlaceholder = "Rechercher…", filters, empty, pageSize = 25, totals, toolbar,
}: {
  columns: Col[];
  rows: DataRow[];
  searchPlaceholder?: string;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  empty?: React.ReactNode;
  pageSize?: number;
  totals?: Record<string, number>;
  toolbar?: React.ReactNode;
}) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [facet, setFacet] = React.useState<Record<string, string>>({});
  const data = React.useMemo(() => rows.filter((r) => Object.entries(facet).every(([k, v]) => !v || String(r[k]) === v)), [rows, facet]);
  const defs = React.useMemo<ColumnDef<DataRow>[]>(
    () => columns.map((c) => ({ id: c.key, accessorFn: (r) => r[c.key] ?? "", header: c.label, enableSorting: c.sortable !== false, cell: ({ row }) => <Cell col={c} row={row.original} /> })),
    [columns],
  );
  const table = useReactTable({
    data, columns: defs, state: { sorting, globalFilter }, onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } }, globalFilterFn: "includesString",
  });
  const primary = columns.find((c) => c.mobilePrimary) ?? columns[0]!;
  const secondary = columns.filter((c) => c.mobileSecondary);
  const moneyCol = columns.find((c) => c.type === "money");
  const statusCol = columns.find((c) => c.type === "status");
  const pageRows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="h-10 pl-9 text-[14px]" aria-label="Rechercher" />
        </div>
        {filters?.map((f) => (
          <select
            key={f.key}
            value={facet[f.key] ?? ""}
            onChange={(e) => setFacet({ ...facet, [f.key]: e.target.value })}
            className="h-10 rounded-xl border border-border bg-bg px-3 text-[14px] shadow-card"
            aria-label={f.label}
          >
            <option value="">{f.label} : tous</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {toolbar && <div className="flex gap-2 sm:ml-auto">{toolbar}</div>}
      </div>

      {data.length === 0 && empty ? (
        empty
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-bg shadow-card">
          {/* Ordinateur : tableau */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[14px]">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border bg-surface">
                    {hg.headers.map((h) => {
                      const col = columns.find((c) => c.key === h.id)!;
                      const sorted = h.column.getIsSorted();
                      return (
                        <th key={h.id} className={cn("h-10 whitespace-nowrap px-4 text-left text-[12px] font-medium text-muted", (col.align === "right" || col.type === "money") && "text-right")}>
                          {h.column.getCanSort() ? (
                            <button className="inline-flex items-center gap-1 hover:text-fg" onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
                            </button>
                          ) : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => r.original.href && router.push(r.original.href)}
                    className={cn("border-b border-border last:border-0", r.original.href && "cursor-pointer hover:bg-surface")}
                  >
                    {r.getVisibleCells().map((cell) => {
                      const col = columns.find((c) => c.key === cell.column.id)!;
                      return (
                        <td key={cell.id} className={cn("h-12 px-4", (col.align === "right" || col.type === "money") && "text-right")}>
                          {col === primary && r.original.href ? (
                            <Link href={r.original.href} className="font-medium hover:text-accent" onClick={(e) => e.stopPropagation()}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Link>
                          ) : flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="border-t border-border bg-surface font-semibold">
                    {columns.map((c, i) => (
                      <td key={c.key} className={cn("h-11 px-4", c.type === "money" && "text-right")}>
                        {i === 0 ? "Total" : totals[c.key] != null ? <span className="num">{formatEuro(totals[c.key])}</span> : null}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {/* Téléphone : liste de cartes */}
          <ul className="divide-y divide-border md:hidden">
            {pageRows.map((r) => {
              const row = r.original;
              const inner = (
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{String(row[primary.key] ?? "—")}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {secondary.map((c) => (c.type === "date" ? formatDate(row[c.key] as string) : row[c.key])).filter(Boolean).join(" · ")}
                    </p>
                    {statusCol && row[statusCol.key] && <div className="mt-1.5"><Cell col={statusCol} row={row} /></div>}
                  </div>
                  {moneyCol && <div className="text-right text-[15px]"><Cell col={moneyCol} row={row} /></div>}
                  {row.href && <Chevron className="size-4 shrink-0 text-muted" />}
                </div>
              );
              return <li key={r.id}>{row.href ? <Link href={row.href} className="block active:bg-surface">{inner}</Link> : inner}</li>;
            })}
            {totals && moneyCol && totals[moneyCol.key] != null && (
              <li className="flex justify-between bg-surface px-4 py-3 text-[14px] font-semibold"><span>Total</span><span className="num">{formatEuro(totals[moneyCol.key])}</span></li>
            )}
          </ul>
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[13px] text-muted">
              <span>{table.getFilteredRowModel().rows.length} éléments</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Page précédente"><ChevronLeft /></Button>
                <span className="num">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Page suivante"><ChevronRight /></Button>
              </div>
            </div>
          )}
          {pageRows.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-muted">Aucun résultat pour cette recherche.</p>}
        </div>
      )}
    </div>
  );
}
