import test from "node:test";
import assert from "node:assert/strict";
import { deliverAuthMessage } from "../src/services/auth/auth-message-delivery.js";
import { createEmailSender } from "../src/services/email.js";
import { AuthPurpose, buildDefaultAuthDeliveryConfig } from "../../shared/auth-contract.js";
import { DeliveryStatus, DeliveryCode, NotificationChannel } from "../../shared/notification-contract.js";

function fixture() {
  const calls = [];
  const config = buildDefaultAuthDeliveryConfig();
  for (const purpose of Object.values(AuthPurpose)) {
    config.emailTemplates[purpose] = `email_${purpose}`;
    config.whatsappTemplates[purpose] = `whatsapp_${purpose}`;
  }
  const input = { purpose: AuthPurpose.PASSWORD_RESET, municipalityId: "municipality-a", user: { name: "Tutor" },
    email: "tutor@example.test", phone: "48999999999", emailVerified: true, phoneVerified: true, code: "012345",
    channel: NotificationChannel.WHATSAPP, expiresAt: new Date(Date.now() + 600000) };
  const dependencies = {
    loadConfig: async (id) => { calls.push(["config", id]); return config; },
    loadWhatsappConfig: async (id) => { calls.push(["whatsappConfig", id]); return { active: true, accessToken: "private", phoneNumberId: "number" }; },
    consumeQuota: async (id) => { calls.push(["quota", id]); return { allowed: true }; },
    sendWhatsapp: async (...args) => { calls.push(["whatsapp", ...args]); return { status: DeliveryStatus.SENT }; },
    sendEmail: async (value) => { calls.push(["email", value]); return { status: DeliveryStatus.SENT }; },
    env: { EMAILJS_TEMPLATE_ID: "existing_reset_only" },
  };
  return { input, config, calls, dependencies };
}

test("auth recovery sends only selected WhatsApp and keeps codes outside returned results", async () => {
  const f = fixture();
  const results = await deliverAuthMessage(f.input, f.dependencies);
  assert.deepEqual(results, [{ purpose: AuthPurpose.PASSWORD_RESET, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SENT }]);
  const call = f.calls.find(([type]) => type === "whatsapp");
  assert.equal(call[1].templateName, "whatsapp_password_reset");
  assert.equal(call[3][0].parameters[0].text, "012345");
  assert.equal(call[3][1].parameters[0].text, "012345");
  assert.equal(f.calls.some(([type]) => type === "email"), false);
  assert.equal(JSON.stringify(results).includes("012345"), false);
});

test("recovery requires an explicit channel and never uses operational followUp", async () => {
  const f = fixture();
  assert.deepEqual(await deliverAuthMessage({ ...f.input, channel: undefined, emailVerified: false, phoneVerified: false,
    followUp: { enabled: true, email: "attacker@example.test" } }, f.dependencies), []);
  assert.deepEqual(f.calls, []);
});

test("new e-mail verification cannot be redirected to a phone or old contact", async () => {
  const f = fixture();
  await deliverAuthMessage({ ...f.input, purpose: AuthPurpose.VERIFY_EMAIL, email: "new@example.test", emailVerified: false }, f.dependencies);
  assert.equal(f.calls.some(([type]) => type === "whatsapp" || type === "quota"), false);
  assert.equal(f.calls.find(([type]) => type === "email")[1].toEmail, "new@example.test");
});

test("new phone verification cannot fall back to e-mail when WhatsApp is off", async () => {
  const f = fixture();
  f.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const results = await deliverAuthMessage({ ...f.input, purpose: AuthPurpose.VERIFY_PHONE, phoneVerified: false }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(results[0].code, DeliveryCode.CHANNEL_DISABLED);
  assert.equal(f.calls.some(([type]) => type === "email" || type === "quota"), false);
});

test("initial password may use supplied unverified contact but only its own template", async () => {
  const f = fixture();
  f.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const temporaryPassword = "one-time-generated-password";
  const results = await deliverAuthMessage({ ...f.input, purpose: AuthPurpose.INITIAL_PASSWORD,
    temporaryPassword, code: undefined, emailVerified: false, phoneVerified: false }, f.dependencies);
  const sent = f.calls.find(([type]) => type === "email")[1];
  assert.equal(sent.templateId, "email_initial_password");
  assert.equal(sent.templateParams.temporary_password, temporaryPassword);
  assert.equal(sent.templateParams.code, undefined);
  assert.equal(JSON.stringify(results).includes(temporaryPassword), false);
});

test("missing welcome template never borrows the reset template", async () => {
  const f = fixture();
  f.config.emailTemplates[AuthPurpose.INITIAL_PASSWORD] = "";
  const results = await deliverAuthMessage({ ...f.input, phone: "", purpose: AuthPurpose.INITIAL_PASSWORD, temporaryPassword: "new-generated-password" }, f.dependencies);
  assert.equal(results[0].code, DeliveryCode.NOT_CONFIGURED);
  assert.equal(f.calls.some(([type]) => type === "email"), false);
});

test("reset e-mail can reuse only the explicit existing reset template", async () => {
  const f = fixture();
  f.config.emailTemplates[AuthPurpose.PASSWORD_RESET] = "";
  await deliverAuthMessage({ ...f.input, channel: NotificationChannel.EMAIL, phone: "" }, f.dependencies);
  const sent = f.calls.find(([type]) => type === "email")[1];
  assert.equal(sent.templateId, "existing_reset_only");
  assert.equal(sent.templateParams.codigo_recuperacao, "012345");
});

test("auth recovery failure preserves safe codes and never falls back to email", async () => {
  const f = fixture();
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.RATE_LIMITED, reason: "private provider body", providerResponse: { secret: true } });
  const results = await deliverAuthMessage(f.input, f.dependencies);
  assert.equal(results[0].code, DeliveryCode.RATE_LIMITED);
  assert.equal(results.length, 1);
  assert.equal(f.calls.some(([type]) => type === "email"), false);
  assert.doesNotMatch(JSON.stringify(results), /private|secret|012345|tutor@example/);
});

test("trusted global staff reset uses only existing environment e-mail template without a municipality", async () => {
  for (const role of ["master", "suporte"]) {
    const f = fixture();
    const results = await deliverAuthMessage({ ...f.input, channel: NotificationChannel.EMAIL, municipalityId: null, user: { name: "Staff", role } }, f.dependencies);
    assert.equal(results[0].status, DeliveryStatus.SENT);
    assert.equal(results[0].channel, NotificationChannel.EMAIL);
    assert.deepEqual(f.calls.map(([type]) => type), ["email"]);
    assert.equal(f.calls[0][1].templateId, "existing_reset_only");
  }
});

test("absent municipality cannot select global fallback for tutors or other purposes", async () => {
  const f = fixture();
  assert.deepEqual(await deliverAuthMessage({ ...f.input, municipalityId: null, user: { role: "tutor" } }, f.dependencies), []);
  assert.deepEqual(await deliverAuthMessage({ ...f.input, municipalityId: null, purpose: AuthPurpose.VERIFY_EMAIL, user: { role: "master" } }, f.dependencies), []);
  assert.deepEqual(f.calls, []);
});

test("selected SMS invokes only its adapter with the challenge binding and never email or WhatsApp", async () => {
  const f = fixture(); const sent = [];
  f.dependencies.sendSms = async (input) => { sent.push(input); return { status: DeliveryStatus.SENT, providerMessageId: "1", reference: input.challengeId }; };
  const result = await deliverAuthMessage({ ...f.input, channel: NotificationChannel.SMS, challengeId: "challenge" }, f.dependencies);
  assert.equal(sent.length, 1); assert.equal(sent[0].code, f.input.code);
  assert.equal(sent[0].challengeId, "challenge"); assert.equal(result[0].status, DeliveryStatus.SENT);
  assert.deepEqual(f.calls, []);
  assert.doesNotMatch(JSON.stringify(result), /012345|48999999999|tutor@example/);
});

test("recovery expiration during config or quota reads prevents starting email and WhatsApp transports", async (t) => {
  const originalNow = Date.now;
  let current = originalNow();
  Date.now = () => current;
  t.after(() => { Date.now = originalNow; });
  for (const delayed of ["email-config", "whatsapp-config", "whatsapp-quota"]) {
    const f = fixture();
    f.input.expiresAt = new Date(current + 100);
    f.input.channel = delayed === "email-config" ? NotificationChannel.EMAIL : NotificationChannel.WHATSAPP;
    if (delayed === "email-config") f.dependencies.loadConfig = async () => { current += 101; return f.config; };
    if (delayed === "whatsapp-config") f.dependencies.loadWhatsappConfig = async () => {
      current += 101; return { active: true, accessToken: "test", phoneNumberId: "test" };
    };
    if (delayed === "whatsapp-quota") f.dependencies.consumeQuota = async () => { current += 101; return { allowed: true }; };
    const result = await deliverAuthMessage(f.input, f.dependencies);
    assert.equal(result[0].code, DeliveryCode.PREPARATION_FAILED);
    assert.equal(f.calls.some(([type]) => type === "email" || type === "whatsapp"), false);
  }
});

test("email admission delay cannot release a recovery code that expired while waiting", async () => {
  let current = Date.now();
  let sends = 0;
  const sender = createEmailSender({ env: { EMAILJS_SERVICE_ID: "test", EMAILJS_PUBLIC_KEY: "test" },
    now: () => current, wait: async (delay) => { current += delay; }, fetchImpl: async () => { sends += 1; return { ok: true }; } });
  const input = { toEmail: "test@example.test", templateId: "test", templateParams: { code: "123456" } };
  assert.equal((await sender(input)).status, DeliveryStatus.SENT);
  assert.equal((await sender({ ...input, expiresAt: new Date(current + 250) })).code, DeliveryCode.PREPARATION_FAILED);
  assert.equal(sends, 1);
});
