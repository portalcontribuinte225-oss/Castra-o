import test from "node:test";
import assert from "node:assert/strict";
import { dispatchNotification } from "../src/services/notifications/dispatch-notification.js";
import { NotificationEvent, NotificationChannel, DeliveryStatus, DeliveryCode } from "../../shared/notification-contract.js";
import { WhatsappTemplateField, templateFields } from "../../shared/whatsapp-templates-contract.js";

// Every channel starts in use: e-mail on with its template, WhatsApp active with a template per notice, SMS on for every notice.
function fixture() {
  const calls = [];
  const request = {
    municipality_id: "municipality-a", protocol: "123/2026", phone: "48988888888", tutor_name: "Maria", schedule_date: "2026-11-20",
    schedule_location_name: "Unidade Municipal", workflow_data: { scheduleTime: "09:00", followUp: { enabled: true, email: "citizen@example.com", phone: "48999999999" } },
  };
  const active = {
    [NotificationEvent.SCHEDULE_CONFIRMED]: "castracao_confirmacao_agendamento",
    [NotificationEvent.SCHEDULE_CHANGED]: "castracao_reagendamento",
    [NotificationEvent.NO_SHOW]: "castracao_cancelamento",
  };
  const dependencies = {
    loadWhatsappConfig: async (municipalityId) => { calls.push(["config", municipalityId]); return { active: true, accessToken: "token", phoneNumberId: "number" }; },
    resolveTemplate: async (municipalityId, event) => {
      calls.push(["template", municipalityId, event]);
      return active[event] ? { ok: true, template: { name: active[event], language: "pt_BR", fields: templateFields(event) } } : { ok: false, code: DeliveryCode.NOT_CONFIGURED };
    },
    markTemplateStatus: async (...args) => { calls.push(["mark", ...args]); },
    consumeQuota: async (channel, municipalityId) => { calls.push(["quota", channel, municipalityId]); return { allowed: true }; },
    sendWhatsapp: async (settings, phone, components) => { calls.push(["whatsapp", settings, phone, components]); return { status: DeliveryStatus.SENT }; },
    resolveEmailTemplate: async ({ municipalityId, use }) => { calls.push(["emailTemplate", municipalityId, use]); return { ok: true, templateId: `email_${use}` }; },
    loadEmailIdentity: async (municipalityId) => { calls.push(["identity", municipalityId]); return { municipality_name: "Test Town" }; },
    sendEmail: async (body) => { calls.push(["email", body]); return { status: DeliveryStatus.SENT }; },
    sendSms: async (input) => { calls.push(["sms", input]); return { status: DeliveryStatus.SENT }; },
  };
  return { calls, request, active, dependencies };
}

const texts = (components) => components[0].parameters.map(({ text }) => text);
const sent = (event, channel) => ({ event, channel, status: DeliveryStatus.SENT });
const ran = (f, kind) => f.calls.some(([name]) => name === kind);
const spent = (f, channel) => f.calls.some(([name, spentChannel]) => name === "quota" && spentChannel === channel);
const SCHEDULE_CONFIRMED = NotificationEvent.SCHEDULE_CONFIRMED;
const smsOff = { status: DeliveryStatus.SKIPPED, code: DeliveryCode.CHANNEL_DISABLED };

test("a notice goes out by every channel the municipality uses, each on its own, with one result per channel", async () => {
  const f = fixture();
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  assert.deepEqual(results, [sent(SCHEDULE_CONFIRMED, NotificationChannel.EMAIL), sent(SCHEDULE_CONFIRMED, NotificationChannel.WHATSAPP), sent(SCHEDULE_CONFIRMED, NotificationChannel.SMS)]);
  assert.deepEqual(f.calls.filter(([kind]) => ["email", "whatsapp", "sms"].includes(kind)).map(([kind]) => kind), ["email", "whatsapp", "sms"]);
  const email = f.calls.find(([kind]) => kind === "email")[1];
  assert.equal(email.toEmail, "citizen@example.com");
  assert.equal(email.toName, "Maria");
  assert.equal(email.templateId, `email_${SCHEDULE_CONFIRMED}`);
  assert.deepEqual(email.identityParams, { municipality_name: "Test Town" });
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[2], "48999999999");
  assert.deepEqual(f.calls.filter(([kind]) => kind === "quota"), [["quota", NotificationChannel.EMAIL, "municipality-a"], ["quota", NotificationChannel.WHATSAPP, "municipality-a"]]);
  assert.deepEqual(f.calls.find(([kind]) => kind === "template"), ["template", "municipality-a", SCHEDULE_CONFIRMED]);
});

test("the SMS gets the municipality, the notice, the phone informed and only the fields the text needs", async () => {
  const f = fixture();
  await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  const input = f.calls.find(([kind]) => kind === "sms")[1];
  assert.deepEqual(input, { municipalityId: "municipality-a", use: SCHEDULE_CONFIRMED, phone: "48999999999",
    data: { protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Municipal" } });
  const serialized = JSON.stringify(input);
  for (const private_ of ["citizen@example.com", "Maria", "48988888888"]) assert.equal(serialized.includes(private_), false, private_);
});

test("a channel that is off, or without the notice turned on, is not tried and leaves no result", async () => {
  const off = {
    email: (f) => { f.dependencies.resolveEmailTemplate = async () => ({ ok: false, code: DeliveryCode.CHANNEL_DISABLED }); },
    whatsapp: (f) => { f.dependencies.loadWhatsappConfig = async () => ({ active: false }); },
    "whatsapp template": (f) => { f.dependencies.resolveTemplate = async () => ({ ok: false, code: DeliveryCode.NOT_CONFIGURED }); },
    sms: (f) => { f.dependencies.sendSms = async () => smsOff; },
  };
  const channelOf = { email: NotificationChannel.EMAIL, whatsapp: NotificationChannel.WHATSAPP, "whatsapp template": NotificationChannel.WHATSAPP, sms: NotificationChannel.SMS };
  for (const [name, turnOff] of Object.entries(off)) {
    const f = fixture(); turnOff(f);
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
    assert.equal(results.length, 2, name);
    assert.equal(results.some(({ channel }) => channel === channelOf[name]), false, name);
    assert.equal(results.every(({ status }) => status === DeliveryStatus.SENT), true, name);
  }
  const f = fixture(); Object.values(off).forEach((turnOff) => turnOff(f));
  assert.deepEqual(await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies), []);
  assert.equal(["email", "whatsapp", "quota", "identity"].some((kind) => ran(f, kind)), false);
});

test("a notice only some channels use is sent by those: only e-mail, only SMS, only WhatsApp", async () => {
  for (const [keep, channel] of [["email", NotificationChannel.EMAIL], ["sms", NotificationChannel.SMS], ["whatsapp", NotificationChannel.WHATSAPP]]) {
    const f = fixture();
    if (keep !== "email") f.dependencies.resolveEmailTemplate = async () => ({ ok: false, code: DeliveryCode.CHANNEL_DISABLED });
    if (keep !== "whatsapp") f.dependencies.loadWhatsappConfig = async () => ({ active: false });
    if (keep !== "sms") f.dependencies.sendSms = async () => smsOff;
    assert.deepEqual(await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies), [sent(SCHEDULE_CONFIRMED, channel)]);
  }
});

test("without a phone informed only the e-mail is tried", async () => {
  const f = fixture(); f.request.workflow_data.followUp.phone = "";
  assert.deepEqual(await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies), [sent(SCHEDULE_CONFIRMED, NotificationChannel.EMAIL)]);
  assert.equal(["whatsapp", "template", "sms"].some((kind) => ran(f, kind)), false);
  assert.deepEqual(f.calls.filter(([kind]) => kind === "quota"), [["quota", NotificationChannel.EMAIL, "municipality-a"]]);
});

test("an e-mail use turned on without its template is reported, while the other channels still go out", async () => {
  const f = fixture();
  f.dependencies.resolveEmailTemplate = async () => ({ ok: false, code: DeliveryCode.NOT_CONFIGURED });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  assert.deepEqual([results[0].channel, results[0].status, results[0].code], [NotificationChannel.EMAIL, DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED]);
  assert.deepEqual(results.slice(1), [sent(SCHEDULE_CONFIRMED, NotificationChannel.WHATSAPP), sent(SCHEDULE_CONFIRMED, NotificationChannel.SMS)]);
  assert.equal(["email", "identity"].some((kind) => ran(f, kind)), false);
});

test("confirmation, reschedule and cancellation send the parameters their Meta templates expect", async () => {
  const expected = [
    [NotificationEvent.SCHEDULE_CONFIRMED, "castracao_confirmacao_agendamento", ["Maria", "20/11/2026", "09:00", "Unidade Municipal", "123/2026"]],
    [NotificationEvent.SCHEDULE_CHANGED, "castracao_reagendamento", ["Maria", "20/11/2026", "09:00", "Unidade Municipal", "123/2026"]],
    [NotificationEvent.NO_SHOW, "castracao_cancelamento", ["Maria", "20/11/2026", "09:00"]],
  ];
  for (const [event, templateName, parameters] of expected) {
    const f = fixture();
    const results = await dispatchNotification({ event, request: f.request }, f.dependencies);
    assert.equal(results[1].status, DeliveryStatus.SENT);
    const [, settings, , components] = f.calls.find(([kind]) => kind === "whatsapp");
    assert.equal(settings.templateName, templateName);
    assert.equal(settings.languageCode, "pt_BR");
    assert.deepEqual(texts(components), parameters);
  }
});

test("a template configured on screen gets each number from the field chosen for it, in its own order", async () => {
  const f = fixture();
  f.dependencies.resolveTemplate = async () => ({ ok: true, template: { name: "castracao_nao_comparecimento", language: "pt_BR",
    fields: [WhatsappTemplateField.PROTOCOL, WhatsappTemplateField.TUTOR_NAME, WhatsappTemplateField.SCHEDULE_LOCATION_NAME, WhatsappTemplateField.TUTOR_NAME] } });
  await dispatchNotification({ event: NotificationEvent.NO_SHOW, request: f.request }, f.dependencies);
  const [, settings, , components] = f.calls.find(([kind]) => kind === "whatsapp");
  assert.equal(settings.templateName, "castracao_nao_comparecimento");
  assert.deepEqual(texts(components), ["123/2026", "Maria", "Unidade Municipal", "Maria"]);
});

test("documents reviewed and completed send the protocol and the notice sentence", async () => {
  for (const [event, sentence] of [[NotificationEvent.DOCUMENTS_REVIEWED, /Documentos conferidos/], [NotificationEvent.COMPLETED, /Atendimento concluído/]]) {
    const f = fixture();
    f.active[event] = `castracao_${event}`;
    const results = await dispatchNotification({ event, request: f.request }, f.dependencies);
    assert.equal(results[1].status, DeliveryStatus.SENT);
    const components = f.calls.find(([kind]) => kind === "whatsapp")[3];
    assert.equal(components[0].parameters.length, 2);
    assert.equal(texts(components)[0], "123/2026");
    assert.match(texts(components)[1], sentence);
    assert.equal(f.calls.find(([kind]) => kind === "sms")[1].use, event);
  }
});

test("refusal and missing preference never infer consent from existing contacts", async () => {
  const f = fixture();
  for (const workflow_data of [{ followUp: { enabled: false } }, {}]) {
    assert.deepEqual(await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: { ...f.request, workflow_data } }, f.dependencies), []);
  }
  assert.deepEqual(f.calls, []);
});

test("a WhatsApp that is active but cannot send is reported, and the other channels still go out", async () => {
  for (const scenario of ["phone", "quota", "template", "credentials"]) {
    const f = fixture();
    if (scenario === "phone") f.request.workflow_data.followUp.phone = "123";
    if (scenario === "quota") f.dependencies.consumeQuota = async (channel) => ({ allowed: channel !== NotificationChannel.WHATSAPP, reason: "private" });
    if (scenario === "template") f.dependencies.resolveTemplate = async () => ({ ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE });
    if (scenario === "credentials") f.dependencies.loadWhatsappConfig = async () => ({ active: true });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
    const whatsapp = results.find(({ channel }) => channel === NotificationChannel.WHATSAPP);
    assert.equal(whatsapp.status, DeliveryStatus.SKIPPED, scenario);
    assert.equal(results.find(({ channel }) => channel === NotificationChannel.EMAIL).status, DeliveryStatus.SENT, scenario);
    assert.equal(ran(f, "whatsapp"), false, scenario);
    if (scenario !== "quota") assert.equal(spent(f, NotificationChannel.WHATSAPP), false, scenario);
  }
});

test("a municipality without its own credentials never sends by WhatsApp, even when the host has WhatsApp variables", async () => {
  const previous = { token: process.env.WHATSAPP_TOKEN, number: process.env.WHATSAPP_PHONE_NUMBER_ID };
  process.env.WHATSAPP_TOKEN = "host-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "host-number";
  try {
    const f = fixture();
    f.dependencies.loadWhatsappConfig = async () => ({ active: true });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
    assert.equal(results[1].code, DeliveryCode.NOT_CONFIGURED);
    assert.equal(ran(f, "whatsapp") || spent(f, NotificationChannel.WHATSAPP), false);
  } finally {
    for (const [key, value] of [["WHATSAPP_TOKEN", previous.token], ["WHATSAPP_PHONE_NUMBER_ID", previous.number]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("an unusable active WhatsApp template is blocked before quota and does not touch the other channels", async () => {
  const f = fixture();
  f.dependencies.resolveTemplate = async () => ({ ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(results[1].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
  assert.equal(results[2].status, DeliveryStatus.SENT);
  assert.equal(spent(f, NotificationChannel.WHATSAPP) || ran(f, "whatsapp"), false);
});

test("an e-mail without contract or balance is reported as quota unavailable and never sent, while the other channels still go out", async () => {
  const f = fixture();
  f.dependencies.consumeQuota = async (channel, municipalityId) => { f.calls.push(["quota", channel, municipalityId]); return { allowed: channel !== NotificationChannel.EMAIL, reason: "private" }; };
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  assert.deepEqual(results[0], { event: SCHEDULE_CONFIRMED, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SKIPPED, code: DeliveryCode.QUOTA_UNAVAILABLE, reason: results[0].reason });
  assert.doesNotMatch(JSON.stringify(results), /private/);
  assert.equal(ran(f, "email"), false);
  assert.deepEqual(results.slice(1).map(({ channel, status }) => [channel, status]), [[NotificationChannel.WHATSAPP, DeliveryStatus.SENT], [NotificationChannel.SMS, DeliveryStatus.SENT]]);
});

test("a provider template error is reported safely and updates the cached status", async () => {
  const f = fixture();
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.TEMPLATE_UNAVAILABLE, templateStatus: "PAUSED", reason: "private@example.com token secret" });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(results[1].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
  assert.equal(results[2].status, DeliveryStatus.SENT);
  assert.deepEqual(f.calls.find(([kind]) => kind === "mark"), ["mark", "municipality-a", "castracao_confirmacao_agendamento", "pt_BR", "PAUSED"]);
  assert.equal(JSON.stringify(results).includes("secret"), false);
  f.dependencies.markTemplateStatus = async () => { throw new Error("cache secret"); };
  const again = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
  assert.equal(again[0].status, DeliveryStatus.SENT);
});

test("a failing channel never stops the others and provider errors are never disclosed", async () => {
  for (const failing of ["email", "sms"]) {
    const f = fixture();
    const failure = { status: DeliveryStatus.FAILED, reason: "private@example.com token secret", providerResponse: { secret: true } };
    if (failing === "email") f.dependencies.sendEmail = async () => failure; else f.dependencies.sendSms = async () => ({ ...failure, code: DeliveryCode.INSUFFICIENT_BALANCE });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
    assert.equal(results.length, 3);
    for (const result of results) assert.equal(result.status, result.channel === failing ? DeliveryStatus.FAILED : DeliveryStatus.SENT, `${failing} / ${result.channel}`);
    assert.equal(JSON.stringify(results).includes("secret"), false);
    assert.equal(JSON.stringify(results).includes("private@example.com"), false);
    if (failing === "sms") assert.equal(results[2].code, DeliveryCode.INSUFFICIENT_BALANCE);
  }
});

test("transport and preparation exceptions yield bounded safe failure results, one per channel", async () => {
  const f = fixture();
  f.dependencies.loadWhatsappConfig = async () => { throw new Error("credential secret"); };
  f.dependencies.sendEmail = async () => { throw new Error("contact secret"); };
  f.dependencies.sendSms = async () => { throw new Error("balance secret"); };
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request }, f.dependencies);
  assert.deepEqual(results.map(({ channel }) => channel), [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP, NotificationChannel.SMS]);
  assert.equal(results.every(({ status, code }) => status === DeliveryStatus.FAILED && code === DeliveryCode.PREPARATION_FAILED), true);
  assert.equal(JSON.stringify(results).includes("secret"), false);
});

test("dispatcher preserves only known finite transport codes and replaces unsafe reasons", async () => {
  for (const code of [DeliveryCode.RATE_LIMITED, "credential-secret"]) {
    const f = fixture();
    f.dependencies.sendEmail = async () => ({ status: DeliveryStatus.FAILED, code, reason: "provider-secret@example.com" });
    const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request }, f.dependencies);
    assert.equal(results[0].code, code === DeliveryCode.RATE_LIMITED ? DeliveryCode.RATE_LIMITED : undefined);
    assert.equal(JSON.stringify(results).includes("secret"), false);
    assert.equal(results[1].status, DeliveryStatus.SENT);
  }
});

test("legacy reschedule uses the reschedule template, not the confirmation one", async () => {
  const f = fixture();
  f.request.workflow_data = { scheduleTime: "09:00" };
  await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, legacy: true }, f.dependencies);
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[1].templateName, "castracao_reagendamento");
});

test("a rejection reaches every channel in use with its reason, and never the staff's internal note", async () => {
  const f = fixture();
  const event = NotificationEvent.REQUEST_REJECTED;
  f.active[event] = "castracao_indeferimento";
  f.request.workflow_data = { ...f.request.workflow_data, rejectionReason: "Tutor não localizado", rejectionNote: "private staff note" };
  const results = await dispatchNotification({ event, request: f.request }, f.dependencies);
  assert.deepEqual(results, [sent(event, NotificationChannel.EMAIL), sent(event, NotificationChannel.WHATSAPP), sent(event, NotificationChannel.SMS)]);
  const whatsapp = f.calls.find(([kind]) => kind === "whatsapp");
  assert.equal(whatsapp[1].templateName, "castracao_indeferimento");
  assert.deepEqual(texts(whatsapp[3]), ["123/2026", "Solicitação 123/2026: indeferida. Motivo: Tutor não localizado. Para mais informações, procure o atendimento do município."]);
  const sms = f.calls.find(([kind]) => kind === "sms")[1];
  assert.deepEqual([sms.use, sms.phone, sms.data.reason, sms.data.protocol], [event, "48999999999", "Tutor não localizado", "123/2026"]);
  assert.doesNotMatch(JSON.stringify([whatsapp, sms]), /private staff note/);
});

test("legacy requests preserve WhatsApp-only agenda behavior, never e-mail nor SMS", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  for (const event of [NotificationEvent.COMPLETED, NotificationEvent.DOCUMENTS_REVIEWED, NotificationEvent.NO_SHOW, NotificationEvent.REQUEST_REJECTED]) {
    assert.deepEqual(await dispatchNotification({ event, request: f.request, legacy: true }, f.dependencies), []);
  }
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED });
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, legacy: true }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(results[0].channel, NotificationChannel.WHATSAPP);
  assert.equal(ran(f, "email") || ran(f, "emailTemplate") || ran(f, "sms"), false);
});

test("a legacy request is told when its WhatsApp is off, as before", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  f.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, legacy: true }, f.dependencies);
  assert.deepEqual([results.length, results[0].status, results[0].code], [1, DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED]);
});

test("legacy Brazilian country-code recipients reach WhatsApp without consuming another channel", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  f.request.phone = "+55 (48) 99999-9999";
  const results = await dispatchNotification({ event: SCHEDULE_CONFIRMED, request: f.request, legacy: true }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(ran(f, "whatsapp"), true);
  assert.equal(ran(f, "email") || ran(f, "sms"), false);
});
