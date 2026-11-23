import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSmsPhone, sendSmsMessage } from "../src/services/smsmais.js";
import { DeliveryCode, DeliveryStatus } from "../../shared/notification-contract.js";
import { SMS_MAX_LENGTH } from "../../shared/sms-messages-contract.js";

const ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-13T12:00:00Z");
const TEXT = "Test Town: seu código é 123456. Válido por 10 minutos. Não compartilhe.";
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

test("a notice has no expiry and is sent under the id it was given, with any clean text up to the limit, accents included", async () => {
  const { expiresAt, ...notice } = input;
  const text = "Test Town: castração agendada em 20/11/2026, às 09:00 na Unidade Veterinária Municipal. Protocolo: 123/2026.";
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

test("provider failures are finite and sanitized, never retried", async () => {
  for (const [status, code] of [[401, DeliveryCode.INVALID_CREDENTIALS], [402, DeliveryCode.INSUFFICIENT_BALANCE],
    [422, DeliveryCode.PROVIDER_REJECTED], [429, DeliveryCode.RATE_LIMITED], [503, DeliveryCode.TRANSPORT_FAILED]]) {
    let calls = 0;
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: async () => { calls += 1; return json({ token: input.token, private: "provider secret" }, status); } });
    assert.equal(result.status, DeliveryStatus.FAILED); assert.equal(result.code, code); assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes(input.token), false);
  }
});

const answer = (override) => async (_url, options) => {
  const message = JSON.parse(options.body).messages[0];
  return json(typeof override === "function" ? override(message) : [{ id: 1, externalId: message.id, to: message.destinations[0].to, msg: message.msg, schedule: "", ...override }]);
};

test("an answer that is not for this message cannot count as accepted, and says which field is wrong without any text, number or token", async () => {
  const cases = [
    [() => [], "a lista veio com 0 item(ns)"],
    [() => ({ success: true }), "a resposta não é uma lista"],
    [() => [1], "id ausente ou inválido"],
    [{ id: 0 }, "id ausente ou inválido"],
    [{ externalId: "other" }, `externalId: enviado com ${ID.length} caracteres, devolvido com 5 caracteres`],
    [{ externalId: null }, `externalId: enviado com ${ID.length} caracteres, devolvido ausente`],
    [{ to: "554800000000" }, "to: enviado com 13 dígitos, devolvido com 12 dígitos"],
    [{ msg: "Another text than the one sent." }, `msg: enviado com ${TEXT.length} caracteres, devolvido com 31 caracteres`],
    [{ status: "held_no_balance" }, "status: held_no_balance"],
    [{ status: "optout" }, "status: optout"],
    [{ state: "Not Sent!" }, "status: valor fora do esperado"],
    [{ held: true }, "held: presente"], [{ simulated: true }, "simulated: presente"], [{ sandbox: true }, "sandbox: presente"], [{ error: "opt_out" }, "error: presente"],
    [{ schedule: "2026-11-14T12:00:00Z" }, "schedule: marcada para depois"],
    [{ schedule: "2026-11-13 09:30:00" }, "schedule: marcada para depois"],
    [{ schedule: "not a date" }, "schedule: marcada para depois"],
  ];
  for (const [override, detail] of cases) {
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: answer(override) });
    assert.equal(result.status, DeliveryStatus.FAILED, detail); assert.equal(result.code, DeliveryCode.INVALID_RESPONSE, detail);
    assert.equal(result.detail, detail);
    assert.doesNotMatch(JSON.stringify(result), /123456|99999|production-token|Test Town/, detail);
  }
  for (const [content, detail] of [["invalid JSON", "a resposta não é um JSON válido"], ["x".repeat(32769), "a resposta é grande demais"]]) {
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: async () => new Response(content) });
    assert.equal(result.code, DeliveryCode.INVALID_RESPONSE); assert.equal(result.detail, detail);
  }
});

test("a message the provider queued is accepted, even when it echoes the moment it took the message or a zero date as the schedule", async () => {
  for (const extra of [{ status: "queued" }, { state: "Sent" }, { status: "ACCEPTED" }, { schedule: "2026-11-13 09:00:00" }, { schedule: "2026-11-13 09:04:00" },
    { schedule: "2026-11-13T12:00:00Z" }, { schedule: "0000-00-00 00:00:00" }, { schedule: null }, { nome: "" }]) {
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: answer(extra) });
    assert.deepEqual(result, { status: DeliveryStatus.SENT, providerMessageId: "1", reference: ID }, JSON.stringify(extra));
  }
});

test("the phone is written the way the provider wants: 55, DDD and nine digits, with the 9 added to an old eight-digit mobile and no landline", () => {
  for (const [typed, expected] of [["(48) 99999-1234", "5548999991234"], ["48999991234", "5548999991234"], ["+55 48 99999-1234", "5548999991234"], ["5548999991234", "5548999991234"],
    ["48 9999-0000", "5548999990000"], ["(48) 8999-0000", "5548989990000"], ["(11) 7999-0000", "5511979990000"], ["554899990000", "5548999990000"],
    ["(55) 99999-1234", "5555999991234"], ["(55) 9999-0000", "5555999990000"]]) assert.equal(normalizeSmsPhone(typed), expected, typed);
  for (const typed of ["(48) 3333-4444", "(48) 2123-4567", "(00) 99999-1234", "(10) 99999-1234", "(48) 89999-1234", "123", "", "abc", "489999999999", null, undefined]) {
    assert.equal(normalizeSmsPhone(typed), "", String(typed));
  }
});

test("HTTP errors abort the fetch lifecycle even when the provider leaves its response stream open", async () => {
  let signal;
  let reads = 0;
  const response = new Response(new ReadableStream({ pull() { reads += 1; } }), { status: 503 });
  try {
    const result = await sendSmsMessage(input, { now: () => NOW, fetchImpl: async (_url, options) => { signal = options.signal; return response; } });
    assert.equal(result.code, DeliveryCode.TRANSPORT_FAILED);
    assert.equal(signal.aborted, true, "The completed error request must release its network resources");
    assert.equal(response.body.locked, false);
    assert.ok(reads <= 1, "An error body is never parsed or buffered");
  } finally { await response.body.cancel(); }
});

test("sandbox, expired codes, invalid destination, id or text never call the provider", async () => {
  const overrides = [{ token: "sbx_test-token" }, { expiresAt: NOW.toISOString() }, { phone: "123" }, { messageId: "not-a-uuid" }, { messageId: undefined },
    { text: "" }, { text: undefined }, { text: "x".repeat(SMS_MAX_LENGTH + 1) }, { text: "emoji 😀 no texto" }, { text: "Line one" + String.fromCharCode(10) + "line two" }];
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
