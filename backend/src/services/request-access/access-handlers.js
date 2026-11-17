import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS, validateNewPassword } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { REQUEST_ACCESS_TOKEN_SECONDS } from "../../../../shared/request-access-contract.js";
import { TRACKING_CODE_PATTERN } from "../../../../shared/request-tracking-contract.js";
import { allowAuthAttempt, consumeAuthLimit } from "../../repositories/auth-limits.js";
import { findAuthUser, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { findAccessRequest, findAccessRequestByProtocol, insertTutorAccount, linkAccessRequest, tutorAccountExists } from "../../repositories/request-access.js";
import { consumeTrackingChallenge, createTrackingChallenge, findTrackingChallenge, isUuid, recordTrackingDelivery } from "../../repositories/request-tracking.js";
import { AUDIT_ACTIONS } from "../audit.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "../auth/auth-contacts.js";
import { deliverAuthMessage } from "../auth/auth-message-delivery.js";
import { authError, safeDigestEqual } from "../auth/auth-security.js";
import { issueSession } from "../auth/auth-session.js";
import { accessContactDigest, accessDestination, readAccessCpf, readAccessStartInput, sameCpf } from "./access-input.js";
import { createAccessToken, readAccessToken } from "./access-token.js";
import { buildAccessView } from "./access-view.js";

const invalidCode = () => authError(400, "Código inválido ou expirado. Solicite um novo código.");
const limited = () => Object.assign(authError(429, "Aguarde para tentar novamente."), { retryAfter: AUTH_RETRY_SECONDS });
const unavailable = () => authError(404, "Solicitação indisponível.");

// Delivery runs after the response, so neither timing nor delivery results reveal whether a request exists.
function runInBackground(task) { task().catch(() => {}); }

export function requireAccessToken(req, _res, next) {
  const header = req.get("authorization") || "";
  const claims = header.startsWith("Bearer ") ? readAccessToken(header.slice(7).trim()) : null;
  if (!claims) return next(authError(401, "Acesso expirado. Solicite um novo código."));
  req.access = claims;
  return next();
}

export function createAccessHandlers({ deliver = deliverAuthMessage, schedule = runInBackground } = {}) {
  // The code is the one the follow-up already sends ("para consultar sua solicitação, use o código…"), in the three channels.
  async function sendCode({ challenge, code }, destination) {
    const email = challenge.channel === NotificationChannel.EMAIL;
    const delivery = await deliver({ purpose: AuthPurpose.REQUEST_TRACKING, municipalityId: challenge.municipality_id, user: {}, code,
      email: email ? destination : "", phone: email ? "" : destination });
    await recordTrackingDelivery(challenge.id, delivery);
  }

  async function start(req, res) {
    const { municipalityId, protocol, cpf, channel } = readAccessStartInput(req.body);
    // Every limit is keyed on what the caller typed, never on what exists, so limited answers look alike.
    const scope = { purpose: "access-start", audience: "request-access", municipalityId, identifier: protocol, ip: req.ip };
    if (!await allowAuthAttempt(scope, { limit: 5 })) throw limited();
    if (!await consumeAuthLimit(["access-cpf", municipalityId, cpf], { limit: 5, seconds: 3600 })) throw limited();
    if (!await consumeAuthLimit(["access-send", municipalityId, protocol, channel, cpf], { limit: 1, seconds: AUTH_RETRY_SECONDS })) throw limited();
    const request = await findAccessRequestByProtocol(municipalityId, protocol);
    const destination = accessDestination(request, channel);
    let challengeId = randomUUID();
    // Only the CPF of the request's tutor opens it, and the code goes to a contact the request already has: the CPF never travels.
    if (sameCpf(request?.cpf, cpf) && destination) {
      const pending = await withAuthTransaction((client) => createTrackingChallenge(client, { request, channel }));
      challengeId = pending.challenge.id;
      schedule(() => sendCode(pending, destination));
    }
    res.set("Cache-Control", "no-store").json({ ok: true, challengeId, expiresIn: AUTH_CHALLENGE_SECONDS, retryAfter: AUTH_RETRY_SECONDS });
  }

  async function confirm(req, res) {
    const challengeId = req.params.id;
    const code = req.body?.code;
    const cpf = readAccessCpf(req.body?.cpf);
    if (!isUuid(challengeId) || !TRACKING_CODE_PATTERN.test(String(code ?? "")) || !cpf) throw invalidCode();
    // Keyed on the id the caller sent, so a guessed id is limited exactly like a real one.
    const scope = { purpose: "access-confirm", audience: "request-access", municipalityId: "", identifier: challengeId, ip: req.ip };
    if (!await allowAuthAttempt(scope, { limit: 10 })) throw limited();
    const candidate = await findTrackingChallenge(challengeId);
    if (!candidate) throw invalidCode();
    if (!await consumeAuthLimit(["access-confirm-request", candidate.request_id], { limit: 10, seconds: 600 })) throw invalidCode();
    const granted = await withAuthTransaction(async (client) => {
      const challenge = await findTrackingChallenge(candidate.id, client, true);
      const request = challenge ? await findAccessRequest(challenge.request_id, challenge.municipality_id, client) : null;
      // The CPF is checked again before the code: a code sent to follow a request, which asks for no CPF, never opens its
      // document. A wrong CPF spends one attempt of the code, as a wrong code does.
      const valid = await consumeTrackingChallenge(client, { challenge, code: request && sameCpf(request.cpf, cpf) ? code : "" });
      if (!valid) return null;
      await strictAuthAudit(client, { userId: null, municipalityId: request.municipality_id, action: AUDIT_ACTIONS.REQUEST_ACCESS_GRANTED,
        changes: { channel: challenge.channel }, entityType: "request", entityId: request.id });
      return { request, channel: challenge.channel };
    });
    if (!granted) throw invalidCode();
    const { request, channel } = granted;
    const token = createAccessToken({ requestId: request.id, municipalityId: request.municipality_id, channel,
      contact: accessContactDigest(channel, accessDestination(request, channel)) });
    res.set("Cache-Control", "no-store").json({ token, expiresIn: REQUEST_ACCESS_TOKEN_SECONDS });
  }

  async function view(req, res) {
    const row = await findAccessRequest(req.access.requestId, req.access.municipalityId);
    if (!row) throw unavailable();
    const cpf = readAccessCpf(row.cpf);
    const exists = Boolean(row.tutor_id) || (cpf ? await tutorAccountExists(row.municipality_id, cpf) : false);
    res.set("Cache-Control", "no-store").json({ request: buildAccessView(row), account: { exists } });
  }

  // The tutor's account is born here, on the first access, from the request the code was confirmed for.
  async function createPassword(req, res) {
    const password = req.body?.password;
    const issue = validateNewPassword(password);
    if (issue) throw authError(400, issue);
    if (!await consumeAuthLimit(["access-password", req.access.requestId], { limit: 5, seconds: 600 })) throw limited();
    const passwordHash = await bcrypt.hash(password, 10);
    const { channel, contact } = req.access;
    const user = await withAuthTransaction(async (client) => {
      const request = await findAccessRequest(req.access.requestId, req.access.municipalityId, client, true);
      const cpf = readAccessCpf(request?.cpf);
      if (!request || !cpf) throw unavailable();
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tutor-account:${request.municipality_id}:${cpf}`]);
      if (request.tutor_id || await tutorAccountExists(request.municipality_id, cpf, client)) {
        throw authError(409, "Este CPF já tem acesso. Entre com seu CPF e sua senha.");
      }
      const name = String(request.tutor_name || "").trim().slice(0, 160);
      if (name.length < 2) throw authError(422, "Não foi possível criar o acesso com os dados desta solicitação. Procure o atendimento.");
      // Confirmed only when the contact the code went to is still the one in the request.
      const current = accessContactDigest(channel, accessDestination(request, channel));
      const confirmed = Boolean(current) && safeDigestEqual(current, contact);
      const email = channel === NotificationChannel.EMAIL;
      const userId = await insertTutorAccount(client, {
        request, name, cpf, passwordHash, email: normalizeAuthEmail(request.tutor_email), phone: normalizeAuthPhone(request.phone),
        verified: { email: confirmed && email, phone: confirmed && !email },
      });
      const linkedAnimals = await linkAccessRequest(client, { request, userId });
      await strictAuthAudit(client, { userId, municipalityId: request.municipality_id, action: AUDIT_ACTIONS.TUTOR_ACCOUNT_CREATED,
        changes: { requestId: request.id, confirmedChannel: confirmed ? channel : null, linkedAnimals } });
      return findAuthUser(userId, client);
    });
    res.status(201).set("Cache-Control", "no-store").json(issueSession(user));
  }

  return { start, confirm, view, createPassword };
}
