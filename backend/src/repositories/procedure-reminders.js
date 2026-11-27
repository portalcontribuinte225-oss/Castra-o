import { pool } from "../db/index.js";
import { EMAIL_ACTIVE_USES_CONFIG_KEY } from "../../../shared/email-contract.js";
import { SMS_ACTIVE_USES_CONFIG_KEY } from "../../../shared/sms-contract.js";
import { WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY } from "../../../shared/whatsapp-templates-contract.js";
import { NotificationEvent } from "../../../shared/notification-contract.js";
import { RequestStatus } from "../../../shared/request-contract.js";
import { displayScheduleDate } from "../../../shared/schedule-contract.js";

const EVENT = NotificationEvent.SCHEDULE_REMINDER;
const BATCH_SIZE = 100;

export async function* procedureReminderRequests(date, database = pool) {
  let afterId = null;
  for (;;) {
    const { rows } = await database.query(
      `SELECT r.id, r.municipality_id, r.protocol, r.request_type, r.status, r.tutor_name, r.city,
              r.animal_name, r.species, r.animals, r.schedule_date, r.schedule_location_name,
              r.schedule_address, r.schedule_address_url, r.workflow_data, r.updated_at::text AS revision
       FROM requests r JOIN municipalities m ON m.id = r.municipality_id AND m.active
       WHERE r.status = $1 AND r.workflow_data->'followUp'->'enabled' = 'true'::jsonb
         AND (r.schedule_date = ANY($2::text[]) OR r.workflow_data->'procedureScheduleDates' ?| $2::text[])
         AND ($3::uuid IS NULL OR r.id > $3)
         AND EXISTS (
           SELECT 1 FROM config c WHERE c.municipality_id = r.municipality_id AND (
             (c.key = ANY($4::text[]) AND c.value->'active'->$6::text = 'true'::jsonb)
             OR (c.key = $5 AND c.value->'active' ? $6::text)
           )
         )
       ORDER BY r.id LIMIT $7`,
      [RequestStatus.SCHEDULED, [date, displayScheduleDate(date)], afterId, [EMAIL_ACTIVE_USES_CONFIG_KEY, SMS_ACTIVE_USES_CONFIG_KEY],
        WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, EVENT, BATCH_SIZE],
    );
    yield* rows;
    if (rows.length < BATCH_SIZE) return;
    afterId = rows.at(-1).id;
  }
}

// A claim is stored before talking to a provider. Concurrent runs cannot claim the same appointment.
export async function claimProcedureReminder(request, previous, next, database = pool) {
  const { rowCount } = await database.query(
    `UPDATE requests
     SET workflow_data = jsonb_set(workflow_data, '{notificationDispatches}',
       COALESCE(NULLIF(workflow_data->'notificationDispatches', 'null'::jsonb), '{}'::jsonb) || jsonb_build_object($4::text, $5::jsonb))
     WHERE id = $1 AND municipality_id = $2 AND updated_at IS NOT DISTINCT FROM $3::timestamptz
       AND (workflow_data->'notificationDispatches'->$4::text) IS NOT DISTINCT FROM $6::jsonb`,
    [request.id, request.municipality_id, request.revision, EVENT, JSON.stringify(next),
      previous === undefined ? null : JSON.stringify(previous)],
  );
  return rowCount === 1;
}
