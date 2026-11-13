import { isGlobalUser, normalizeRole } from "../tenant.js";

// These are the existing adoption operator roles, including accredited NGO/protector users.
export const ADOPTION_OPERATOR_ROLES = ["admin_municipal", "analista", "servidor_publico", "ong", "protetor"];

export function canManageAdoptions(user) {
  return Boolean(user && (isGlobalUser(user) || ADOPTION_OPERATOR_ROLES.includes(normalizeRole(user.role))));
}

export function publicAdoption(adoption) {
  const fields = ["id", "animal_name", "species", "sex", "age", "description", "health", "photo_url", "photos",
    "main_photo_index", "status", "municipality_id", "adopted_at", "created_at"];
  return { ...Object.fromEntries(fields.filter((key) => Object.hasOwn(adoption, key)).map((key) => [key, adoption[key]])),
    interestCount: Array.isArray(adoption.interests) ? adoption.interests.length : 0 };
}
