import "server-only";
import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { adminList } from "./data";
import type { BankAccount, Church, Department, PublicLink } from "@/lib/types";

export type ChurchSetup = {
  church: Church;
  treasurers: number;
  members: number;
  bankAccounts: number;
  departments: number;
  fundingLink: boolean;
  reimbursementLink: boolean;
  done: number;
  total: number;
};

/** État de mise en place de chaque église (pour les listes « Prochaines étapes »). */
export async function churchSetup(churches: Church[]): Promise<ChurchSetup[]> {
  if (!churches.length) return [];
  const ids = churches.map((c) => c.$id);
  const { teams } = adminClient();
  const [accounts, deps, links, memberships] = await Promise.all([
    adminList<BankAccount>("bank_accounts", [Query.equal("churchId", ids), Query.equal("archived", false), Query.select(["$id", "churchId"])]),
    adminList<Department>("departments", [Query.equal("churchId", ids), Query.equal("archived", false), Query.select(["$id", "churchId"])]),
    adminList<PublicLink>("public_links", [Query.equal("churchId", ids), Query.equal("active", true), Query.select(["$id", "churchId", "kind"])]),
    Promise.all(churches.map((c) => teams.listMemberships({ teamId: c.teamId, queries: [Query.limit(100)] }).then((r) => r.memberships).catch(() => []))),
  ]);
  return churches.map((church, i) => {
    const m = memberships[i]!;
    const s = {
      church,
      treasurers: m.filter((x) => x.roles.includes("treasurer") || x.roles.includes("admin")).length,
      members: m.length,
      bankAccounts: accounts.filter((a) => a.churchId === church.$id).length,
      departments: deps.filter((d) => d.churchId === church.$id).length,
      fundingLink: links.some((l) => l.churchId === church.$id && l.kind === "funding"),
      reimbursementLink: links.some((l) => l.churchId === church.$id && l.kind === "reimbursement"),
    };
    const checks = [s.treasurers > 0, s.bankAccounts > 0, s.departments > 0, s.fundingLink && s.reimbursementLink];
    return { ...s, done: checks.filter(Boolean).length, total: checks.length };
  });
}
