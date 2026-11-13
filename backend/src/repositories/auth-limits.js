import { pool } from "../db/index.js";
import { authenticatedDigest } from "../services/auth/auth-security.js";

// Persistent windows also count unknown identities. The bounded cleanup never scans unbounded history.
export async function consumeAuthLimit(keyParts, { limit = 10, seconds = 600, now = new Date(), database = pool } = {}) {
  const key = authenticatedDigest("auth-limit", ...keyParts);
  const expires = new Date(now.getTime() + seconds * 1000);
  const { rows } = await database.query(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at, expires_at) VALUES ($1, 1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET
       attempts = CASE WHEN auth_rate_limits.expires_at <= $2 THEN 1 ELSE auth_rate_limits.attempts + 1 END,
       window_started_at = CASE WHEN auth_rate_limits.expires_at <= $2 THEN $2 ELSE auth_rate_limits.window_started_at END,
       expires_at = CASE WHEN auth_rate_limits.expires_at <= $2 THEN $3 ELSE auth_rate_limits.expires_at END
     RETURNING attempts`, [key, now, expires],
  );
  await database.query(`DELETE FROM auth_rate_limits WHERE key IN
    (SELECT key FROM auth_rate_limits WHERE expires_at < $1 ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED)`, [now]);
  return rows[0].attempts <= limit;
}

export async function allowAuthAttempt({ purpose, audience, identifier, municipalityId, ip }, options = {}) {
  const origin = await consumeAuthLimit([purpose, "origin", ip || "unknown"], { ...options, limit: (options.limit || 10) * 5 });
  if (!origin) return false;
  return consumeAuthLimit([purpose, audience, municipalityId || "", identifier], options);
}
