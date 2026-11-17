import { randomUUID } from "node:crypto";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { REQUEST_ACCESS_TOKEN_SECONDS } from "../../../../shared/request-access-contract.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

// Its own signing purpose: a tracking token never opens a request document, and an access token never follows a request.
const TOKEN_PURPOSE = "request-access-token";
const CHANNELS = new Set([NotificationChannel.EMAIL, NotificationChannel.WHATSAPP]);

// An access token opens one request of one municipality for a short time. It is never a session. `contact` is the digest of the
// contact that received the code, so only that contact is confirmed when the account is created.
export function createAccessToken({ requestId, municipalityId, channel, contact }, now = Date.now()) {
  const claims = { requestId, municipalityId, channel, contact, expiresAt: now + REQUEST_ACCESS_TOKEN_SECONDS * 1000, nonce: randomUUID() };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${authenticatedDigest(TOKEN_PURPOSE, payload)}`;
}

// Returns the claims of a valid token, or null. Callers answer every failure the same way.
export function readAccessToken(token, now = Date.now()) {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || extra !== undefined || !safeDigestEqual(signature, authenticatedDigest(TOKEN_PURPOSE, payload))) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (!claims || !isUuid(claims.requestId) || !isUuid(claims.municipalityId) || !CHANNELS.has(claims.channel) || typeof claims.contact !== "string"
    || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now) return null;
  return { requestId: claims.requestId, municipalityId: claims.municipalityId, channel: claims.channel, contact: claims.contact, expiresAt: claims.expiresAt };
}
