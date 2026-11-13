import test from "node:test";
import assert from "node:assert/strict";
import { dispatchNotification } from "../src/services/notifications/dispatch-notification.js";
import { buildDefaultNotificationConfig, NotificationEvent, NotificationChannel, DeliveryStatus, DeliveryCode } from "../../shared/notification-contract.js";

function fixture() {
  const calls = [];
  const request = { municipality_id: "municipality-a", protocol: "123/2026", phone: "48988888888", workflow_data: { followUp: { enabled: true, email: "citizen@example.com", phone: "48999999999" } } };
  const config = { ...buildDefaultNotificationConfig(), emailTemplateId: "notifications", whatsappTemplates: { [NotificationEvent.COMPLETED]: "attendance_done" } };
  const dependencies = {
    loadWhatsappConfig: async (municipalityId) => { calls.push(["config", municipalityId]); return { active: true, accessToken: "token", phoneNumberId: "number" }; },
    consumeQuota: async (municipalityId) => { calls.push(["quota", municipalityId]); return { allowed: true }; },
    sendWhatsapp: async (settings, body) => { calls.push(["whatsapp", settings, body]); return { status: DeliveryStatus.SENT }; },
    sendEmail: async (body) => { calls.push(["email", body]); return { status: DeliveryStatus.SENT }; },
  };
  return { calls, request, config, dependencies };
}

test("WhatsApp succeeds with the follow-up phone and suppresses e-mail", async () => {
  const f = fixture();
  const results = await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: f.request, config: f.config }, f.dependencies);
  assert.deepEqual(results, [{ event: NotificationEvent.SCHEDULE_CONFIRMED, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SENT }]);
  assert.equal(f.calls.find(([kind]) => kind === "whatsapp")[2].phone, "48999999999");
  assert.equal(f.calls.some(([kind]) => kind === "email"), false);
  assert.deepEqual(f.calls.find(([kind]) => kind === "quota"), ["quota", "municipality-a"]);
});

test("refusal and missing preference never infer consent from existing contacts", async () => {
  const f = fixture();
  for (const workflow_data of [{ followUp: { enabled: false } }, {}]) {
    assert.deepEqual(await dispatchNotification({ event: NotificationEvent.SCHEDULE_CONFIRMED, request: { ...f.request, workflow_data }, config: f.config }, f.dependencies), []);
  }
  assert.deepEqual(f.calls, []);
});

test("disabled channel, missing phone, missing template or exhausted quota use e-mail fallback", async () => {
  for (const scenario of ["disabled", "phone", "template", "quota"]) {
    const f = fixture();
    const event = scenario === "template" ? NotificationEvent.DOCUMENTS_REVIEWED : NotificationEvent.SCHEDULE_CONFIRMED;
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

test("new events use their own WhatsApp templates and fail over without disclosing provider errors", async () => {
  const f = fixture();
  f.dependencies.sendWhatsapp = async (settings) => {
    assert.equal(settings.templateName, "attendance_done");
    assert.deepEqual(settings.templateVariables, ["protocol", "notification_message"]);
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
  for (const event of [NotificationEvent.COMPLETED, NotificationEvent.DOCUMENTS_REVIEWED]) {
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
