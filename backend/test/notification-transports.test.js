import test from "node:test";
import assert from "node:assert/strict";
import { createEmailSender, sendNotificationEmail } from "../src/services/email.js";
import { sendWhatsappTemplateComponents } from "../src/services/whatsapp.js";
import { buildBodyComponents } from "../src/services/notifications/whatsapp-template-parameters.js";
import { DeliveryStatus, DeliveryCode, NotificationEvent } from "../../shared/notification-contract.js";
import { clearServerCredentials, TEST_EMAIL_CREDENTIALS, useServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();

const emailAccount = { serviceId: "test-service", publicKey: "test-public", privateKey: "test-private" };
const loadAccount = async () => emailAccount;
const emailInput = { toEmail: "citizen@example.com", templateId: "notice-template", templateParams: { protocol: "1/2026" } };

test("EmailJS uses an explicit notification template and sanitizes content", async () => {
  const sender = createEmailSender({ loadAccount, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.template_id, "notice-template");
    assert.equal(body.template_params.protocol, "1/2026");
    assert.equal(body.template_params.to_email, "citizen@example.com");
    assert.equal(body.template_params.codigo_recuperacao, undefined);
    assert.equal(JSON.stringify(body.template_params).includes("secret-key"), false);
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true };
  } });
  const result = await sendNotificationEmail({ toEmail: emailInput.toEmail, templateId: emailInput.templateId, event: NotificationEvent.COMPLETED,
    request: { protocol: "1/2026", internal_token: "secret-key", documents: [{ message: "private reason" }] } }, sender);
  assert.equal(result.status, DeliveryStatus.SENT);
});

test("agenda notification content contains readable date, slot and location", async () => {
  await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event: NotificationEvent.SCHEDULE_CHANGED,
    request: { protocol: "1/2026", schedule_date: "2026-11-20", schedule_location_name: "Centro", schedule_address: "Rua A", workflow_data: { scheduleSlotTime: "09:15" } },
  }, async ({ templateParams }) => {
    assert.match(templateParams.message, /20\/11\/2026/);
    assert.match(templateParams.message, /09:15/);
    assert.match(templateParams.message, /Centro/);
    assert.match(templateParams.message, /em Centro\. Protocolo: 1\/2026\./);
    assert.equal(templateParams.schedule_address, "Rua A", "the address still reaches the template as its own variable");
    return { status: DeliveryStatus.SENT };
  });
});

test("EmailJS gate reserves at most one next slot with a bounded wait", async () => {
  let timestamp = 1000;
  let sent = 0;
  const delays = [];
  const sender = createEmailSender({ loadAccount, now: () => timestamp,
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
  const sender = createEmailSender({ loadAccount: async () => ({}), fetchImpl: async () => { assert.fail("provider must not be contacted"); } });
  assert.equal((await sender(emailInput)).status, DeliveryStatus.SKIPPED);
  const configured = createEmailSender({ loadAccount, fetchImpl: async () => { assert.fail("provider must not be contacted"); } });
  assert.equal((await configured({ ...emailInput, templateId: "" })).status, DeliveryStatus.SKIPPED);
});

test("email errors and rate limits never return raw provider bodies", async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 429, text: async () => "secret" }), async () => ({ ok: false, status: 500, text: async () => "secret" }), async () => { throw new Error("secret"); }]) {
    const sender = createEmailSender({ loadAccount, fetchImpl });
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
    const sender = createEmailSender({ loadAccount, fetchImpl });
    assert.equal((await sender(emailInput)).code, expected);
  }
});

test("every notice carries its full text, the new subject and, for the no-show, the date of the missed visit", async () => {
  const request = { protocol: "1/2026", schedule_date: "2026-11-20", schedule_location_name: "Centro", workflow_data: { scheduleTime: "09:15" } };
  const expected = {
    [NotificationEvent.SCHEDULE_CONFIRMED]: ["Agendamento confirmado", "Seu agendamento foi confirmado em 20/11/2026, às 09:15, em Centro. Protocolo: 1/2026."],
    [NotificationEvent.NO_SHOW]: ["Não comparecimento", "Registramos não comparecimento no atendimento em 20/11/2026, às 09:15, em Centro. Para mais informações, fale com nossa equipe. Protocolo: 1/2026."],
    [NotificationEvent.COMPLETED]: ["Atendimento concluído", "Seu atendimento foi concluído. Protocolo: 1/2026."],
    [NotificationEvent.REQUEST_REJECTED]: ["Solicitação indeferida", "Sua solicitação foi indeferida. Para mais informações, fale com nossa equipe. Protocolo: 1/2026."],
  };
  for (const [event, [subject, message]] of Object.entries(expected)) {
    await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event, request }, async ({ templateParams }) => {
      assert.equal(templateParams.subject, subject);
      assert.equal(templateParams.message, message);
      assert.equal("documents_result" in templateParams, false, "no notice carries the review of documents");
      return { status: DeliveryStatus.SENT };
    });
  }
});

test("WhatsApp parameters come only from mapped fields and never from CPF, contacts or arbitrary request data", async () => {
  const config = { accessToken: "test-token", phoneNumberId: "test-number", templateName: "confirmation", languageCode: "pt_BR" };
  const components = buildBodyComponents(["protocol", "cpf", "phone", "tutor_name"], {
    phone: "(48) 99999-9999", protocol: "1/2026", cpf: "sensitive-cpf", internal_token: "secret-key", privateData: "sensitive-data",
  });
  const result = await sendWhatsappTemplateComponents(config, "(48) 99999-9999", components, { fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.to, "5548999999999");
    assert.equal(body.template.language.code, "pt_BR");
    assert.deepEqual(body.template.components[0].parameters.map(({ text }) => text), ["1/2026", "não informado", "não informado", "Solicitante"]);
    assert.equal(options.body.includes("sensitive"), false);
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true };
  } });
  assert.deepEqual(result, { status: DeliveryStatus.SENT });
});

test("WhatsApp refuses missing recipient before network and sanitizes network errors", async () => {
  const config = { accessToken: "test-token", phoneNumberId: "test-number", templateName: "confirmation", languageCode: "pt_BR" };
  assert.equal((await sendWhatsappTemplateComponents(config, "123", [], { fetchImpl: async () => assert.fail("no request") })).status, DeliveryStatus.SKIPPED);
  const result = await sendWhatsappTemplateComponents(config, "48999999999", [], { fetchImpl: async () => { throw new Error("secret-token private-number"); } });
  assert.equal(result.status, DeliveryStatus.FAILED);
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
});

test("WhatsApp maps provider template errors to a safe code and reports the template status", async () => {
  const config = { accessToken: "test-token", phoneNumberId: "test-number", templateName: "confirmation", languageCode: "pt_BR" };
  for (const [code, templateStatus] of [[132015, "PAUSED"], [132016, "DISABLED"], [132001, "NOT_FOUND"], [132000, ""]]) {
    const result = await sendWhatsappTemplateComponents(config, "48999999999", [], {
      fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { code, message: "private-provider-details" } }) }),
    });
    assert.equal(result.status, DeliveryStatus.FAILED);
    assert.equal(result.code, DeliveryCode.TEMPLATE_UNAVAILABLE);
    assert.equal(result.templateStatus, templateStatus);
    assert.equal(JSON.stringify(result).includes("private-provider-details"), false);
  }
  const other = await sendWhatsappTemplateComponents(config, "48999999999", [], {
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 100 } }) }),
  });
  assert.equal(other.code, DeliveryCode.PROVIDER_REJECTED);
  assert.equal(other.templateStatus, undefined);
});

test("EmailJS sends with the account of the server's variables, always with the private key", async (t) => {
  const bodies = [];
  const fetchImpl = async (_url, options) => { bodies.push(JSON.parse(options.body)); return { ok: true }; };
  await createEmailSender({ loadAccount, fetchImpl })(emailInput);
  useServerCredentials(t, { ...TEST_EMAIL_CREDENTIALS, EMAILJS_SERVICE_ID: "env-service" });
  await createEmailSender({ fetchImpl })(emailInput);
  assert.deepEqual([bodies[0].service_id, bodies[0].user_id, bodies[0].accessToken], ["test-service", "test-public", "test-private"]);
  assert.deepEqual([bodies[1].service_id, bodies[1].user_id, bodies[1].accessToken], ["env-service", "test-public", "test-private"]);
});

test("an incomplete account, the private key included, never reaches the provider", async () => {
  const fetchImpl = async () => assert.fail("provider must not be contacted");
  for (const name of Object.keys(emailAccount)) {
    const result = await createEmailSender({ loadAccount: async () => ({ ...emailAccount, [name]: "" }), fetchImpl })(emailInput);
    assert.equal(result.status, DeliveryStatus.SKIPPED);
    assert.equal(result.code, DeliveryCode.NOT_CONFIGURED);
  }
  assert.equal((await createEmailSender({ fetchImpl })(emailInput)).code, DeliveryCode.NOT_CONFIGURED, "no account in the server's variables");
});

test("agenda notices carry date, time and place as separate variables next to the municipality identity", async () => {
  const request = { protocol: "1/2026", tutor_name: "Maria", schedule_date: "2026-11-20", schedule_location_name: "Centro", schedule_address: "Rua A",
    workflow_data: { scheduleSlotTime: "09:15" } };
  const identityParams = { municipality_name: "Test Town", municipality_brasao_url: "https://system.example.test/brasao" };
  await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event: NotificationEvent.SCHEDULE_CONFIRMED, request, identityParams },
    async ({ templateParams }) => {
      assert.equal(templateParams.schedule_date, "20/11/2026");
      assert.equal(templateParams.schedule_time, "09:15");
      assert.equal(templateParams.schedule_location_name, "Centro");
      assert.equal(templateParams.schedule_address, "Rua A");
      assert.equal(templateParams.municipality_name, "Test Town");
      assert.equal(templateParams.municipality_brasao_url, "https://system.example.test/brasao");
      assert.equal(templateParams.protocol, "1/2026");
      assert.equal(templateParams.event, NotificationEvent.SCHEDULE_CONFIRMED);
      return { status: DeliveryStatus.SENT };
    });
  await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event: NotificationEvent.COMPLETED, request },
    async ({ templateParams }) => {
      assert.equal(Object.hasOwn(templateParams, "schedule_date"), false);
      assert.equal(templateParams.to_name, "Solicitante");
      return { status: DeliveryStatus.SENT };
    });
});

test("the rejection e-mail tells the reason the staff chose and nothing of the internal note", async () => {
  const request = { protocol: "1/2026", workflow_data: { rejectionReason: "Fora da área de atendimento", rejectionNote: "private staff note" } };
  await sendNotificationEmail({ toEmail: "citizen@example.com", templateId: "notice", event: NotificationEvent.REQUEST_REJECTED, request }, async ({ templateParams }) => {
    assert.equal(templateParams.subject, "Solicitação indeferida");
    assert.equal(templateParams.message, "Sua solicitação foi indeferida. Motivo: Fora da área de atendimento. Para mais informações, fale com nossa equipe. Protocolo: 1/2026.");
    assert.doesNotMatch(JSON.stringify(templateParams), /private staff note/);
    return { status: DeliveryStatus.SENT };
  });
});
