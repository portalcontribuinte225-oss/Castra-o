import { pool } from "../db/index.js";

// The notices sent about a request are kept in its history, after the request itself was saved.
export function appendRequestHistory(entries, id, municipalityId) {
  return pool.query(
    "UPDATE requests SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2 AND municipality_id = $3",
    [JSON.stringify(entries), id, municipalityId],
  );
}

export async function findRequestHistory(database, { id, municipalityId, tutorAuditAction }) {
  const { rows } = await database.query(
    `SELECT r.municipality_id, r.created_at, r.origin, r.status, r.history,
       r.workflow_data->>'animal_request_type' AS animal_origin,
       r.workflow_data->>'cancelReason' AS cancel_reason,
       (SELECT jsonb_agg(jsonb_build_object('at', a.created_at, 'by', a.user_id) ORDER BY a.created_at, a.id)
        FROM audit_logs a
        WHERE a.municipality_id = r.municipality_id AND a.action = $3
          AND (a.changes->>'requestId' = r.id::text OR (a.entity_type = 'request' AND a.entity_id = r.id::text))) AS tutor_history
     FROM requests r
     WHERE r.id = $1 AND ($2::uuid IS NULL OR r.municipality_id = $2)`,
    [id, municipalityId, tutorAuditAction],
  );
  return rows[0] || null;
}

export async function findRequestHistoryActors(database, { ids, municipalityId, globalRoles }) {
  if (!ids.length) return new Map();
  const { rows } = await database.query(
    `SELECT id, name FROM users WHERE id = ANY($1::uuid[])
      AND (municipality_id = $2 OR role = ANY($3::text[]))`,
    [ids, municipalityId, globalRoles],
  );
  return new Map(rows.map(({ id, name }) => [id, name]));
}
