import { DeliveryCode, DeliveryStatus } from "../../../shared/notification-contract.js";
import { validateSmsToken } from "../../../shared/sms-contract.js";
import { deliveryFailure } from "./notifications/delivery-result.js";

const BASE_URL = "https://smsmais.com";
const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 32768;
const failure = (code) => deliveryFailure(DeliveryStatus.FAILED, code);
const invalidResponse = () => Object.assign(new Error("Invalid provider response"), { code: DeliveryCode.INVALID_RESPONSE });

export function normalizeSmsPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const local = digits.startsWith("55") && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
  return /^[1-9]\d\d{8,9}$/.test(local) ? `55${local}` : "";
}

async function readJson(response) {
  if (Number(response.headers?.get("content-length")) > MAX_RESPONSE_BYTES) throw invalidResponse();
  let content;
  if (response.body?.getReader) {
    const reader = response.body.getReader(); const chunks = []; let length = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); throw invalidResponse(); }
        chunks.push(Buffer.from(part.value));
      }
    } finally { reader.releaseLock(); }
    content = Buffer.concat(chunks).toString("utf8");
  } else {
    content = await response.text();
    if (Buffer.byteLength(content, "utf8") > MAX_RESPONSE_BYTES) throw invalidResponse();
  }
  try { return JSON.parse(content); } catch { throw invalidResponse(); }
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
      : controller.signal.aborted || error.code === DeliveryCode.TIMEOUT ? DeliveryCode.TIMEOUT : DeliveryCode.TRANSPORT_FAILED) };
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

export async function sendSmsCode({ token, phone, code, challengeId, expiresAt }, options = {}) {
  const to = normalizeSmsPhone(phone); const now = options.now ? options.now() : new Date();
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  if (!to) return failure(DeliveryCode.INVALID_RECIPIENT);
  if (!/^\d{6}$/.test(code || "") || typeof challengeId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId)
    || !Number.isFinite(remaining) || remaining <= 0) return failure(DeliveryCode.PREPARATION_FAILED);
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  const message = `CastraGestao: seu codigo e ${code}. Valido por ${minutes} minutos. Nao compartilhe este codigo.`;
  if (message.length > 160 || token?.startsWith("sbx_")) return failure(DeliveryCode.NOT_CONFIGURED);
  const result = await providerRequest("/send", token, { messages: [{ id: challengeId, destinations: [{ to }], msg: message }] },
    { ...options, timeoutMs: Math.min(options.timeoutMs || TIMEOUT_MS, remaining) });
  if (!result.ok) return { status: result.status, code: result.code, reason: result.reason };
  const item = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : null;
  if (!item || !/^[1-9]\d*$/.test(String(item.id)) || item.externalId !== challengeId || item.to !== to || item.msg !== message
    || (item.schedule != null && item.schedule !== "") || item.error || item.sandbox || item.simulated || item.held
    || [item.status, item.state].some((value) => value != null && !["sent", "accepted"].includes(String(value).toLowerCase()))) {
    return failure(DeliveryCode.INVALID_RESPONSE);
  }
  return { status: DeliveryStatus.SENT, providerMessageId: String(item.id), reference: challengeId };
}
