import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS, validateNewPassword } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { ACCESS_CODE_PATTERN, REQUEST_ACCESS_TOKEN_SECONDS } from "../../../../shared/request-access-contract.js";
import { allowAuthAttempt, consumeAuthLimit } from "../../repositories/auth-limits.js";
import { findAuthUser, strictAuthAudit, withAuthTransaction } from "../../repositories/auth-users.js";
import { accessRequestsByCpf, findAccessRequest, insertTutorAccount, linkAccessRequest, tutorAccountExists } from "../../repositories/request-access.js";
import { consumeTrackingChallenge, createTrackingChallenge, findTrackingChallenge, isUuid, recordTrackingDelivery } from "../../repositories/request-tracking.js";
import { AUDIT_ACTIONS } from "../audit.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "../auth/auth-contacts.js";
import { deliverAuthMessage } from "../auth/auth-message-delivery.js";
import { authError } from "../auth/auth-security.js";
import { issueSession } from "../auth/auth-session.js";
import { listCodeChannels } from "../auth/code-channels.js";
import {
  accessContactDigest, accessCpfDigest, accessDestination, contactChannel, matchesAccess, readAccessCpf, readAccessStartInput, sameCpf,
} from "./access-input.js";
import { createAccessToken, readAccessToken } from "./access-token.js";
import { buildAccessView } from "./access-view.js";

const invalidCode = () => authError(400, "Código inválido ou expirado. Solicite um novo código.");
const limited = () => Object.assign(authError(429, "Aguarde para tentar novamente."), { retryAfter: AUTH_RETRY_SECONDS });
const unavailable = () => authError(404, "Solicitação indisponível.");

// Delivery runs after the response, so neither timing nor delivery results reveal whether a request exists.
function runInBackground(task) { task().catch(() => {}); }

const listAccessChannels = (municipalityId) => listCodeChannels(municipalityId, AuthPurpose.REQUEST_TRACKING);

export function requireAccessToken(req, _res, next) {
  const header = req.get("authorization") || "";
  const claims = header.startsWith("Bearer ") ? readAccessToken(header.slice(7).trim()) : null;
  if (!claims) return next(authError(401, "Acesso expirado. Solicite um novo código."));
  req.access = claims;
  return next();
}

const MAX_ACCESS_REQUESTS = 20;

async function openedRequests(access, database, lock = false) {
  let anchor = await findAccessRequest(access.requestId, access.municipalityId, database);
  if (!matchesAccess(anchor, access)) throw unavailable();
  const cpf = readAccessCpf(anchor.cpf);
  if (lock) {
    await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tutor-account:${access.municipalityId}:${cpf}`]);
    anchor = await findAccessRequest(access.requestId, access.municipalityId, database, true);
    if (!matchesAccess(anchor, access)) throw unavailable();
  }
  const requests = [];
  for await (const request of accessRequestsByCpf(access.municipalityId, cpf, database)) {
    if (matchesAccess(request, access)) requests.push(request);
    if (requests.length === MAX_ACCESS_REQUESTS) break;
  }
  return { anchor, cpf, requests };
}

export function createAccessHandlers({ deliver = deliverAuthMessage, schedule = runInBackground, listChannels = listAccessChannels } = {}) {
  // The code goes only by the channel the person chose, with the message "Acesso à solicitação".
  async function sendCode({ challenge, code }, channel, destination) {
    const email = channel === NotificationChannel.EMAIL;
    const delivery = await deliver({ purpose: AuthPurpose.REQUEST_TRACKING, municipalityId: challenge.municipality_id, user: {}, code, channel,
      challengeId: challenge.id, expiresAt: challenge.expires_at, email: email ? destination : "", phone: email ? "" : destination });
    await recordTrackingDelivery(challenge.id, delivery);
  }

  // The channels offered depend only on the municipality, so they say nothing about any CPF.
  async function channels(req, res) {
    const municipalityId = req.query?.municipalityId;
    if (!isUuid(municipalityId)) throw authError(400, "Selecione um município válido.");
    res.set("Cache-Control", "no-store").json({ channels: await listChannels(municipalityId) });
  }

  async function start(req, res) {
    const { municipalityId, cpf, channel } = readAccessStartInput(req.body);
    // Every limit is keyed on what the caller typed, never on what exists, so limited answers look alike.
    const scope = { purpose: "access-start", audience: "request-access", municipalityId, identifier: cpf, ip: req.ip };
    if (!await allowAuthAttempt(scope, { limit: 5 })) throw limited();
    if (!(await listChannels(municipalityId)).includes(channel)) throw authError(400, "Escolha um canal disponível para receber o código.");
    if (!await consumeAuthLimit(["access-cpf", municipalityId, cpf], { limit: 5, seconds: 3600 })) throw limited();
    if (!await consumeAuthLimit(["access-send", municipalityId, channel, cpf], { limit: 1, seconds: AUTH_RETRY_SECONDS })) throw limited();
    let challengeId = randomUUID();
    const storedChannel = contactChannel(channel);
    for await (const request of accessRequestsByCpf(municipalityId, cpf)) {
      const destination = accessDestination(request, channel);
      if (!destination) continue;
      const contact = accessContactDigest(storedChannel, destination);
      const pending = await withAuthTransaction((client) => createTrackingChallenge(client, { request, channel: storedChannel, cpf, contact }));
      challengeId = pending.challenge.id;
      schedule(() => sendCode(pending, channel, destination));
      break;
    }
    res.set("Cache-Control", "no-store").json({ ok: true, challengeId, expiresIn: AUTH_CHALLENGE_SECONDS, retryAfter: AUTH_RETRY_SECONDS });
  }

  async function confirm(req, res) {
    const challengeId = req.params.id;
    const code = req.body?.code;
    const cpf = readAccessCpf(req.body?.cpf);
    if (!isUuid(challengeId) || !ACCESS_CODE_PATTERN.test(String(code ?? "")) || !cpf) throw invalidCode();
    // Keyed on the id the caller sent, so a guessed id is limited exactly like a real one.
    const scope = { purpose: "access-confirm", audience: "request-access", municipalityId: "", identifier: challengeId, ip: req.ip };
    if (!await allowAuthAttempt(scope, { limit: 10 })) throw limited();
    const candidate = await findTrackingChallenge(challengeId);
    if (!candidate) throw invalidCode();
    if (!await consumeAuthLimit(["access-confirm-request", candidate.request_id], { limit: 10, seconds: 600 })) throw invalidCode();
    const granted = await withAuthTransaction(async (client) => {
      const challenge = await findTrackingChallenge(candidate.id, client, true);
      const request = challenge ? await findAccessRequest(challenge.request_id, challenge.municipality_id, client) : null;
      const channel = challenge?.channel;
      const contact = accessContactDigest(channel, accessDestination(request, channel));
      const valid = await consumeTrackingChallenge(client, { challenge, cpf, contact, code: sameCpf(request?.cpf, cpf) ? code : "" });
      if (!valid) return null;
      await strictAuthAudit(client, { userId: null, municipalityId: request.municipality_id, action: AUDIT_ACTIONS.REQUEST_ACCESS_GRANTED,
        changes: { channel: challenge.channel }, entityType: "request", entityId: request.id });
      return { request, channel, contact };
    });
    if (!granted) throw invalidCode();
    const { request, channel, contact } = granted;
    const token = createAccessToken({ requestId: request.id, municipalityId: request.municipality_id, channel, contact, cpfDigest: accessCpfDigest(cpf) });
    res.set("Cache-Control", "no-store").json({ token, expiresIn: REQUEST_ACCESS_TOKEN_SECONDS });
  }

  async function view(req, res) {
    const { anchor, cpf, requests } = await openedRequests(req.access);
    const exists = Boolean(anchor.tutor_id) || requests.some((request) => request.tutor_id) || await tutorAccountExists(anchor.municipality_id, cpf);
    res.set("Cache-Control", "no-store").json({ requests: requests.map(buildAccessView), account: { exists } });
  }

  // The tutor's account is born here, on the first access, from the request the code was sent for; the requests the page showed go
  // to it.
  async function createPassword(req, res) {
    const password = req.body?.password;
    const issue = validateNewPassword(password);
    if (issue) throw authError(400, issue);
    if (!await consumeAuthLimit(["access-password", req.access.requestId], { limit: 5, seconds: 600 })) throw limited();
    const passwordHash = await bcrypt.hash(password, 10);
    const { channel } = req.access;
    const user = await withAuthTransaction(async (client) => {
      const { anchor: request, cpf, requests } = await openedRequests(req.access, client, true);
      if (request.tutor_id || await tutorAccountExists(request.municipality_id, cpf, client)) {
        throw authError(409, "Este CPF já tem acesso. Entre com seu CPF e sua senha.");
      }
      const name = String(request.tutor_name || "").trim().slice(0, 160);
      if (name.length < 2) throw authError(422, "Não foi possível criar o acesso com os dados desta solicitação. Procure o atendimento.");
      const email = channel === NotificationChannel.EMAIL;
      const userId = await insertTutorAccount(client, {
        request, name, cpf, passwordHash, email: normalizeAuthEmail(request.tutor_email), phone: normalizeAuthPhone(request.phone),
        verified: { email, phone: !email },
      });
      let linkedAnimals = 0;
      const linkedRequests = [];
      for (const item of requests) {
        const current = item.id === request.id ? request : await findAccessRequest(item.id, request.municipality_id, client, true);
        if (!matchesAccess(current, req.access) || current.tutor_id) continue;
        linkedAnimals += await linkAccessRequest(client, { request: current, userId });
        linkedRequests.push(current.id);
      }
      await strictAuthAudit(client, { userId, municipalityId: request.municipality_id, action: AUDIT_ACTIONS.TUTOR_ACCOUNT_CREATED,
        changes: { requestId: request.id, linkedRequests, confirmedChannel: channel, linkedAnimals } });
      return findAuthUser(userId, client);
    });
    res.status(201).set("Cache-Control", "no-store").json(issueSession(user));
  }

  return { channels, start, confirm, view, createPassword };
}
