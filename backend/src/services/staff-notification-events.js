import { isUuid } from "../repositories/request-tracking.js";
import { insertRequestAssignedNotification } from "../repositories/staff-notifications.js";
import { readMunicipalityPermissions, requestsMenuAllowed } from "./config-permission.js";

const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

function accountIdentity(value, teamUsers) {
  if (typeof value !== "string" || !value) return null;
  if (isUuid(value)) return { id: value.toLowerCase() };
  const matches = teamUsers.filter((entry) => entry?.id === value && entry.active !== false);
  const email = matches.length === 1 ? normalizeEmail(matches[0].email) : "";
  return email ? { email } : null;
}

function accountFor(identity, rows) {
  if (!identity) return null;
  const matches = rows.filter((row) => identity.id ? row.id === identity.id : normalizeEmail(row.email) === identity.email);
  return matches.length === 1 ? matches[0] : null;
}

// The caller holds the request row lock until commit. Compare the real accounts because a legacy
// workflow can contain the team entry's local ID instead of the authenticated account's UUID.
export async function recordRequestAssignmentNotification(database, { previous, request, actor }) {
  const before = previous.workflow_data?.assignedUserId;
  const after = request.workflow_data?.assignedUserId;
  if (typeof after !== "string" || !after || before === after || after === actor.id) return;

  const municipalityId = request.municipality_id;
  const permissions = await readMunicipalityPermissions(municipalityId, database);
  const teamUsers = Array.isArray(permissions.teams?.users) ? permissions.teams.users : [];
  const previousIdentity = accountIdentity(before, teamUsers);
  const nextIdentity = accountIdentity(after, teamUsers);
  if (!nextIdentity) return;
  const identities = [previousIdentity, nextIdentity].filter(Boolean);
  const { rows } = await database.query(
    `SELECT u.id, u.email, u.role, u.active, u.must_change_password
     FROM users u JOIN municipalities m ON m.id = u.municipality_id AND m.active = TRUE
     WHERE u.municipality_id = $1 AND (u.id = ANY($2::uuid[]) OR lower(u.email) = ANY($3::text[]))`,
    [municipalityId, identities.flatMap((item) => item.id ? [item.id] : []), identities.flatMap((item) => item.email ? [item.email] : [])],
  );
  const recipient = accountFor(nextIdentity, rows);
  if (!recipient?.active || recipient.must_change_password || recipient.id === actor.id
    || recipient.id === accountFor(previousIdentity, rows)?.id || !requestsMenuAllowed(recipient, permissions)) return;

  await insertRequestAssignedNotification(database, request, recipient.id);
}
