import "server-only";
import { resolvePeriod } from "@/lib/period";

export type PeriodParams = { p?: string; from?: string; to?: string };
export function periodFrom(sp: PeriodParams, fallback = "month") {
  return resolvePeriod(sp.p ?? fallback, sp.from, sp.to);
}
