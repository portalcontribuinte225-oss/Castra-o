import { randomUUID } from "node:crypto";
import { AuthAudience, AuthErrorCode, AUTH_CHALLENGE_SECONDS } from "../../../../shared/auth-contract.js";
import { authenticatedDigest, safeDigestEqual, authError } from "./auth-security.js";

const TOKEN_PURPOSE = "recovery-options";
export const invalidRecovery = () => authError(400, "Escolha o contato novamente.", AuthErrorCode.RECOVERY_OPTIONS_EXPIRED);

export function createRecoveryToken(user, now = Date.now()) {
  const claims = { userId: user.id, audience: user.role === AuthAudience.TUTOR ? AuthAudience.TUTOR : AuthAudience.STAFF,
    municipalityId: user.municipality_id || null, sessionVersion: user.session_version, profileVersion: user.profile_version || 0,
    passwordRevision: authenticatedDigest(TOKEN_PURPOSE, user.password), expiresAt: now + AUTH_CHALLENGE_SECONDS * 1000, nonce: randomUUID() };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${authenticatedDigest(TOKEN_PURPOSE, payload)}`;
}

export function readRecoveryToken(token, { audience, municipalityId }, now = Date.now()) {
  if (typeof token !== "string" || token.length > 2048) throw invalidRecovery();
  const [payload, signature, extra] = token.split(".");
  if (!payload || extra !== undefined || !safeDigestEqual(signature, authenticatedDigest(TOKEN_PURPOSE, payload))) throw invalidRecovery();
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw invalidRecovery(); }
  if (!claims || claims.audience !== audience || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now
    || (audience === AuthAudience.TUTOR && claims.municipalityId !== municipalityId)) throw invalidRecovery();
  return claims;
}

export function matchesRecoveryUser(claims, user) {
  return Boolean(user && user.id === claims.userId && user.active !== false
    && (!user.municipality_id || user.municipality_active === true)
    && (user.role === AuthAudience.TUTOR ? AuthAudience.TUTOR : AuthAudience.STAFF) === claims.audience
    && (user.municipality_id || null) === claims.municipalityId && user.session_version === claims.sessionVersion
    && (user.profile_version || 0) === claims.profileVersion
    && safeDigestEqual(claims.passwordRevision, authenticatedDigest(TOKEN_PURPOSE, user.password)));
}

export function recoveryOptionId(token, channel, destination) {
  return authenticatedDigest("recovery-option", token, channel, destination);
}

export function recoveryDestination(channel, value) { return JSON.stringify({ version: 1, channel, value }); }

export function readRecoveryDestination(value) {
  try {
    const destination = JSON.parse(value);
    return destination?.version === 1 && typeof destination.value === "string" ? destination : null;
  } catch { return null; }
}
