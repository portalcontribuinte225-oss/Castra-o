import { pool } from "../db/index.js";
import { readConfigValue } from "../repositories/config-values.js";
import { isUuid } from "../repositories/request-tracking.js";
import { isGlobalUser, isInternalUser, isMunicipalAdmin } from "../tenant.js";
import { REQUESTS_MENU_ITEM } from "../../../shared/staff-notifications-contract.js";

const TEAMS_CONFIG_KEY = "castragestao:teams";
const PERMISSION_GROUPS_CONFIG_KEY = "permission_groups";

const sameEmail = (left, right) => Boolean(left) && Boolean(right) && String(left).trim().toLowerCase() === String(right).trim().toLowerCase();

export async function readMunicipalityPermissions(municipalityId, database = pool) {
  const [teams, groups] = await Promise.all([
    readConfigValue(TEAMS_CONFIG_KEY, municipalityId, database),
    readConfigValue(PERMISSION_GROUPS_CONFIG_KEY, municipalityId, database),
  ]);
  return { teams, groups };
}

function teamMatches(user, teams) {
  const users = Array.isArray(teams?.users) ? teams.users.filter((entry) => entry && typeof entry === "object") : [];
  return {
    byId: users.find((entry) => entry.id && String(entry.id) === String(user.id)),
    byEmail: users.filter((entry) => sameEmail(entry.email, user.email)),
  };
}

function activePermissionGroup(teamUser, groups) {
  return teamUser && (Array.isArray(groups) ? groups : []).find((entry) => entry && entry.id === teamUser.permissionGroupId && entry.active !== false);
}

export function requestsMenuAllowed(user, { teams, groups }) {
  if (!user || !isInternalUser(user)) return false;
  if (isGlobalUser(user)) return true;
  const { byId, byEmail } = teamMatches(user, teams);
  // A recycled email can match a stale entry for a different account. Only a single legacy match
  // without a real account ID can provide the permission group when the current account ID is absent.
  if (!byId && byEmail.length && (byEmail.length !== 1 || isUuid(byEmail[0].id))) return false;
  const group = activePermissionGroup(byId ?? byEmail[0], groups);
  return !group || (Array.isArray(group.allowedMenuItems) && group.allowedMenuItems.includes(REQUESTS_MENU_ITEM));
}

// Whether a staff user may work on a configuration item. The global administration always may. Everyone else is judged by the
// permission group the municipality gave them (found by id or e-mail among its team users, as the screen does); a user with no
// active group falls back to their role, so only the manager of the municipality passes. The municipality is always the user's own.
export async function userHasConfigItem(user, item, { database = pool } = {}) {
  if (!user || !isInternalUser(user)) return false;
  if (isGlobalUser(user)) return true;
  const municipalityId = user.municipalityId || user.municipality_id;
  if (!municipalityId) return false;
  const { teams, groups } = await readMunicipalityPermissions(municipalityId, database);
  const { byId, byEmail } = teamMatches(user, teams);
  const group = activePermissionGroup(byId ?? byEmail[0], groups);
  if (group) return Array.isArray(group.allowedConfigItems) && group.allowedConfigItems.includes(item);
  return isMunicipalAdmin(user);
}
