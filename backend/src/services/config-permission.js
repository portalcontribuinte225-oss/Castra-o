import { pool } from "../db/index.js";
import { readConfigValue } from "../repositories/config-values.js";
import { isGlobalUser, isInternalUser, isMunicipalAdmin } from "../tenant.js";

const TEAMS_CONFIG_KEY = "castragestao:teams";
const PERMISSION_GROUPS_CONFIG_KEY = "permission_groups";

const sameEmail = (left, right) => Boolean(left) && Boolean(right) && String(left).trim().toLowerCase() === String(right).trim().toLowerCase();

// Whether a staff user may work on a configuration item. The global administration always may. Everyone else is judged by the
// permission group the municipality gave them (found by id or e-mail among its team users, as the screen does); a user with no
// active group falls back to their role, so only the manager of the municipality passes. The municipality is always the user's own.
export async function userHasConfigItem(user, item, { database = pool } = {}) {
  if (!user || !isInternalUser(user)) return false;
  if (isGlobalUser(user)) return true;
  const municipalityId = user.municipalityId || user.municipality_id;
  if (!municipalityId) return false;
  const [teams, groups] = await Promise.all([
    readConfigValue(TEAMS_CONFIG_KEY, municipalityId, database),
    readConfigValue(PERMISSION_GROUPS_CONFIG_KEY, municipalityId, database),
  ]);
  const teamUser = (Array.isArray(teams?.users) ? teams.users : []).find((entry) => entry && typeof entry === "object"
    && (String(entry.id ?? "") === String(user.id ?? "") || sameEmail(entry.email, user.email)));
  const group = teamUser && (Array.isArray(groups) ? groups : []).find((entry) => entry && entry.id === teamUser.permissionGroupId && entry.active !== false);
  if (group) return Array.isArray(group.allowedConfigItems) && group.allowedConfigItems.includes(item);
  return isMunicipalAdmin(user);
}
