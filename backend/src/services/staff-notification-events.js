import { isUuid } from "../repositories/request-tracking.js";
import { insertRequestAssignedNotification } from "../repositories/staff-notifications.js";
import { readMunicipalityPermissions, requestsMenuAllowed } from "./config-permission.js";

// The assigned user is an account id; any other value names no account.
const accountId = (value) => typeof value === "string" && isUuid(value) ? value.toLowerCase() : null;

// The caller holds the request row lock until commit.
export async function recordRequestAssignmentNotification(database, { previous, request, actor }) {
  const before = previous.workflow_data?.assignedUserId;
  const after = request.workflow_data?.assignedUserId;
  if (typeof after !== "string" || !after || before === after || after === actor.id) return;
  const recipientId = accountId(after);
  if (!recipientId || recipientId === accountId(before)) return;

  const municipalityId = request.municipality_id;
  const permissions = await readMunicipalityPermissions(municipalityId, database);
  const { rows } = await database.query(
    `SELECT u.id, u.email, u.role, u.active, u.must_change_password
     FROM users u JOIN municipalities m ON m.id = u.municipality_id AND m.active = TRUE
     WHERE u.municipality_id = $1 AND u.id = $2`,
    [municipalityId, recipientId],
  );
  const recipient = rows[0];
  if (!recipient?.active || recipient.must_change_password || recipient.id === actor.id || !requestsMenuAllowed(recipient, permissions)) return;

  await insertRequestAssignedNotification(database, request, recipient.id);
}
