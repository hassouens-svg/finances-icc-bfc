import { describe, it, expect } from "vitest";
import { computeAccess, rolesFor, ALLOWED_ROLE, moduleOfPath } from "@/lib/access";
import { churchPermissions } from "@/lib/perms";

describe("droits par module", () => {
  it("rôles prêts à l'emploi", () => {
    expect(computeAccess(["admin"])).toMatchObject({ admin: true, modules: { offrandes: "edit", parametres: "edit" }, approve: { treasurer: true, pastor: true } });
    expect(computeAccess(["treasurer"]).modules.depenses).toBe("edit");
    expect(computeAccess(["pastor"])).toMatchObject({ modules: { depenses: "view" }, approve: { pastor: true, treasurer: false } });
    expect(computeAccess(["reader"]).modules.tresorerie).toBe("view");
  });
  it("droits personnalisés", () => {
    const roles = rolesFor("custom", { offrandes: "edit", depots: "view" }, { pastor: true });
    expect(roles).toEqual(["m_offrandes_edit", "m_depots_view", "ap_pastor"]);
    const a = computeAccess(roles);
    expect(a.preset).toBe("custom");
    expect(a.modules).toMatchObject({ offrandes: "edit", depots: "view", depenses: "none", tresorerie: "none" });
    expect(a.approve).toEqual({ treasurer: false, pastor: true });
    expect(roles.every((r) => ALLOWED_ROLE.test(r))).toBe(true);
    expect(ALLOWED_ROLE.test("superadmin")).toBe(false);
  });
  it("permissions Appwrite d'une offrande : pas de lecture pour un membre sans droit « offrandes »", () => {
    const p = churchPermissions({ teamId: "church-x" }, "offrandes");
    expect(p).toContain('read("team:church-x/m_offrandes_view")');
    expect(p).toContain('update("team:church-x/m_offrandes_edit")');
    expect(p).not.toContain('read("team:church-x")');
    expect(p).not.toContain('read("team:church-x/m_depenses_view")');
  });
  it("module d'un écran", () => {
    expect(moduleOfPath("/app/offrandes/123/saisie")).toBe("offrandes");
    expect(moduleOfPath("/app/charges")).toBe("depenses");
    expect(moduleOfPath("/app/admin")).toBeNull();
  });
});
