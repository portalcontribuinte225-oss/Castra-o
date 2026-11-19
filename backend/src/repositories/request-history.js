import { pool } from "../db/index.js";

// The notices sent about a request are kept in its history, after the request itself was saved.
export function appendRequestHistory(entries, id, municipalityId) {
  return pool.query(
    "UPDATE requests SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2 AND municipality_id = $3",
    [JSON.stringify(entries), id, municipalityId],
  );
}
