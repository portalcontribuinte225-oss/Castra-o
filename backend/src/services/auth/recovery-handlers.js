import bcrypt from "bcryptjs";
import { AUDIT_ACTIONS } from "../audit.js";
import { randomUUID } from "node:crypto";
import { AuthAudience, AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS } from "../../../../shared/auth-contract.js";
import { findAuthUser, findLoginCandidates, savePassword, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { allowAuthAttempt, consumeAuthLimit } from "../../repositories/auth-limits.js";
import { createChallenge, findChallenge, consumeChallenge, recordChallengeDelivery } from "../../repositories/auth-challenges.js";
import { authRequestContext } from "./session-handlers.js";
import { authError, requireNewPassword } from "./auth-security.js";
import { deliverAuthMessage } from "./auth-message-delivery.js";

const invalidCode = () => authError(400, "Código inválido ou expirado. Solicite um novo código.");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function forgotPassword(req, res) {
  const started = Date.now();
  const context = authRequestContext(req);
  const response = { ok: true, challengeId: randomUUID(), expiresIn: AUTH_CHALLENGE_SECONDS, retryAfter: AUTH_RETRY_SECONDS };
  let pending;
  if (await allowAuthAttempt({ ...context, purpose: AuthPurpose.PASSWORD_RESET }, { limit: 10, seconds: 600 })) {
    const candidates = await findLoginCandidates(context);
    const found = candidates.length === 1 ? candidates[0] : null;
    if (found && found.active !== false && (!found.municipality_id || found.municipality_active === true)
      && await consumeAuthLimit(["reset-send", found.id], { limit: 1, seconds: AUTH_RETRY_SECONDS })) {
      const emailVerified = context.audience === AuthAudience.STAFF ? Boolean(found.email) : Boolean(found.email_verified_at);
      const phoneVerified = context.audience === AuthAudience.TUTOR && Boolean(found.phone_verified_at);
      if (emailVerified || phoneVerified) {
        pending = await withAuthTransaction(async (client) => {
          const user = await findAuthUser(found.id, client, true);
          if (user.active === false || (user.municipality_id && user.municipality_active !== true)) return null;
          return { ...await createChallenge(client, { user, purpose: AuthPurpose.PASSWORD_RESET }), user };
        });
        if (pending) {
          response.challengeId = pending.challenge.id;
          try {
            const results = await deliverAuthMessage({
              purpose: AuthPurpose.PASSWORD_RESET, user: pending.user, municipalityId: pending.user.municipality_id,
              email: context.audience === AuthAudience.STAFF ? pending.user.email : pending.user.profile_email,
              phone: pending.user.profile_phone, emailVerified, phoneVerified, code: pending.code,
            });
            await recordChallengeDelivery(pending.challenge.id, results);
          } catch { /* A public response never reveals account presence or provider status. */ }
        }
      }
    }
  }
  // The same bounded response window covers absent, throttled and deliverable identities.
  await wait(Math.max(0, 12_000 - (Date.now() - started)));
  res.set("Cache-Control", "no-store").json(response);
}

export async function resetPassword(req, res) {
  const password = requireNewPassword(req.body?.password);
  const audience = req.body?.audience ?? AuthAudience.STAFF;
  if (!Object.values(AuthAudience).includes(audience)) throw invalidCode();
  const candidate = await findChallenge(req.body?.challengeId);
  if (!candidate) throw invalidCode();
  const allowed = await allowAuthAttempt({ purpose: "reset-confirm", audience, identifier: candidate.user_id, municipalityId: candidate.municipality_id, ip: req.ip });
  if (!allowed) throw invalidCode();
  const success = await withAuthTransaction(async (client) => {
    const user = await findAuthUser(candidate.user_id, client, true);
    if (!user || user.active === false || (user.municipality_id && user.municipality_active !== true)) return false;
    const challenge = await findChallenge(candidate.id, client, true);
    const consumed = await consumeChallenge(client, { challenge, user, code: req.body?.code, audience,
      municipalityId: req.body?.municipalityId, purpose: AuthPurpose.PASSWORD_RESET });
    if (!consumed) return false;
    await savePassword(client, user.id, await bcrypt.hash(password, 10));
    await strictAuthAudit(client, { actorId: user.id, userId: user.id, municipalityId: user.municipality_id, action: AUDIT_ACTIONS.PASSWORD_RESET });
    return true;
  });
  if (!success) throw invalidCode();
  res.set("Cache-Control", "no-store").json({ ok: true });
}
