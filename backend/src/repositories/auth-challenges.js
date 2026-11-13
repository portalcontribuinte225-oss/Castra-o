import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { AuthAudience, AUTH_CHALLENGE_SECONDS, AUTH_MAX_CODE_ATTEMPTS } from "../../../shared/auth-contract.js";
import { authenticatedDigest, safeDigestEqual, verificationCode } from "../services/auth/auth-security.js";

export function challengeDigest(challenge, code, passwordHash) {
  return authenticatedDigest("auth-challenge", challenge.id, challenge.user_id, challenge.municipality_id,
    challenge.purpose, challenge.destination, challenge.session_version, challenge.profile_version, passwordHash, String(code));
}

export async function createChallenge(database, { user, purpose, destination = null, now = new Date() }) {
  const code = verificationCode();
  const challenge = {
    id: randomUUID(), user_id: user.id, municipality_id: user.municipality_id || null,
    audience: user.role === AuthAudience.TUTOR ? AuthAudience.TUTOR : AuthAudience.STAFF,
    purpose, destination, session_version: user.session_version, profile_version: user.profile_version || 0,
    expires_at: new Date(now.getTime() + AUTH_CHALLENGE_SECONDS * 1000),
  };
  await database.query("UPDATE auth_challenges SET consumed_at = $1 WHERE user_id = $2 AND purpose = $3 AND consumed_at IS NULL", [now, user.id, purpose]);
  await database.query(`INSERT INTO auth_challenges
    (id,user_id,municipality_id,audience,purpose,destination,digest,session_version,profile_version,expires_at,next_send_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [challenge.id, user.id, challenge.municipality_id, challenge.audience, purpose, destination,
    challengeDigest(challenge, code, user.password), user.session_version, challenge.profile_version, challenge.expires_at, new Date(now.getTime() + 60_000)]);
  await database.query(`DELETE FROM auth_challenges WHERE id IN
    (SELECT id FROM auth_challenges WHERE expires_at < $1 ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED)`, [new Date(now.getTime() - 86400_000)]);
  return { challenge, code };
}

export async function findChallenge(id, database = pool, lock = false) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const { rows } = await database.query(`SELECT * FROM auth_challenges WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] || null;
}

// Wrong guesses are committed by the caller, rather than rolled back with an exception.
export async function consumeChallenge(database, { challenge, user, code, purpose, audience, municipalityId, now = new Date() }) {
  if (!challenge || challenge.user_id !== user.id || challenge.purpose !== purpose || challenge.audience !== audience
    || challenge.audience !== (user.role === AuthAudience.TUTOR ? AuthAudience.TUTOR : AuthAudience.STAFF)
    || challenge.municipality_id !== (user.municipality_id || null)
    || (audience === AuthAudience.TUTOR && challenge.municipality_id !== municipalityId)
    || challenge.consumed_at || new Date(challenge.expires_at) <= now || challenge.attempts >= AUTH_MAX_CODE_ATTEMPTS
    || challenge.session_version !== user.session_version || challenge.profile_version !== (user.profile_version || 0)) return false;
  const valid = /^\d{6}$/.test(String(code || "")) && safeDigestEqual(challenge.digest, challengeDigest(challenge, code, user.password));
  await database.query("UPDATE auth_challenges SET attempts = attempts + 1, consumed_at = CASE WHEN $2 THEN $3 ELSE consumed_at END WHERE id = $1",
    [challenge.id, valid, now]);
  return valid;
}

export async function recordChallengeDelivery(id, results, database = pool) {
  await database.query("UPDATE auth_challenges SET delivery = $2::jsonb WHERE id = $1", [id, JSON.stringify(results)]);
}
