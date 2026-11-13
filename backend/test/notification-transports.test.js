import test from "node:test";
import assert from "node:assert/strict";
import { createEmailSender, sendNotificationEmail } from "../src/services/email.js";
import { sendCloudApiTemplate } from "../src/services/whatsapp.js";
import { DeliveryStatus, DeliveryCode, NotificationEvent } from "../../shared/notification-contract.js";

const emailEnv = { EMAILJS_SERVICE_ID: "test-service", EMAILJS_PUBLIC_KEY: "test-public", EMAILJS_PRIVATE_KEY: "test-private" };
const emailInput = { toEmail: "citizen@example.com", templateId: "notice-template", templateParams: { protocol: "1/2026" } };

test("EmailJS uses an explicit notification template and sanitizes content", async () => {
  const sender = createEmailSender({ env: emailEnv, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.template_id, "notice-template");
    assert.equal(body.template_params.protocol, "1/2026");
    assert.equal(body.template_params.to_email, "citizen@example.com");
    assert.equal(body.template_params.codigo_recuperacao, undefined);
    assert.equal(JSON.stringify(body.template_params).includes("secret-key"), false);
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true };
  } });
  const result = await sendNotificationEmail({ toEmail: emailInput.toEmail, templateId: emailInput.templateId, event: NotificationEvent.DOCUMENTS_REVIEWED,
    request: { protocol: "1/2026", validation_key: "secret-key", documents: [{ message: "private reason" }] } }, sender);
  assert.equal(result.status, DeliveryStatus.SENT);
});

test("agenda notification content contains readable date, slot and location", async () => {
  await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event: NotificationEvent.SCHEDULE_CHANGED,
    request: { protocol: "1/2026", schedule_date: "2026-11-20", schedule_location_name: "Centro", schedule_address: "Rua A", workflow_data: { scheduleSlotTime: "09:15" } },
  }, async ({ templateParams }) => {
    assert.match(templateParams.message, /20\/11\/2026/);
    assert.match(templateParams.message, /09:15/);
    assert.match(templateParams.message, /Centro/);
    assert.match(templateParams.message, /Rua A/);
    return { status: DeliveryStatus.SENT };
  });
});

test("EmailJS gate reserves at most one next slot with a bounded wait", async () => {
  let timestamp = 1000;
  let sent = 0;
  const delays = [];
  const sender = createEmailSender({ env: emailEnv, now: () => timestamp,
    wait: async (delay) => { delays.push(delay); timestamp += delay; },
    fetchImpl: async () => { sent += 1; return { ok: true }; },
  });
  const results = await Promise.all([sender(emailInput), sender(emailInput), sender(emailInput)]);
  assert.equal(sent, 2);
  assert.deepEqual(results.map(({ status }) => status), [DeliveryStatus.SENT, DeliveryStatus.SENT, DeliveryStatus.FAILED]);
  assert.equal(results[2].code, DeliveryCode.RATE_LIMITED);
  assert.deepEqual(delays, [1000]);
  timestamp += 1000;
  assert.equal((await sender(emailInput)).status, DeliveryStatus.SENT);
  assert.equal(sent, 3);
});

test("missing email credentials/template never call a provider", async () => {
  const sender = createEmailSender({ env: {}, fetchImpl: async () => { assert.fail("provider must not be contacted"); } });
  assert.equal((await sender(emailInput)).status, DeliveryStatus.SKIPPED);
  const configured = createEmailSender({ env: emailEnv, fetchImpl: async () => { assert.fail("provider must not be contacted"); } });
  assert.equal((await configured({ ...emailInput, templateId: "" })).status, DeliveryStatus.SKIPPED);
});

test("email errors and rate limits never return raw provider bodies", async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 429, text: async () => "secret" }), async () => ({ ok: false, status: 500, text: async () => "secret" }), async () => { throw new Error("secret"); }]) {
    const sender = createEmailSender({ env: emailEnv, fetchImpl });
    const result = await sender(emailInput);
    assert.equal(result.status, DeliveryStatus.FAILED);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
});

test("transport failures keep finite diagnostic codes", async () => {
  for (const [fetchImpl, expected] of [
    [async () => ({ ok: false, status: 429 }), DeliveryCode.RATE_LIMITED],
    [async () => ({ ok: false, status: 400 }), DeliveryCode.PROVIDER_REJECTED],
    [async () => { throw new DOMException("private", "TimeoutError"); }, DeliveryCode.TIMEOUT],
    [async () => { throw new Error("private"); }, DeliveryCode.TRANSPORT_FAILED],
  ]) {
    const sender = createEmailSender({ env: emailEnv, fetchImpl });
    assert.equal((await sender(emailInput)).code, expected);
  }
});

test("document notifications report aggregate status without exposing documents", async () => {
  await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event: NotificationEvent.DOCUMENTS_REVIEWED,
    request: { protocol: "1/2026", documents: [
      { status: "approved", fileName: "private-id.pdf" },
      { status: "rejected", message: "sensitive rejection reason", documentId: "personal-id" },
      { status: "attached", dataUrl: "private-content" },
    ] },
  }, async ({ templateParams }) => {
    assert.match(templateParams.message, /Aprovados: 1/);
    assert.match(templateParams.message, /Precisam de correção: 1/);
    assert.doesNotMatch(templateParams.message, /private|sensitive|personal/);
    return { status: DeliveryStatus.SENT };
  });
});

test("WhatsApp templates cannot resolve CPF, contacts, arbitrary fields or legacy validation keys", async () => {
  const config = { accessToken: "test-token", phoneNumberId: "test-number", templateName: "confirmation", templateVariables: ["protocol", "cpf", "validation_key", "phone", "privateData"] };
  const result = await sendCloudApiTemplate(config, {
    phone: "(48) 99999-9999", protocol: "1/2026", cpf: "sensitive-cpf", validation_key: "secret-key", privateData: "sensitive-data",
  }, { fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.to, "5548999999999");
    assert.deepEqual(body.template.components[0].parameters.map(({ text }) => text), ["1/2026", "-", "-", "-", "-"]);
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true };
  } });
  assert.deepEqual(result, { status: DeliveryStatus.SENT });
});

test("WhatsApp refuses missing recipient before network and sanitizes network errors", async () => {
  const config = { accessToken: "test-token", phoneNumberId: "test-number", templateName: "confirmation" };
  assert.equal((await sendCloudApiTemplate(config, { phone: "123" }, { fetchImpl: async () => assert.fail("no request") })).status, DeliveryStatus.SKIPPED);
  const result = await sendCloudApiTemplate(config, { phone: "48999999999" }, { fetchImpl: async () => { throw new Error("secret-token private-number"); } });
  assert.equal(result.status, DeliveryStatus.FAILED);
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
});
