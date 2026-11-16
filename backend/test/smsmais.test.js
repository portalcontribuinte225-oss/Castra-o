import test from "node:test";
import assert from "node:assert/strict";
import { querySmsBalance, sendSmsMessage } from "../src/services/smsmais.js";
import { DeliveryCode, DeliveryStatus } from "../../shared/notification-contract.js";
import { SMS_MAX_LENGTH } from "../../shared/sms-messages-contract.js";

const ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-13T12:00:00Z");
const TEXT = "Test Town: seu codigo e 123456. Valido por 10 minutos. Nao compartilhe.";
const input = { token: "production-token-test", phone: "(48) 99999-1234", text: TEXT, messageId: ID, expiresAt: "2026-11-13T12:10:00Z" };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("SMSMais uses one fixed-origin POST message, bearer header and message reference; result contains no text or contact", async () => {
  let call;
  const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: async (url, options) => {
    call = { url, options }; const message = JSON.parse(options.body).messages[0];
    return json([{ id: 98765, to: message.destinations[0].to, externalId: message.id, msg: message.msg, schedule: "" }]);
  } });
  assert.equal(call.url, "https://smsmais.com/send"); assert.equal(call.options.method, "POST"); assert.equal(call.options.redirect, "error");
  assert.equal(call.options.headers.Authorization, `Bearer ${input.token}`);
  const payload = JSON.parse(call.options.body); assert.equal(payload.messages.length, 1); assert.equal(payload.messages[0].destinations.length, 1);
  assert.equal(payload.messages[0].destinations[0].to, "5548999991234"); assert.equal(payload.messages[0].id, ID);
  assert.equal(payload.messages[0].msg, TEXT); assert.equal(payload.messages[0].schedule, undefined);
  assert.deepEqual(result, { status: DeliveryStatus.SENT, providerMessageId: "98765", reference: ID });
  assert.equal(JSON.stringify(result).includes("123456"), false); assert.equal(JSON.stringify(result).includes("99999"), false);
});

test("a notice has no expiry and is sent under the id it was given, with any plain text up to the limit", async () => {
  const { expiresAt, ...notice } = input;
  const text = "Test Town: castracao agendada em 20/11/2026 as 09:00, Unidade Veterinaria Municipal. Protocolo 123/2026.";
  let sent;
  const result = await sendSmsMessage({ ...notice, text }, { now: () => NOW, fetchImpl: async (_url, options) => {
    sent = JSON.parse(options.body).messages[0];
    return json([{ id: 7, externalId: sent.id, to: sent.destinations[0].to, msg: sent.msg, schedule: "" }]);
  } });
  assert.equal(result.status, DeliveryStatus.SENT); assert.equal(sent.msg, text); assert.equal(sent.id, ID);
  const longest = "x".repeat(SMS_MAX_LENGTH);
  assert.equal((await sendSmsMessage({ ...notice, text: longest }, { now: () => NOW, fetchImpl: async (_url, options) => {
    const message = JSON.parse(options.body).messages[0];
    return json([{ id: 8, externalId: message.id, to: message.destinations[0].to, msg: message.msg, schedule: "" }]);
  } })).status, DeliveryStatus.SENT);
});

test("balance requires the official success envelope, accepts zero and projects no financial history", async () => {
  let url;
  const valid = await querySmsBalance(input.token, { fetchImpl: async (target) => { url = target; return json({ success: true, data: { saldo: 0, sms_equivalente: 0, total_recargas: 1000, token: input.token } }); } });
  assert.equal(url, "https://smsmais.com/saldo"); assert.deepEqual(valid, { valid: true, balance: { credits: 0, sms: 0 } });
  for (const body of [{ success: false, data: { saldo: 0, sms_equivalente: 0 } }, { saldo: 1 }, { success: true, data: { saldo: "1", sms_equivalente: 1 } }]) {
    assert.equal((await querySmsBalance(input.token, { fetchImpl: async () => json(body) })).valid, false);
  }
});

test("provider failures are finite and sanitized, never retried", async () => {
  for (const [status, code] of [[401, DeliveryCode.INVALID_CREDENTIALS], [402, DeliveryCode.INSUFFICIENT_BALANCE],
    [422, DeliveryCode.PROVIDER_REJECTED], [429, DeliveryCode.RATE_LIMITED], [503, DeliveryCode.TRANSPORT_FAILED]]) {
    let calls = 0;
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: async () => { calls += 1; return json({ token: input.token, private: "provider secret" }, status); } });
    assert.equal(result.status, DeliveryStatus.FAILED); assert.equal(result.code, code); assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes(input.token), false);
  }
});

test("empty opt-out, malformed, retained, simulated or unrelated HTTP200 responses cannot count as an accepted message", async () => {
  const blocked = [{ externalId: "other" }, { status: "held_no_balance" }, { state: "queued" }, { held: true },
    { simulated: true }, { sandbox: true }, { error: "opt_out" }, { schedule: "2026-11-14T12:00:00Z" },
    { msg: "Another text than the one sent." }, { to: "5548000000000" }];
  for (const override of [null, ...blocked]) {
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: async (_url, options) => {
      const message = JSON.parse(options.body).messages[0];
      return json(override === null ? [] : [{ id: 1, externalId: message.id, to: message.destinations[0].to,
        msg: message.msg, schedule: "", ...override }]);
    } });
    assert.equal(result.code, DeliveryCode.INVALID_RESPONSE);
  }
  for (const content of ["invalid JSON", "x".repeat(32769)]) {
    assert.equal((await querySmsBalance(input.token, { fetchImpl: async () => new Response(content) })).code, DeliveryCode.INVALID_RESPONSE);
  }
});

test("HTTP errors abort the fetch lifecycle even when the provider leaves its response stream open", async () => {
  let signal;
  let reads = 0;
  const response = new Response(new ReadableStream({ pull() { reads += 1; } }), { status: 503 });
  try {
    const result = await querySmsBalance(input.token, { fetchImpl: async (_url, options) => { signal = options.signal; return response; } });
    assert.equal(result.code, DeliveryCode.TRANSPORT_FAILED);
    assert.equal(signal.aborted, true, "The completed error request must release its network resources");
    assert.equal(response.body.locked, false);
    assert.ok(reads <= 1, "An error body is never parsed or buffered");
  } finally { await response.body.cancel(); }
});

test("sandbox, expired codes, invalid destination, id or text never call the provider", async () => {
  const overrides = [{ token: "sbx_test-token" }, { expiresAt: NOW.toISOString() }, { phone: "123" }, { messageId: "not-a-uuid" }, { messageId: undefined },
    { text: "" }, { text: undefined }, { text: "x".repeat(SMS_MAX_LENGTH + 1) }, { text: "Ação com acento e cedilha" }, { text: "Line one" + String.fromCharCode(10) + "line two" }];
  for (const override of overrides) {
    let calls = 0;
    const result = await sendSmsMessage({ ...input, ...override }, { now: () => NOW, fetchImpl: async () => { calls += 1; throw new Error("Network forbidden"); } });
    assert.notEqual(result.status, DeliveryStatus.SENT); assert.equal(calls, 0, JSON.stringify(override));
  }
});

test("network deadline is bounded even if a test transport ignores abort", async () => {
  let calls = 0;
  const result = await sendSmsMessage(input, { now: () => NOW, timeoutMs: 5, fetchImpl: async () => { calls += 1; await new Promise(() => {}); } });
  assert.equal(result.code, DeliveryCode.TIMEOUT); assert.equal(calls, 1);
});
