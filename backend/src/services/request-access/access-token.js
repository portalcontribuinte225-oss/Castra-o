import { randomUUID } from "node:crypto";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { REQUEST_ACCESS_TOKEN_SECONDS } from "../../../../shared/request-access-contract.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

// Its own signing purpose: no other token of the system opens the requests.
const TOKEN_PURPOSE = "request-access-token";
// The kind of contact that received the code: an e-mail, or a phone (kept as WhatsApp).
const CHANNELS = new Set([NotificationChannel.EMAIL, NotificationChannel.WHATSAPP]);

// An access token opens, for a short time, the requests of one CPF in one municipality that share the contact that received the
// code. It holds digests of the verified CPF and destination so edits to a request cannot extend the grant to someone else.
export function createAccessToken({ requestId, municipalityId, channel, contact, cpfDigest }, now = Date.now()) {
  const claims = { requestId, municipalityId, channel, contact, cpfDigest, expiresAt: now + REQUEST_ACCESS_TOKEN_SECONDS * 1000, nonce: randomUUID() };
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
  if (!claims || !isUuid(claims.requestId) || !isUuid(claims.municipalityId) || !CHANNELS.has(claims.channel)
    || typeof claims.contact !== "string" || typeof claims.cpfDigest !== "string"
    || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now) return null;
  return { requestId: claims.requestId, municipalityId: claims.municipalityId, channel: claims.channel, contact: claims.contact,
    cpfDigest: claims.cpfDigest, expiresAt: claims.expiresAt };
}
