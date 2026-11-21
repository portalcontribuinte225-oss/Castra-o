import { pool } from "../db/index.js";
import { StaffNotificationType } from "../../../shared/staff-notifications-contract.js";

// The staff-only permission is enforced before any call. The same predicate protects the list,
// unread count and opening a request, including the optional scope chosen by a global user.
const visibleEvents = `
  FROM staff_notifications e
  JOIN requests r ON r.id = e.request_id AND r.municipality_id = e.municipality_id
  JOIN municipalities m ON m.id = e.municipality_id AND m.active = TRUE
`;
const scopedEvents = `
  WHERE ($2::uuid IS NULL OR e.municipality_id = $2)
    AND (e.recipient_user_id IS NULL OR e.recipient_user_id = $1)
`;
const readState = `
  LEFT JOIN staff_notification_reads s ON s.notification_id = e.id AND s.user_id = $1
`;

export async function insertRequestCreatedNotification(database, { id, municipality_id }) {
  await database.query(
    `INSERT INTO staff_notifications (municipality_id, request_id, event_type) VALUES ($1, $2, $3)
     ON CONFLICT (request_id) WHERE recipient_user_id IS NULL DO NOTHING`,
    [municipality_id, id, StaffNotificationType.REQUEST_CREATED],
  );
}

export async function insertRequestAssignedNotification(database, { id, municipality_id }, recipientId) {
  await database.query(
    "INSERT INTO staff_notifications (municipality_id, request_id, event_type, recipient_user_id) VALUES ($1, $2, $3, $4)",
    [municipality_id, id, StaffNotificationType.REQUEST_ASSIGNED, recipientId],
  );
}

export async function listStaffNotifications({ userId, municipalityId, cursor, limit }, database = pool) {
  const { rows } = await database.query(
    `SELECT e.id, e.event_type, e.request_id, e.municipality_id, e.created_at, r.protocol, s.read_at IS NOT NULL AS read
     ${visibleEvents} ${readState} ${scopedEvents}
       AND ($3::bigint IS NULL OR e.id < $3::bigint)
     ORDER BY e.id DESC LIMIT $4`,
    [userId, municipalityId, cursor, limit + 1],
  );
  return {
    rows: rows.slice(0, limit),
    nextCursor: rows.length > limit ? String(rows[limit - 1].id) : null,
  };
}

export async function countUnreadStaffNotifications({ userId, municipalityId }, database = pool) {
  const { rows } = await database.query(
    `SELECT COUNT(*) AS count ${visibleEvents} ${readState} ${scopedEvents} AND s.notification_id IS NULL`,
    [userId, municipalityId],
  );
  return Number(rows[0].count);
}

export async function markStaffNotificationRead(database, { id, userId, municipalityId }) {
  const { rows } = await database.query(
    `WITH target AS (
       SELECT e.id AS notification_id, r.* ${visibleEvents} ${scopedEvents}
         AND e.id = $3 FOR KEY SHARE OF e, r
     ), mark_read AS (
       INSERT INTO staff_notification_reads (notification_id, user_id)
       SELECT notification_id, $1 FROM target ON CONFLICT DO NOTHING
     )
     SELECT to_jsonb(target) - 'notification_id' AS request FROM target`,
    [userId, municipalityId, id],
  );
  return rows[0]?.request || null;
}
