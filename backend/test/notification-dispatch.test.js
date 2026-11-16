import test from "node:test";
import assert from "node:assert/strict";
import { dispatchNotification } from "../src/services/notifications/dispatch-notification.js";
import { buildDefaultNotificationConfig, NotificationEvent, NotificationChannel, DeliveryStatus, DeliveryCode } from "../../shared/notification-contract.js";

function fixture() {
  const calls = [];
  const request = {
    municipality_id: "municipality-a", protocol: "123/2026", phone: "48988888888", tutor_name: "Maria", schedule_date: "2026-11-20",
    schedule_location_name: "Unidade Municipal", workflow_data: { scheduleTime: "09:00", followUp: { enabled: true, email: "citizen@example.com", phone: "48999999999" } },
  };
  const single = buildDefaultNotificationConfig();
  const multi = { ...single, multiChannel: true };
  const active = {
    [NotificationEvent.SCHEDULE_CONFIRMED]: "castracao_confirmacao_agendamento",
    [NotificationEvent.SCHEDULE_CHANGED]: "castracao_reagendamento",
    [NotificationEvent.SCHEDULE_CANCELLED]: "castracao_cancelamento",
  };
  const dependencies = {
    loadWhatsappConfig: async (municipalityId) => { calls.push(["config", municipalityId]); return { active: true, accessToken: "token", phoneNumberId: "number" }; },
    resolveTemplate: async (municipalityId, event) => {
      calls.push(["template", municipalityId, event]);
      return active[event] ? { ok: true, template: { name: active[event], language: "pt_BR" } } : { ok: false, code: DeliveryCode.NOT_CONFIGURED };
    },
    markTemplateStatus: async (...args) => { calls.push(["mark", ...args]); },
    consumeQuota: async (municipalityId) => { calls.push(["quota", municipalityId]); return { allowed: true }; },
    sendWhatsapp: async (settings, phone, components) => { calls.push(["whatsapp", settings, phone, components]); return { status: DeliveryStatus.SENT }; },
    resolveEmailTemplate: async ({ municipalityId, use }) => { calls.push(["emailTemplate", municipalityId, use]); return { ok: true, templateId: `email_${use}` }; },
    loadEmailIdentity: async (municipalityId) => { calls.push(["identity", municipalityId]); return { municipality_name: "Test Town" }; },
    sendEmail: async (body) => { calls.push(["email", body]); return { status: DeliveryStatus.SENT }; },
  };
  return { calls, request, single, multi, active, dependencies };
}

const texts = (components) => components[0].parameters.map(({ text }) => text);
const sent = (event, channel) => ({ event, channel, status: DeliveryStatus.SENT });
const ran = (f, kind) => f.calls.some(([name]) => name === kind);
const SCHEDULE_CONFIRMED = NotificationEvent.SCHEDULE_CONFIRMED;

test("with the option off a notice goes only by e-mail, even with WhatsApp active and a phone informed", async () => {
  const f = fixture();
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.single }, f.dependencies);
  assert.deepEqual(results, [sent(SCHEDULE_CONFIRMED, NotificationChannel.EMAIL)]);
  const email = f.calls.find(([kind]) => kind === "email")[1];
  assert.equal(email.toEmail, "citizen@example.com");
  assert.equal(email.toName, "Maria");
  assert.equal(email.templateId, `email_${SCHEDULE_CONFIRMED}`);
  assert.deepEqual(email.identityParams, { municipality_name: "Test Town" });
  assert.deepEqual(f.calls.find(([kind]) => kind === "emailTemplate"), ["emailTemplate", "municipality-a", SCHEDULE_CONFIRMED]);
  assert.equal(["whatsapp", "quota", "template", "config"].some((kind) => ran(f, kind)), false);
});

test("with the option on the same notice goes by e-mail and then by WhatsApp, one result per channel", async () => {
  const f = fixture();
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
  assert.deepEqual(results, [sent(SCHEDULE_CONFIRMED, NotificationChannel.EMAIL), sent(SCHEDULE_CONFIRMED, NotificationChannel.WHATSAPP)]);
  assert.deepEqual(f.calls.filter(([kind]) => kind === "email" || kind === "whatsapp").map(([kind]) => kind), ["email", "whatsapp"]);
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[2], "48999999999");
  assert.deepEqual(f.calls.find(([kind]) => kind === "quota"), ["quota", "municipality-a"]);
  assert.deepEqual(f.calls.find(([kind]) => kind === "template"), ["template", "municipality-a", SCHEDULE_CONFIRMED]);
});

test("a missing configuration behaves as the option off", async () => {
  const f = fixture();
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: undefined }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(ran(f, "whatsapp"), false);
});

test("confirmation, reschedule and cancellation send the parameters their Meta templates expect", async () => {
  const expected = [
    [NotificationEvent.SCHEDULE_CONFIRMED, "castracao_confirmacao_agendamento", ["Maria", "20/11/2026", "09:00", "Unidade Municipal"]],
    [NotificationEvent.SCHEDULE_CHANGED, "castracao_reagendamento", ["Maria", "20/11/2026", "09:00", "Unidade Municipal"]],
    [NotificationEvent.SCHEDULE_CANCELLED, "castracao_cancelamento", ["Maria", "20/11/2026", "09:00"]],
  ];
  for (const [event, templateName, parameters] of expected) {
    const f = fixture();
    const results = await dispatchNotification({ event, request: f.request, config: f.multi }, f.dependencies);
    assert.equal(results[1].status, DeliveryStatus.SENT);
    const [, settings, , components] = f.calls.find(([kind]) => kind === "whatsapp");
    assert.equal(settings.templateName, templateName);
    assert.equal(settings.languageCode, "pt_BR");
    assert.deepEqual(texts(components), parameters);
  }
});

test("documents reviewed and completed send the protocol and the notice sentence", async () => {
  for (const [event, sentence] of [[NotificationEvent.DOCUMENTS_REVIEWED, /Documentos conferidos/], [NotificationEvent.COMPLETED, /Atendimento concluído/]]) {
    const f = fixture();
    f.active[event] = `castracao_${event}`;
    const results = await dispatchNotification({ event, request: f.request, config: f.multi }, f.dependencies);
    assert.equal(results[1].status, DeliveryStatus.SENT);
    const components = f.calls.find(([kind]) => kind === "whatsapp")[3];
    assert.equal(components[0].parameters.length, 2);
    assert.equal(texts(components)[0], "123/2026");
    assert.match(texts(components)[1], sentence);
  }
});

test("legacy reschedule uses the reschedule template, not the confirmation one", async () => {
  const f = fixture();
  f.request.workflow_data = { scheduleTime: "09:00" };
  await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.single, legacy: true }, f.dependencies);
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[1].templateName, "castracao_reagendamento");
});

test("refusal and missing preference never infer consent from existing contacts", async () => {
  const f = fixture();
  for (const workflow_data of [{ followUp: { enabled: false } }, {}]) {
    assert.deepEqual(await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: { ...f.request, workflow_data }, config: f.multi }, f.dependencies), []);
  }
  assert.deepEqual(f.calls, []);
});

test("an e-mail use that is off or without template is skipped and, with the option off, nothing else is sent", async () => {
  for (const code of [DeliveryCode.CHANNEL_DISABLED, DeliveryCode.NOT_CONFIGURED]) {
    const f = fixture();
    f.dependencies.resolveEmailTemplate = async () => ({ ok: false, code });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.single }, f.dependencies);
    assert.equal(results.length, 1);
    assert.deepEqual([results[0].channel, results[0].status, results[0].code], [NotificationChannel.EMAIL, DeliveryStatus.SKIPPED, code]);
    assert.equal(["email", "whatsapp", "identity"].some((kind) => ran(f, kind)), false);
  }
});

test("with the option on, an e-mail use that is off leaves WhatsApp as the only delivery", async () => {
  const f = fixture();
  f.dependencies.resolveEmailTemplate = async () => ({ ok: false, code: DeliveryCode.CHANNEL_DISABLED });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SKIPPED);
  assert.deepEqual(results[1], sent(SCHEDULE_CONFIRMED, NotificationChannel.WHATSAPP));
  assert.equal(ran(f, "email"), false);
});

test("with the option on, a WhatsApp that cannot send keeps the e-mail result and reports the skip", async () => {
  for (const scenario of ["disabled", "phone", "inactive", "quota"]) {
    const f = fixture();
    const event = scenario === "inactive" ? NotificationEvent.DOCUMENTS_REVIEWED : SCHEDULE_CONFIRMED;
    if (scenario === "disabled") f.dependencies.loadWhatsappConfig = async () => ({ active: false });
    if (scenario === "phone") f.request.workflow_data.followUp.phone = "";
    if (scenario === "quota") f.dependencies.consumeQuota = async () => ({ allowed: false, reason: "private" });
    const results = await dispatchNotification({ event, request: f.request, config: f.multi }, f.dependencies);
    assert.equal(results[0].channel, NotificationChannel.EMAIL);
    assert.equal(results[0].status, DeliveryStatus.SENT);
    assert.equal(results[1].channel, NotificationChannel.WHATSAPP);
    assert.equal(results[1].status, DeliveryStatus.SKIPPED);
    assert.equal(ran(f, "whatsapp"), false);
    if (scenario !== "quota") assert.equal(ran(f, "quota"), false);
  }
});

test("a municipality without its own credentials never sends by WhatsApp, even when the host has WhatsApp variables", async () => {
  const previous = { token: process.env.WHATSAPP_TOKEN, number: process.env.WHATSAPP_PHONE_NUMBER_ID };
  process.env.WHATSAPP_TOKEN = "host-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "host-number";
  try {
    const f = fixture();
    f.dependencies.loadWhatsappConfig = async () => ({ active: true });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
    assert.equal(results[1].code, DeliveryCode.NOT_CONFIGURED);
    assert.equal(ran(f, "whatsapp") || ran(f, "template"), false);
  } finally {
    for (const [key, value] of [["WHATSAPP_TOKEN", previous.token], ["WHATSAPP_PHONE_NUMBER_ID", previous.number]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("an unusable active WhatsApp template is blocked before quota and does not touch the e-mail", async () => {
  const f = fixture();
  f.dependencies.resolveTemplate = async () => ({ ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(results[1].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
  assert.equal(ran(f, "quota") || ran(f, "whatsapp"), false);
});

test("a provider template error is reported safely and updates the cached status", async () => {
  const f = fixture();
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.TEMPLATE_UNAVAILABLE, templateStatus: "PAUSED", reason: "private@example.com token secret" });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(results[1].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
  assert.deepEqual(f.calls.find(([kind]) => kind === "mark"), ["mark", "municipality-a", "castracao_confirmacao_agendamento", "pt_BR", "PAUSED"]);
  assert.equal(JSON.stringify(results).includes("secret"), false);
  f.dependencies.markTemplateStatus = async () => { throw new Error("cache secret"); };
  const again = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
  assert.equal(again[0].status, DeliveryStatus.SENT);
});

test("a failing channel never stops the other and provider errors are never disclosed", async () => {
  const f = fixture();
  f.dependencies.sendEmail = async () => ({ status: DeliveryStatus.FAILED, reason: "private@example.com token secret", providerResponse: { secret: true } });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.FAILED);
  assert.equal(results[1].status, DeliveryStatus.SENT);
  assert.equal(JSON.stringify(results).includes("secret"), false);
  assert.equal(JSON.stringify(results).includes("private@example.com"), false);
});

test("transport and preparation exceptions yield bounded safe failure results", async () => {
  const f = fixture();
  f.dependencies.loadWhatsappConfig = async () => { throw new Error("credential secret"); };
  f.dependencies.sendEmail = async () => { throw new Error("contact secret"); };
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.multi }, f.dependencies);
  assert.equal(results.length, 2);
  assert.equal(results.every(({ status }) => status === DeliveryStatus.FAILED), true);
  assert.equal(JSON.stringify(results).includes("secret"), false);
  const single = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.single }, f.dependencies);
  assert.equal(single.length, 1);
  assert.equal(single[0].channel, NotificationChannel.EMAIL);
});

test("dispatcher preserves only known finite transport codes and replaces unsafe reasons", async () => {
  for (const code of [DeliveryCode.RATE_LIMITED, "credential-secret"]) {
    const f = fixture();
    f.dependencies.sendEmail = async () => ({ status: DeliveryStatus.FAILED, code, reason: "provider-secret@example.com" });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.multi }, f.dependencies);
    assert.equal(results[0].code, code === DeliveryCode.RATE_LIMITED ? DeliveryCode.RATE_LIMITED : undefined);
    assert.equal(JSON.stringify(results).includes("secret"), false);
    assert.equal(results[1].status, DeliveryStatus.SENT);
  }
});

test("legacy requests preserve WhatsApp-only agenda behavior", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  for (const event of [NotificationEvent.COMPLETED, NotificationEvent.DOCUMENTS_REVIEWED, NotificationEvent.SCHEDULE_CANCELLED]) {
    assert.deepEqual(await dispatchNotification({ event, request: f.request, config: f.multi, legacy: true }, f.dependencies), []);
  }
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED });
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.multi, legacy: true }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(results[0].channel, NotificationChannel.WHATSAPP);
  assert.equal(ran(f, "email") || ran(f, "emailTemplate"), false);
});

test("legacy Brazilian country-code recipients reach WhatsApp without consuming another channel", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  f.request.phone = "+55 (48) 99999-9999";
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, config: f.single, legacy: true }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(ran(f, "whatsapp"), true);
  assert.equal(ran(f, "email"), false);
});
