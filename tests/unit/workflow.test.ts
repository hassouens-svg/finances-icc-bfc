import { describe, it, expect } from "vitest";
import { selectWorkflow, submit, decide, canBePaid, currentRole, type WorkflowRule } from "@/lib/workflow";

const base = { stepDelaysHours: [], priority: 0, active: true, categoryIds: [] as string[] };
const rules: WorkflowRule[] = [
  { ...base, $id: "w1", churchId: "region", name: "< 100 €", minCents: 0, maxCents: 10000, stepRoles: ["treasurer"] },
  { ...base, $id: "w2", churchId: "region", name: "100–500 €", minCents: 10000, maxCents: 50000, stepRoles: ["treasurer", "pastor"] },
  { ...base, $id: "w3", churchId: "region", name: "> 500 €", minCents: 50000, maxCents: null, stepRoles: ["treasurer", "pastor", "mother_admin"] },
  { ...base, $id: "w4", churchId: "bes", name: "Besançon loyer", minCents: 0, maxCents: null, categoryIds: ["loyer"], stepRoles: ["pastor"] },
];

describe("sélection du workflow", () => {
  it("par seuil de montant", () => {
    expect(selectWorkflow(rules, { churchId: "dij", amountCents: 5000 })?.$id).toBe("w1");
    expect(selectWorkflow(rules, { churchId: "dij", amountCents: 10000 })?.$id).toBe("w2");
    expect(selectWorkflow(rules, { churchId: "dij", amountCents: 120000 })?.$id).toBe("w3");
  });
  it("la règle d'église + catégorie l'emporte", () => {
    expect(selectWorkflow(rules, { churchId: "bes", amountCents: 120000, categoryId: "loyer" })?.$id).toBe("w4");
  });
});

describe("circuit de validation", () => {
  it("une dépense > 500 € exige l'église mère avant d'être payable", () => {
    let s = submit(["treasurer", "pastor", "mother_admin"]);
    expect(canBePaid(s)).toBe(false);
    s = decide(s, "approved");
    expect(currentRole(s)).toBe("pastor");
    s = decide(s, "approved");
    expect(currentRole(s)).toBe("mother_admin");
    expect(canBePaid(s)).toBe(false);
    s = decide(s, "approved");
    expect(s.status).toBe("approved");
    expect(canBePaid(s)).toBe(true);
  });
  it("un refus arrête le circuit", () => {
    const s = decide(submit(["treasurer", "pastor"]), "rejected");
    expect(s.status).toBe("rejected");
    expect(canBePaid(s)).toBe(false);
  });
  it("une demande de précision ne fait pas avancer", () => {
    const s = decide(submit(["treasurer", "pastor"]), "info_requested");
    expect(s.currentStep).toBe(1);
  });
});
