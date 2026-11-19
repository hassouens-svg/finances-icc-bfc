import { Permission, Role } from "node-appwrite";
import { MOTHER_TEAM_ID } from "./schema";

/** Permissions de ligne d'une donnée d'église : lecture équipe + église mère, écriture trésorier + admin mère. */
export function churchPermissions(church: { teamId: string }) {
  return [
    Permission.read(Role.team(church.teamId)),
    Permission.read(Role.team(MOTHER_TEAM_ID)),
    Permission.read(Role.label("superadmin")),
    Permission.update(Role.team(church.teamId, "treasurer")),
    Permission.update(Role.team(MOTHER_TEAM_ID, "admin")),
    Permission.update(Role.label("superadmin")),
  ];
}
/** Données régionales (listes par défaut, règles) : lisibles par tous les utilisateurs connectés. */
export function regionPermissions() {
  return [Permission.read(Role.users()), Permission.update(Role.team(MOTHER_TEAM_ID, "admin")), Permission.update(Role.label("superadmin"))];
}
