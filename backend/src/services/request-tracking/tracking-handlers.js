import { randomUUID } from "node:crypto";
import { AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { TRACKING_CODE_PATTERN, TRACKING_TOKEN_SECONDS } from "../../../../shared/request-tracking-contract.js";
import { allowAuthAttempt, consumeAuthLimit } from "../../repositories/auth-limits.js";
import { withAuthTransaction } from "../../repositories/auth-users.js";
import {
  consumeTrackingChallenge, createTrackingChallenge, findTrackableRequest, findTrackedRequest, findTrackingChallenge, isUuid, recordTrackingDelivery,
} from "../../repositories/request-tracking.js";
import { authError } from "../auth/auth-security.js";
import { deliverAuthMessage } from "../auth/auth-message-delivery.js";
import { followUpDestination, readStartInput, sameContact } from "./tracking-input.js";
import { createTrackingToken, readTrackingToken } from "./tracking-token.js";
import { buildTrackingView } from "./tracking-view.js";

const invalidCode = () => authError(400, "Código inválido ou expirado. Solicite um novo código.");
const limited = () => Object.assign(authError(429, "Aguarde para tentar novamente."), { retryAfter: AUTH_RETRY_SECONDS });

// Delivery runs after the response, so neither timing nor delivery results reveal whether a request exists.
function runInBackground(task) { task().catch(() => {}); }

export function requireTrackingToken(req, _res, next) {
  const header = req.get("authorization") || "";
  const claims = header.startsWith("Bearer ") ? readTrackingToken(header.slice(7).trim()) : null;
  if (!claims) return next(authError(401, "Acompanhamento expirado. Solicite um novo código."));
  req.tracking = claims;
  return next();
}

export function createTrackingHandlers({ deliver = deliverAuthMessage, schedule = runInBackground } = {}) {
  async function sendCode({ challenge, code }, input) {
    const delivery = await deliver({ purpose: AuthPurpose.REQUEST_TRACKING, municipalityId: challenge.municipality_id, user: {}, code,
      email: input.channel === NotificationChannel.EMAIL ? input.value : "",
      phone: input.channel !== NotificationChannel.EMAIL ? input.value : "" });
    await recordTrackingDelivery(challenge.id, delivery);
  }

  async function start(req, res) {
    const input = readStartInput(req.body);
    const { municipalityId, protocol } = input;
    // Every limit is keyed on what the caller typed, never on what exists, so limited answers look alike.
    const scope = { purpose: "tracking-start", audience: "tracking", municipalityId, identifier: protocol, ip: req.ip };
    if (!await allowAuthAttempt(scope, { limit: 5 })) throw limited();
    if (!await consumeAuthLimit(["tracking-contact", municipalityId, input.value], { limit: 5, seconds: 3600 })) throw limited();
    if (!await consumeAuthLimit(["tracking-send", municipalityId, protocol, input.value], { limit: 1, seconds: AUTH_RETRY_SECONDS })) throw limited();
    const request = await findTrackableRequest(municipalityId, protocol);
    let challengeId = randomUUID();
    if (request && sameContact(followUpDestination(request.follow_up, input.channel), input.value)) {
      const pending = await withAuthTransaction((client) => createTrackingChallenge(client, { request, channel: input.channel }));
      challengeId = pending.challenge.id;
      schedule(() => sendCode(pending, input));
    }
    res.set("Cache-Control", "no-store").json({ ok: true, challengeId, expiresIn: AUTH_CHALLENGE_SECONDS, retryAfter: AUTH_RETRY_SECONDS });
  }

  async function confirm(req, res) {
    const challengeId = req.params.id;
    const code = req.body?.code;
    if (!isUuid(challengeId) || !TRACKING_CODE_PATTERN.test(String(code ?? ""))) throw invalidCode();
    // Keyed on the id the caller sent, so a guessed id is limited exactly like a real one.
    const scope = { purpose: "tracking-confirm", audience: "tracking", municipalityId: "", identifier: challengeId, ip: req.ip };
    if (!await allowAuthAttempt(scope, { limit: 10 })) throw limited();
    const candidate = await findTrackingChallenge(challengeId);
    if (!candidate) throw invalidCode();
    if (!await consumeAuthLimit(["tracking-confirm-request", candidate.request_id], { limit: 10, seconds: 600 })) throw invalidCode();
    const valid = await withAuthTransaction(async (client) => {
      const challenge = await findTrackingChallenge(candidate.id, client, true);
      return consumeTrackingChallenge(client, { challenge, code });
    });
    if (!valid) throw invalidCode();
    const token = createTrackingToken({ requestId: candidate.request_id, municipalityId: candidate.municipality_id });
    res.set("Cache-Control", "no-store").json({ token, expiresIn: TRACKING_TOKEN_SECONDS });
  }

  async function view(req, res) {
    const row = await findTrackedRequest(req.tracking.requestId, req.tracking.municipalityId);
    if (!row) throw authError(404, "Solicitação indisponível.");
    res.set("Cache-Control", "no-store").json({ request: buildTrackingView(row) });
  }

  return { start, confirm, view };
}
