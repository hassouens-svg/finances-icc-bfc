import { Permission, Role } from "node-appwrite";
import { MOTHER_TEAM_ID } from "./schema";
import { roleEdit, roleView, type ModuleKey } from "./access";

/**
 * Permissions de ligne d'une donnée d'église, selon le module :
 *  - lecture : responsable, trésorier, pasteur, lecteur, droits personnalisés du module, église mère, super admin ;
 *  - écriture : responsable, trésorier, droit « gérer » du module, admin église mère, super admin.
 * "base" : lisible par tout membre de l'église (départements, comptes, liens…). "audit" : journal.
 */
export function churchPermissions(church: { teamId: string }, module: ModuleKey | "base" | "audit" = "base") {
  const t = church.teamId;
  const read =
    module === "base" ? [Role.team(t)]
    : module === "audit" ? [Role.team(t, "admin"), Role.team(t, "treasurer"), Role.team(t, "pastor")]
    : [Role.team(t, "admin"), Role.team(t, "treasurer"), Role.team(t, "pastor"), Role.team(t, "reader"), Role.team(t, roleView(module)), Role.team(t, roleEdit(module))];
  const write = [Role.team(t, "admin"), Role.team(t, "treasurer"), ...(module === "base" ? [Role.team(t, roleEdit("parametres"))] : module === "audit" ? [] : [Role.team(t, roleEdit(module))])];
  return [
    ...read.map((r) => Permission.read(r)),
    Permission.read(Role.team(MOTHER_TEAM_ID)),
    Permission.read(Role.label("superadmin")),
    ...write.map((r) => Permission.update(r)),
    Permission.update(Role.team(MOTHER_TEAM_ID, "admin")),
    Permission.update(Role.label("superadmin")),
  ];
}
/** Données régionales (listes par défaut, règles) : lisibles par tous les utilisateurs connectés. */
export function regionPermissions() {
  return [Permission.read(Role.users()), Permission.update(Role.team(MOTHER_TEAM_ID, "admin")), Permission.update(Role.label("superadmin"))];
}
