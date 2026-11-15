import test from "node:test";
import assert from "node:assert/strict";
import { dispatchNotification } from "../src/services/notifications/dispatch-notification.js";
import { buildDefaultNotificationConfig, NotificationEvent, NotificationChannel, DeliveryStatus, DeliveryCode } from "../../shared/notification-contract.js";
import { buildDefaultWhatsappBindings } from "../../shared/whatsapp-binding-contract.js";

const approved = (binding) => ({ name: binding.templateName, language: binding.languageCode, status: "APPROVED", category: "UTILITY", bodyText: "", variableCount: binding.mapping.length, supported: true, unsupportedReason: "" });

function fixture() {
  const calls = [];
  const request = {
    municipality_id: "municipality-a", protocol: "123/2026", phone: "48988888888", tutor_name: "Maria", schedule_date: "2026-11-20",
    schedule_location_name: "Unidade Municipal", workflow_data: { scheduleTime: "09:00", followUp: { enabled: true, email: "citizen@example.com", phone: "48999999999" } },
  };
  const config = { ...buildDefaultNotificationConfig(), emailTemplateId: "notifications" };
  const bindings = buildDefaultWhatsappBindings();
  const dependencies = {
    loadWhatsappConfig: async (municipalityId) => { calls.push(["config", municipalityId]); return { active: true, accessToken: "token", phoneNumberId: "number" }; },
    loadBinding: async (municipalityId, event) => { calls.push(["binding", municipalityId, event]); const binding = bindings[event]; return { binding, template: binding ? approved(binding) : null }; },
    markTemplateStatus: async (...args) => { calls.push(["mark", ...args]); },
    consumeQuota: async (municipalityId) => { calls.push(["quota", municipalityId]); return { allowed: true }; },
    sendWhatsapp: async (settings, phone, components) => { calls.push(["whatsapp", settings, phone, components]); return { status: DeliveryStatus.SENT }; },
    sendEmail: async (body) => { calls.push(["email", body]); return { status: DeliveryStatus.SENT }; },
  };
  return { calls, request, config, bindings, dependencies };
}

const texts = (components) => components[0].parameters.map(({ text }) => text);

test("WhatsApp succeeds with the follow-up phone and suppresses e-mail", async () => {
  const f = fixture();
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
  assert.deepEqual(results, [{ event: NotificationEvent.SCHEDULE_CONFIRMED, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SENT }]);
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[2], "48999999999");
  assert.equal(f.calls.some(([kind]) => kind === "email"), false);
  assert.deepEqual(f.calls.find(([kind]) => kind === "quota"), ["quota", "municipality-a"]);
  assert.deepEqual(f.calls.find(([kind]) => kind === "binding"), ["binding", "municipality-a", NotificationEvent.SCHEDULE_CONFIRMED]);
});

test("confirmation, reschedule and cancellation send the parameters their Meta templates expect", async () => {
  const expected = [
    [NotificationEvent.SCHEDULE_CONFIRMED, "castracao_confirmacao_agendamento", ["Maria", "20/11/2026", "09:00", "Unidade Municipal"]],
    [NotificationEvent.SCHEDULE_CHANGED, "castracao_reagendamento", ["Maria", "20/11/2026", "09:00", "Unidade Municipal"]],
    [NotificationEvent.SCHEDULE_CANCELLED, "castracao_cancelamento", ["Maria", "20/11/2026", "09:00"]],
  ];
  for (const [event, templateName, parameters] of expected) {
    const f = fixture();
    const results = await dispatchNotification({ event, request: f.request, config: f.config }, f.dependencies);
    assert.equal(results[0].status, DeliveryStatus.SENT);
    const [, settings, , components] = f.calls.find(([kind]) => kind === "whatsapp");
    assert.equal(settings.templateName, templateName);
    assert.equal(settings.languageCode, "pt_BR");
    assert.deepEqual(texts(components), parameters);
  }
});

test("legacy reschedule uses the reschedule binding, not the confirmation one", async () => {
  const f = fixture();
  f.request.workflow_data = { scheduleTime: "09:00" };
  await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.config, legacy: true }, f.dependencies);
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[1].templateName, "castracao_reagendamento");
});

test("refusal and missing preference never infer consent from existing contacts", async () => {
  const f = fixture();
  for (const workflow_data of [{ followUp: { enabled: false } }, {}]) {
    assert.deepEqual(await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: { ...f.request, workflow_data }, config: f.config }, f.dependencies), []);
  }
  assert.deepEqual(f.calls, []);
});

test("disabled channel, missing phone, unlinked event or exhausted quota use e-mail fallback", async () => {
  for (const scenario of ["disabled", "phone", "unlinked", "quota"]) {
    const f = fixture();
    const event = scenario === "unlinked" ? NotificationEvent.DOCUMENTS_REVIEWED : NotificationEvent.SCHEDULE_CONFIRMED;
    if (scenario === "disabled") f.dependencies.loadWhatsappConfig = async () => ({ active: false });
    if (scenario === "phone") f.request.workflow_data.followUp.phone = "";
    if (scenario === "quota") f.dependencies.consumeQuota = async () => ({ allowed: false, reason: "private" });
    const results = await dispatchNotification({ event, request: f.request, config: f.config }, f.dependencies);
    assert.equal(results[0].status, DeliveryStatus.SKIPPED);
    assert.equal(results[1].channel, NotificationChannel.EMAIL);
    assert.equal(results[1].status, DeliveryStatus.SENT);
    assert.equal(f.calls.some(([kind]) => kind === "whatsapp"), false);
    if (scenario !== "quota") assert.equal(f.calls.some(([kind]) => kind === "quota"), false);
  }
});

test("a municipality without its own credentials never sends, even when the host has WhatsApp variables", async () => {
  const previous = { token: process.env.WHATSAPP_TOKEN, number: process.env.WHATSAPP_PHONE_NUMBER_ID };
  process.env.WHATSAPP_TOKEN = "host-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "host-number";
  try {
    const f = fixture();
    f.dependencies.loadWhatsappConfig = async () => ({ active: true });
    const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
    assert.equal(results[0].code, DeliveryCode.NOT_CONFIGURED);
    assert.equal(f.calls.some(([kind]) => kind === "whatsapp"), false);
  } finally {
    for (const [key, value] of [["WHATSAPP_TOKEN", previous.token], ["WHATSAPP_PHONE_NUMBER_ID", previous.number]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("templates that are not approved or whose variables changed are blocked before quota and fall back to e-mail", async () => {
  for (const change of [{ status: "PAUSED" }, { status: "DISABLED" }, { status: "REJECTED" }, { variableCount: 2 }]) {
    const f = fixture();
    const loadBinding = f.dependencies.loadBinding;
    f.dependencies.loadBinding = async (...args) => { const loaded = await loadBinding(...args); return { ...loaded, template: { ...loaded.template, ...change } }; };
    const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
    assert.equal(results[0].status, DeliveryStatus.SKIPPED);
    assert.equal(results[0].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
    assert.equal(results[1].channel, NotificationChannel.EMAIL);
    assert.equal(f.calls.some(([kind]) => kind === "quota" || kind === "whatsapp"), false);
  }
});

test("a template missing from the catalog is still sent, since only synchronized templates can be judged", async () => {
  const f = fixture();
  f.dependencies.loadBinding = async () => ({ binding: f.bindings[NotificationEvent.SCHEDULE_CONFIRMED], template: null });
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
});

test("a provider template error is reported safely and updates the cached status", async () => {
  const f = fixture();
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.TEMPLATE_UNAVAILABLE, templateStatus: "PAUSED", reason: "private@example.com token secret" });
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
  assert.equal(results[0].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
  assert.equal(results[1].status, DeliveryStatus.SENT);
  assert.deepEqual(f.calls.find(([kind]) => kind === "mark"), ["mark", "municipality-a", "castracao_confirmacao_agendamento", "pt_BR", "PAUSED"]);
  assert.equal(JSON.stringify(results).includes("secret"), false);
  f.dependencies.markTemplateStatus = async () => { throw new Error("cache secret"); };
  const again = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
  assert.equal(again[1].status, DeliveryStatus.SENT);
});

test("new events use their own bindings and fail over without disclosing provider errors", async () => {
  const f = fixture();
  f.bindings[NotificationEvent.COMPLETED] = { templateName: "attendance_done", languageCode: "pt_BR", mapping: [{ kind: "field", value: "protocol" }, { kind: "field", value: "notification_message" }] };
  f.dependencies.sendWhatsapp = async (settings, _phone, components) => {
    assert.equal(settings.templateName, "attendance_done");
    assert.equal(texts(components)[0], "123/2026");
    assert.match(texts(components)[1], /Atendimento concluído/);
    return { status: DeliveryStatus.FAILED, reason: "private@example.com token secret", providerResponse: { secret: true } };
  };
  const results = await dispatchNotification({ event: NotificationEvent.COMPLETED, request: f.request, config: f.config }, f.dependencies);
  assert.equal(results[1].status, DeliveryStatus.SENT);
  assert.equal(JSON.stringify(results).includes("secret"), false);
  assert.equal(JSON.stringify(results).includes("private@example.com"), false);
});

test("transport and preparation exceptions yield bounded safe failure results", async () => {
  const f = fixture();
  f.dependencies.loadWhatsappConfig = async () => { throw new Error("credential secret"); };
  f.dependencies.sendEmail = async () => { throw new Error("contact secret"); };
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.config }, f.dependencies);
  assert.equal(results.length, 2);
  assert.equal(results.every(({ status }) => status === DeliveryStatus.FAILED), true);
  assert.equal(JSON.stringify(results).includes("secret"), false);
});

test("dispatcher preserves only known finite transport codes and replaces unsafe reasons", async () => {
  for (const code of [DeliveryCode.RATE_LIMITED, "credential-secret"]) {
    const f = fixture();
    f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code, reason: "provider-secret@example.com" });
    const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
    assert.equal(results[0].code, code === DeliveryCode.RATE_LIMITED ? DeliveryCode.RATE_LIMITED : undefined);
    assert.equal(JSON.stringify(results).includes("secret"), false);
    assert.equal(results[1].status, DeliveryStatus.SENT);
  }
});

test("legacy requests preserve WhatsApp-only agenda behavior", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  for (const event of [NotificationEvent.COMPLETED, NotificationEvent.DOCUMENTS_REVIEWED, NotificationEvent.SCHEDULE_CANCELLED]) {
    assert.deepEqual(await dispatchNotification({ event, request: f.request, config: f.config, legacy: true }, f.dependencies), []);
  }
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED });
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CHANGED, request: f.request, config: f.config, legacy: true }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(results[0].channel, NotificationChannel.WHATSAPP);
  assert.equal(f.calls.some(([kind]) => kind === "email"), false);
});

test("legacy Brazilian country-code recipients reach WhatsApp without consuming another channel", async () => {
  const f = fixture();
  f.request.workflow_data = {};
  f.request.phone = "+55 (48) 99999-9999";
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config, legacy: true }, f.dependencies);
  assert.equal(results[0].status, DeliveryStatus.SENT);
  assert.equal(f.calls.some(([kind]) => kind === "whatsapp"), true);
  assert.equal(f.calls.some(([kind]) => kind === "email"), false);
});
