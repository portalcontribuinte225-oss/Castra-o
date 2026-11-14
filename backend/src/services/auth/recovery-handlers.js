import bcrypt from "bcryptjs";
import { AUDIT_ACTIONS } from "../audit.js";
import { AuthAudience, AuthErrorCode, AuthPurpose, ContactKind, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { findAuthUser, findLoginCandidates, savePassword, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { allowAuthAttempt, consumeAuthLimit } from "../../repositories/auth-limits.js";
import { createChallenge, findChallenge, consumeChallenge, recordChallengeDelivery } from "../../repositories/auth-challenges.js";
import { saveVerifiedContact } from "../../repositories/tutor-profiles.js";
import { authRequestContext } from "./session-handlers.js";
import { authError, requireNewPassword, safeDigestEqual } from "./auth-security.js";
import { isActiveAccount } from "./auth-session.js";
import { deliverAuthMessage } from "./auth-message-delivery.js";
import { recoveryContacts } from "./auth-contacts.js";
import { getRecoveryOptions } from "./recovery-channels.js";
import { createRecoveryToken, readRecoveryToken, matchesRecoveryUser, invalidRecovery, recoveryDestination, readRecoveryDestination } from "./recovery-token.js";

const invalidCode = () => authError(400, "Código inválido ou expirado. Solicite um novo código.");
const limited = () => Object.assign(authError(429, "Aguarde para tentar novamente."), { retryAfter: AUTH_RETRY_SECONDS });

export async function recoveryOptions(req, res) {
  const context = authRequestContext(req);
  if (!await allowAuthAttempt({ ...context, purpose: "recovery-options" })) throw limited();
  const candidates = await findLoginCandidates(context);
  if (candidates.length > 1 && context.audience === AuthAudience.TUTOR && context.identifier.includes("@")) {
    throw authError(400, "Informe seu CPF para recuperar o acesso.", AuthErrorCode.CPF_REQUIRED);
  }
  const user = candidates.length === 1 ? candidates[0] : null;
  const recoveryToken = isActiveAccount(user) ? createRecoveryToken(user) : "";
  const options = recoveryToken ? await getRecoveryOptions(user, recoveryToken) : [];
  res.set("Cache-Control", "no-store").json({ recoveryToken: options.length ? recoveryToken : "", options });
}

export async function forgotPassword(req, res) {
  const context = authRequestContext({ ip: req.ip, body: { ...req.body, identifier: "recovery" } });
  const claims = readRecoveryToken(req.body?.recoveryToken, context);
  if (!await allowAuthAttempt({ ...context, identifier: claims.userId, purpose: AuthPurpose.PASSWORD_RESET })) throw limited();
  if (!await consumeAuthLimit(["reset-send", claims.userId], { limit: 1, seconds: AUTH_RETRY_SECONDS })) throw limited();
  const pending = await withAuthTransaction(async (client) => {
    const user = await findAuthUser(claims.userId, client, true);
    if (!matchesRecoveryUser(claims, user)) throw invalidRecovery();
    const options = await getRecoveryOptions(user, req.body.recoveryToken, { database: client });
    const option = options.find((item) => safeDigestEqual(item.id, req.body?.optionId));
    if (!option) throw invalidRecovery();
    const destination = recoveryContacts(user)[option.channel];
    return { ...await createChallenge(client, { user, purpose: AuthPurpose.PASSWORD_RESET,
      destination: recoveryDestination(option.channel, destination) }), user, channel: option.channel, destination };
  });
  const { challenge, user, code, channel, destination } = pending;
  const delivery = await deliverAuthMessage({ purpose: AuthPurpose.PASSWORD_RESET, user, municipalityId: user.municipality_id,
    channel, code, challengeId: challenge.id, expiresAt: challenge.expires_at,
    email: channel === NotificationChannel.EMAIL ? destination : "", phone: channel !== NotificationChannel.EMAIL ? destination : "" });
  await recordChallengeDelivery(challenge.id, delivery);
  res.set("Cache-Control", "no-store").json({ ok: true, challengeId: challenge.id, expiresIn: AUTH_CHALLENGE_SECONDS,
    retryAfter: AUTH_RETRY_SECONDS, expiresAt: challenge.expires_at, retryAt: new Date(challenge.expires_at.getTime()
      - (AUTH_CHALLENGE_SECONDS - AUTH_RETRY_SECONDS) * 1000), serverNow: new Date(),
    delivery: delivery.map(({ channel: selected, status, code: failure, reason }) => ({ channel: selected, status, code: failure, reason })) });
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
    if (!isActiveAccount(user)) return false;
    const challenge = await findChallenge(candidate.id, client, true);
    const destination = readRecoveryDestination(challenge?.destination);
    if (!destination || recoveryContacts(user)[destination.channel] !== destination.value || !destination.value) return false;
    const consumed = await consumeChallenge(client, { challenge, user, code: req.body?.code, audience,
      municipalityId: req.body?.municipalityId, purpose: AuthPurpose.PASSWORD_RESET });
    if (!consumed) return false;
    if (user.role === AuthAudience.TUTOR) {
      const email = destination.channel === NotificationChannel.EMAIL;
      if (!(email ? user.email_verified_at : user.phone_verified_at)) await saveVerifiedContact(client,
        { userId: user.id, municipalityId: user.municipality_id, kind: email ? ContactKind.EMAIL : ContactKind.PHONE, value: destination.value });
    }
    await savePassword(client, user.id, await bcrypt.hash(password, 10));
    await strictAuthAudit(client, { actorId: user.id, userId: user.id, municipalityId: user.municipality_id, action: AUDIT_ACTIONS.PASSWORD_RESET });
    return true;
  });
  if (!success) throw invalidCode();
  res.set("Cache-Control", "no-store").json({ ok: true });
}
