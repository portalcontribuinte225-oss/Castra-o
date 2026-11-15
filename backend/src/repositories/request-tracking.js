import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { AUTH_CHALLENGE_SECONDS, AUTH_MAX_CODE_ATTEMPTS } from "../../../shared/auth-contract.js";
import { TRACKING_CODE_PATTERN } from "../../../shared/request-tracking-contract.js";
import { authenticatedDigest, safeDigestEqual, verificationCode } from "../services/auth/auth-security.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === "string" && UUID_PATTERN.test(value);

export function trackingChallengeDigest(challenge, code) {
  return authenticatedDigest("request-tracking-challenge", challenge.id, challenge.request_id, challenge.municipality_id, challenge.channel, String(code));
}

// Only a request of an active municipality can be followed. The protocol is globally unique; the tenant scope stays explicit.
export async function findTrackableRequest(municipalityId, protocol, database = pool) {
  const { rows } = await database.query(
    `SELECT r.id, r.municipality_id, r.workflow_data->'followUp' AS follow_up
     FROM requests r JOIN municipalities m ON m.id = r.municipality_id
     WHERE r.municipality_id = $1 AND r.protocol = $2 AND m.active = TRUE`,
    [municipalityId, protocol],
  );
  return rows[0] || null;
}

// The code is returned once to the caller and stored only as a digest; a new challenge retires the previous ones.
export async function createTrackingChallenge(database, { request, channel, now = new Date() }) {
  const code = verificationCode();
  const challenge = { id: randomUUID(), request_id: request.id, municipality_id: request.municipality_id, channel,
    expires_at: new Date(now.getTime() + AUTH_CHALLENGE_SECONDS * 1000) };
  await database.query("UPDATE request_tracking_challenges SET consumed_at = $1 WHERE request_id = $2 AND consumed_at IS NULL", [now, request.id]);
  await database.query(
    `INSERT INTO request_tracking_challenges (id, request_id, municipality_id, channel, digest, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [challenge.id, challenge.request_id, challenge.municipality_id, channel, trackingChallengeDigest(challenge, code), challenge.expires_at],
  );
  await database.query(`DELETE FROM request_tracking_challenges WHERE id IN
    (SELECT id FROM request_tracking_challenges WHERE expires_at < $1 ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED)`, [new Date(now.getTime() - 86400_000)]);
  return { challenge, code };
}

export async function findTrackingChallenge(id, database = pool, lock = false) {
  if (!isUuid(id)) return null;
  const { rows } = await database.query(`SELECT * FROM request_tracking_challenges WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] || null;
}

// A wrong guess is committed by the caller instead of being rolled back with an exception.
export async function consumeTrackingChallenge(database, { challenge, code, now = new Date() }) {
  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at) <= now || challenge.attempts >= AUTH_MAX_CODE_ATTEMPTS) return false;
  const valid = TRACKING_CODE_PATTERN.test(String(code ?? "")) && safeDigestEqual(challenge.digest, trackingChallengeDigest(challenge, code));
  await database.query(
    "UPDATE request_tracking_challenges SET attempts = attempts + 1, consumed_at = CASE WHEN $2::boolean THEN $3::timestamptz ELSE consumed_at END WHERE id = $1",
    [challenge.id, valid, now],
  );
  return valid;
}

export async function recordTrackingDelivery(id, results, database = pool) {
  await database.query("UPDATE request_tracking_challenges SET delivery = $2::jsonb WHERE id = $1", [id, JSON.stringify(results)]);
}

// Reads only what the public projection may expose, always scoped to the token's own request and tenant.
export async function findTrackedRequest(requestId, municipalityId, database = pool) {
  const { rows } = await database.query(
    `SELECT r.protocol, r.request_type, r.status, r.created_at, r.updated_at, r.schedule_date,
            r.schedule_location_name, r.schedule_address, r.documents
     FROM requests r JOIN municipalities m ON m.id = r.municipality_id
     WHERE r.id = $1 AND r.municipality_id = $2 AND m.active = TRUE`,
    [requestId, municipalityId],
  );
  return rows[0] || null;
}
