import { randomUUID } from "node:crypto";
import { TRACKING_TOKEN_SECONDS } from "../../../../shared/request-tracking-contract.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

const TOKEN_PURPOSE = "request-tracking-token";

// A tracking token opens exactly one request of one municipality, read-only, for a short time. It is never a session.
export function createTrackingToken({ requestId, municipalityId }, now = Date.now()) {
  const claims = { requestId, municipalityId, expiresAt: now + TRACKING_TOKEN_SECONDS * 1000, nonce: randomUUID() };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${authenticatedDigest(TOKEN_PURPOSE, payload)}`;
}

// Returns the claims of a valid token, or null. Callers answer every failure the same way.
export function readTrackingToken(token, now = Date.now()) {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || extra !== undefined || !safeDigestEqual(signature, authenticatedDigest(TOKEN_PURPOSE, payload))) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (!claims || !isUuid(claims.requestId) || !isUuid(claims.municipalityId)
    || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now) return null;
  return { requestId: claims.requestId, municipalityId: claims.municipalityId, expiresAt: claims.expiresAt };
}
