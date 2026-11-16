import { DeliveryCode, DeliveryStatus } from "../../../shared/notification-contract.js";
import { validateSmsToken } from "../../../shared/sms-contract.js";
import { SMS_MAX_LENGTH } from "../../../shared/sms-messages-contract.js";
import { deliveryFailure } from "./notifications/delivery-result.js";

const BASE_URL = "https://smsmais.com";
const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 32768;
const failure = (code) => deliveryFailure(DeliveryStatus.FAILED, code);
// Accepted by the provider: sent, accepted or queued ("accepted and in the queue to be sent", as the provider documents it).
const ACCEPTED_STATUSES = ["sent", "accepted", "queued"];
// The provider may echo the moment it took the message; only a time clearly ahead means it was held for later.
const SCHEDULE_TOLERANCE_MS = 5 * 60 * 1000;
const TOO_LARGE = "a resposta é grande demais";
const invalidResponse = (detail) => Object.assign(new Error("Invalid provider response"), { code: DeliveryCode.INVALID_RESPONSE, detail });

// A Brazilian mobile number: DDI 55 is optional, the DDD is two digits (11 to 99) and the number has nine digits starting with 9. An
// old mobile number written with eight digits (9999-0000) gets the 9 in front; a landline (starts with 2 to 5) cannot receive an SMS.
export function normalizeSmsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const local = digits.startsWith("55") && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
  const mobile = local.length === 10 && /^[1-9][1-9][6-9]/.test(local) ? `${local.slice(0, 2)}9${local.slice(2)}` : local;
  return /^[1-9][1-9]9\d{8}$/.test(mobile) ? `55${mobile}` : "";
}

async function readJson(response) {
  if (Number(response.headers?.get("content-length")) > MAX_RESPONSE_BYTES) throw invalidResponse(TOO_LARGE);
  let content;
  if (response.body?.getReader) {
    const reader = response.body.getReader(); const chunks = []; let length = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); throw invalidResponse(TOO_LARGE); }
        chunks.push(Buffer.from(part.value));
      }
    } finally { reader.releaseLock(); }
    content = Buffer.concat(chunks).toString("utf8");
  } else {
    content = await response.text();
    if (Buffer.byteLength(content, "utf8") > MAX_RESPONSE_BYTES) throw invalidResponse(TOO_LARGE);
  }
  try { return JSON.parse(content); } catch { throw invalidResponse("a resposta não é um JSON válido"); }
}

async function providerRequest(path, token, body, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  if (!token || validateSmsToken(token)) return { ok: false, ...failure(DeliveryCode.INVALID_CREDENTIALS) };
  const controller = new AbortController(); let timer;
  const timedOut = new Promise((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(Object.assign(new Error("Provider timeout"), { code: DeliveryCode.TIMEOUT }));
  }, Math.max(1, Math.min(timeoutMs, TIMEOUT_MS))); });
  try {
    const operation = async () => {
      const response = await fetchImpl(`${BASE_URL}${path}`, { method: body ? "POST" : "GET", redirect: "error",
        signal: controller.signal, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (response.status !== 200) {
        const code = response.status === 401 ? DeliveryCode.INVALID_CREDENTIALS : response.status === 402 ? DeliveryCode.INSUFFICIENT_BALANCE
          : response.status === 429 ? DeliveryCode.RATE_LIMITED : response.status >= 500 ? DeliveryCode.TRANSPORT_FAILED : DeliveryCode.PROVIDER_REJECTED;
        return { ok: false, ...failure(code) };
      }
      return { ok: true, data: await readJson(response) };
    };
    return await Promise.race([operation(), timedOut]);
  } catch (error) {
    return { ok: false, ...failure(error.code === DeliveryCode.INVALID_RESPONSE ? DeliveryCode.INVALID_RESPONSE
      : controller.signal.aborted || error.code === DeliveryCode.TIMEOUT ? DeliveryCode.TIMEOUT : DeliveryCode.TRANSPORT_FAILED),
      ...(error.code === DeliveryCode.INVALID_RESPONSE && error.detail ? { detail: error.detail } : {}) };
  } finally { clearTimeout(timer); controller.abort(); }
}

export async function querySmsBalance(token, options = {}) {
  const result = await providerRequest("/saldo", token, undefined, options);
  if (!result.ok) return { valid: false, code: result.code, reason: result.reason };
  const data = result.data?.data;
  if (result.data?.success !== true || typeof data?.saldo !== "number" || !Number.isFinite(data.saldo)
    || !Number.isSafeInteger(data.sms_equivalente) || data.sms_equivalente < 0) {
    return { valid: false, ...failure(DeliveryCode.INVALID_RESPONSE) };
  }
  return { valid: true, balance: { credits: data.saldo, sms: data.sms_equivalente } };
}

const MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a time clearly ahead of now means the provider held the message for later. It answers in the Brasília time it stores (UTC-3),
// or with an explicit zone; an empty value or a zero date (what a database leaves for "no schedule") means not scheduled.
function heldForLater(schedule, now) {
  const text = String(schedule ?? "").trim();
  if (!text || /^0000-00-00/.test(text)) return false;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text.replace(" ", "T")}-03:00`;
  const time = new Date(zoned).getTime();
  return !Number.isFinite(time) || time - now.getTime() > SCHEDULE_TOLERANCE_MS;
}

// What is wrong with the provider's answer for this message, or "" when it is the answer for it. The words carry no text, number or
// token: only which field and, for a size or the status word, enough to tell a cut or rewritten value from a missing one.
function answerProblem(data, { messageId, to, text }, now) {
  if (!Array.isArray(data)) return "a resposta não é uma lista";
  if (data.length !== 1) return `a lista veio com ${data.length} item(ns)`;
  const item = data[0] && typeof data[0] === "object" ? data[0] : {};
  const sizeOf = (value, unit) => typeof value === "string" ? `devolvido com ${value.length} ${unit}` : "devolvido ausente";
  if (!/^[1-9]\d*$/.test(String(item.id))) return "id ausente ou inválido";
  if (item.externalId !== messageId) return `externalId: enviado com ${messageId.length} caracteres, ${sizeOf(item.externalId, "caracteres")}`;
  if (item.to !== to) return `to: enviado com ${to.length} dígitos, ${sizeOf(item.to, "dígitos")}`;
  if (item.msg !== text) return `msg: enviado com ${text.length} caracteres, ${sizeOf(item.msg, "caracteres")}`;
  if (heldForLater(item.schedule, now)) return "schedule: marcada para depois";
  const flag = ["error", "sandbox", "simulated", "held"].find((name) => item[name]);
  if (flag) return `${flag}: presente`;
  const status = [item.status, item.state].find((value) => value != null && !ACCEPTED_STATUSES.includes(String(value).toLowerCase()));
  if (status !== undefined) return `status: ${/^[A-Za-z_ ]{1,24}$/.test(String(status)) ? status : "valor fora do esperado"}`;
  return "";
}

// Sends one text. The message id is a UUID the provider echoes back, so an answer can be tied to exactly this send. With
// an expiry (a code) the call never outlives it; without one (a notice) only the usual deadline applies. An answer that is not
// the one for this message fails with `detail` saying which field, so the screen of the test can show it.
export async function sendSmsMessage({ token, phone, text, messageId, expiresAt }, options = {}) {
  const to = normalizeSmsPhone(phone); const now = options.now ? options.now() : new Date();
  const remaining = expiresAt === undefined ? Infinity : new Date(expiresAt).getTime() - now.getTime();
  if (!to) return failure(DeliveryCode.INVALID_RECIPIENT);
  if (typeof text !== "string" || !text || text.length > SMS_MAX_LENGTH || !/^[ -~]+$/.test(text) || typeof messageId !== "string"
    || !MESSAGE_ID_PATTERN.test(messageId) || Number.isNaN(remaining) || remaining <= 0) return failure(DeliveryCode.PREPARATION_FAILED);
  if (token?.startsWith("sbx_")) return failure(DeliveryCode.NOT_CONFIGURED);
  const result = await providerRequest("/send", token, { messages: [{ id: messageId, destinations: [{ to }], msg: text }] },
    { ...options, timeoutMs: Math.min(options.timeoutMs || TIMEOUT_MS, remaining) });
  if (!result.ok) return { status: result.status, code: result.code, reason: result.reason, ...(result.detail ? { detail: result.detail } : {}) };
  const problem = answerProblem(result.data, { messageId, to, text }, now);
  if (problem) return { ...failure(DeliveryCode.INVALID_RESPONSE), detail: problem };
  return { status: DeliveryStatus.SENT, providerMessageId: String(result.data[0].id), reference: messageId };
}
