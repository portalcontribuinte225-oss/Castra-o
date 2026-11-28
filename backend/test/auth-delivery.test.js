import test from "node:test";
import assert from "node:assert/strict";
import { deliverAuthMessage } from "../src/services/auth/auth-message-delivery.js";
import { createEmailSender } from "../src/services/email.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { DeliveryStatus, DeliveryCode, NotificationChannel } from "../../shared/notification-contract.js";
import { clearServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();
// The WhatsApp token comes from the server variable the municipality chose.
process.env.WHATSAPP_TOKEN_TEST = "fake-whatsapp-token";

function fixture() {
  const calls = [];
  const emailTemplates = Object.fromEntries(Object.values(AuthPurpose).map((purpose) => [purpose, `email_${purpose}`]));
  const input = { purpose: AuthPurpose.PASSWORD_RESET, municipalityId: "municipality-a", user: { name: "Tutor" },
    email: "tutor@example.test", phone: "48999999999", emailVerified: true, phoneVerified: true, code: "012345",
    channel: NotificationChannel.WHATSAPP, expiresAt: new Date(Date.now() + 600000) };
  const dependencies = {
    loadWhatsappConfig: async (id) => { calls.push(["whatsappConfig", id]); return { active: true, tokenVariable: "WHATSAPP_TOKEN_TEST", phoneNumberId: "number" }; },
    resolveTemplate: async (id, purpose) => { calls.push(["template", id, purpose]); return { ok: true, template: { name: `whatsapp_${purpose}`, language: "pt_BR" } }; },
    markTemplateStatus: async (...args) => { calls.push(["mark", ...args]); },
    consumeQuota: async (channel, id) => { calls.push(["quota", channel, id]); return { allowed: true }; },
    sendWhatsapp: async (...args) => { calls.push(["whatsapp", ...args]); return { status: DeliveryStatus.SENT }; },
    resolveEmailTemplate: async ({ municipalityId, use }) => {
      calls.push(["emailTemplate", municipalityId, use]);
      return emailTemplates[use] ? { ok: true, templateId: emailTemplates[use] } : { ok: false, code: DeliveryCode.NOT_CONFIGURED };
    },
    loadEmailIdentity: async (municipalityId) => { calls.push(["identity", municipalityId]); return { municipality_name: "Test Town" }; },
    sendEmail: async (value) => { calls.push(["email", value]); return { status: DeliveryStatus.SENT }; },
    sendSms: async (value) => { calls.push(["sms", value]); return { status: DeliveryStatus.SKIPPED, code: DeliveryCode.CHANNEL_DISABLED }; },
  };
  return { input, emailTemplates, calls, dependencies };
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

test("WhatsApp access messages need an active, usable template and stop before quota or provider when there is none", async () => {
  for (const code of [DeliveryCode.NOT_CONFIGURED, DeliveryCode.TEMPLATE_UNAVAILABLE]) {
    const f = fixture();
    f.dependencies.resolveTemplate = async () => ({ ok: false, code });
    const results = await deliverAuthMessage(f.input, f.dependencies);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, DeliveryStatus.SKIPPED);
    assert.equal(results[0].code, code);
    assert.equal(f.calls.some(([type]) => type === "quota" || type === "whatsapp" || type === "email"), false);
  }
});

test("a provider template error on an access message is reported safely and updates the cached status", async () => {
  const f = fixture();
  f.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.TEMPLATE_UNAVAILABLE, templateStatus: "PAUSED", reason: "private provider body" });
  const results = await deliverAuthMessage(f.input, f.dependencies);
  assert.equal(results[0].code, DeliveryCode.TEMPLATE_UNAVAILABLE);
  assert.deepEqual(f.calls.find(([type]) => type === "mark"), ["mark", "municipality-a", "whatsapp_password_reset", "pt_BR", "PAUSED"]);
  assert.doesNotMatch(JSON.stringify(results), /private|012345/);
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
  assert.equal(f.calls.some(([type]) => type === "whatsapp"), false);
  assert.deepEqual(f.calls.filter(([type]) => type === "quota"), [["quota", NotificationChannel.EMAIL, "municipality-a"]]);
  assert.equal(f.calls.find(([type]) => type === "email")[1].toEmail, "new@example.test");
});

test("an e-mail spends the municipality's e-mail contract and is not sent when there is none, while the platform staff recovery spends nothing", async () => {
  const blocked = fixture();
  blocked.dependencies.consumeQuota = async (channel, id) => { blocked.calls.push(["quota", channel, id]); return { allowed: false, reason: "private" }; };
  const results = await deliverAuthMessage({ ...blocked.input, channel: NotificationChannel.EMAIL }, blocked.dependencies);
  assert.deepEqual([results[0].channel, results[0].status, results[0].code], [NotificationChannel.EMAIL, DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE]);
  assert.equal(blocked.calls.some(([type]) => type === "email"), false);
  assert.doesNotMatch(JSON.stringify(results), /private|012345/);
  const staff = fixture();
  const sent = await deliverAuthMessage({ ...staff.input, channel: NotificationChannel.EMAIL, municipalityId: null, user: { name: "Staff", role: "master" } }, staff.dependencies);
  assert.equal(sent[0].status, DeliveryStatus.SENT);
  assert.equal(staff.calls.some(([type]) => type === "quota"), false);
});

test("new phone verification cannot fall back to e-mail when WhatsApp is off and SMS is not used", async () => {
  const f = fixture();
  f.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const results = await deliverAuthMessage({ ...f.input, purpose: AuthPurpose.VERIFY_PHONE, phoneVerified: false }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(results[0].channel, NotificationChannel.WHATSAPP);
  assert.equal(results[0].code, DeliveryCode.CHANNEL_DISABLED);
  assert.equal(f.calls.some(([type]) => type === "email" || type === "quota"), false);
});

const PHONE_CODES = [AuthPurpose.VERIFY_PHONE];
const phoneInput = (f, purpose) => ({ ...f.input, purpose, phoneVerified: false, challengeId: "challenge", channel: undefined });
const smsSent = (f) => { const sent = []; f.dependencies.sendSms = async (value) => { sent.push(value); return { status: DeliveryStatus.SENT }; }; return sent; };

test("a phone code goes by WhatsApp and, when WhatsApp does not send, by SMS to the same phone", async () => {
  for (const purpose of PHONE_CODES) {
    const f = fixture(); const sent = smsSent(f);
    f.dependencies.loadWhatsappConfig = async () => ({ active: false });
    const results = await deliverAuthMessage(phoneInput(f, purpose), f.dependencies);
    assert.deepEqual(results.map(({ channel, status }) => [channel, status]), [[NotificationChannel.WHATSAPP, DeliveryStatus.SKIPPED], [NotificationChannel.SMS, DeliveryStatus.SENT]], purpose);
    assert.deepEqual(sent, [{ municipalityId: "municipality-a", use: purpose, phone: "48999999999", data: { code: "012345", minutes: "10" },
      messageId: "challenge", expiresAt: f.input.expiresAt }]);
    assert.equal(f.calls.some(([type]) => type === "email" || type === "quota" || type === "whatsapp"), false, purpose);
    assert.doesNotMatch(JSON.stringify(results), /012345|48999999999/);
  }
});

test("a phone code is sent once: SMS is not tried when WhatsApp sent, and is tried when WhatsApp failed", async () => {
  for (const purpose of PHONE_CODES) {
    const sent = fixture(); const smsAfterSent = smsSent(sent);
    assert.deepEqual((await deliverAuthMessage(phoneInput(sent, purpose), sent.dependencies)).map(({ channel }) => channel), [NotificationChannel.WHATSAPP]);
    assert.equal(smsAfterSent.length, 0, purpose);
    const failed = fixture(); const smsAfterFailure = smsSent(failed);
    failed.dependencies.sendWhatsapp = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.RATE_LIMITED, reason: "private provider body" });
    const results = await deliverAuthMessage(phoneInput(failed, purpose), failed.dependencies);
    assert.deepEqual(results.map(({ channel, status }) => [channel, status]), [[NotificationChannel.WHATSAPP, DeliveryStatus.FAILED], [NotificationChannel.SMS, DeliveryStatus.SENT]], purpose);
    assert.equal(smsAfterFailure.length, 1);
    assert.doesNotMatch(JSON.stringify(results), /private|012345/);
  }
});

test("a phone code whose SMS is switched off or fails never reaches e-mail, and an SMS exception is reported safely", async () => {
  for (const purpose of PHONE_CODES) {
    const off = fixture(); off.dependencies.loadWhatsappConfig = async () => ({ active: false });
    assert.deepEqual((await deliverAuthMessage(phoneInput(off, purpose), off.dependencies)).map(({ channel }) => channel), [NotificationChannel.WHATSAPP]);
    const failing = fixture(); failing.dependencies.loadWhatsappConfig = async () => ({ active: false });
    failing.dependencies.sendSms = async () => ({ status: DeliveryStatus.FAILED, code: DeliveryCode.INSUFFICIENT_BALANCE, reason: "private provider body" });
    const failed = await deliverAuthMessage(phoneInput(failing, purpose), failing.dependencies);
    assert.deepEqual([failed[1].channel, failed[1].status, failed[1].code], [NotificationChannel.SMS, DeliveryStatus.FAILED, DeliveryCode.INSUFFICIENT_BALANCE]);
    const throwing = fixture(); throwing.dependencies.loadWhatsappConfig = async () => ({ active: false });
    throwing.dependencies.sendSms = async () => { throw new Error("private credential"); };
    const thrown = await deliverAuthMessage(phoneInput(throwing, purpose), throwing.dependencies);
    assert.deepEqual([thrown[1].channel, thrown[1].status, thrown[1].code], [NotificationChannel.SMS, DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED]);
    for (const f of [off, failing, throwing]) assert.equal(f.calls.some(([type]) => type === "email"), false, purpose);
    assert.doesNotMatch(JSON.stringify([failed, thrown]), /private|012345/);
  }
});

test("a changed contact is told by the phone chain with e-mail as the reserve", async () => {
  const changed = fixture(); const changedSms = smsSent(changed); changed.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const results = await deliverAuthMessage({ ...changed.input, purpose: AuthPurpose.CONTACT_CHANGED, code: undefined, channel: undefined }, changed.dependencies);
  assert.equal(changedSms.length, 1); assert.equal(changedSms[0].use, AuthPurpose.CONTACT_CHANGED);
  assert.equal(changedSms[0].data.fields, "contato", "without the changed data the notice says contact");
  assert.deepEqual(results.map(({ channel }) => channel), [NotificationChannel.WHATSAPP, NotificationChannel.SMS]);
  assert.equal(changed.calls.some(([type]) => type === "email"), false);
  const reserve = fixture(); reserve.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const viaEmail = await deliverAuthMessage({ ...reserve.input, purpose: AuthPurpose.CONTACT_CHANGED, code: undefined, channel: undefined, changedFields: ["telefone"] }, reserve.dependencies);
  assert.deepEqual(viaEmail.map(({ channel }) => channel), [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL]);
  const params = reserve.calls.find(([type]) => type === "email")[1].templateParams;
  assert.equal(params.changed_fields, "telefone");
  assert.equal(params.message, "Seus dados cadastrais foram atualizados. Informações alteradas: telefone. Se você não reconhece essa alteração, entre em contato com nossa equipe.");
});

test("a municipal e-mail use that is switched off is skipped with the channel-disabled code and nothing is sent", async () => {
  const f = fixture();
  f.dependencies.resolveEmailTemplate = async () => ({ ok: false, code: DeliveryCode.CHANNEL_DISABLED });
  const results = await deliverAuthMessage({ ...f.input, channel: NotificationChannel.EMAIL, phone: "" }, f.dependencies);
  assert.equal(results.length, 1);
  assert.equal(results[0].channel, NotificationChannel.EMAIL);
  assert.equal(results[0].code, DeliveryCode.CHANNEL_DISABLED);
  assert.equal(f.calls.some(([type]) => type === "email" || type === "identity"), false);
});

test("the reset e-mail carries the municipality identity and keeps the variable names templates already use", async () => {
  const f = fixture();
  await deliverAuthMessage({ ...f.input, channel: NotificationChannel.EMAIL, phone: "" }, f.dependencies);
  const sent = f.calls.find(([type]) => type === "email")[1];
  assert.equal(sent.templateId, "email_password_reset");
  assert.deepEqual(f.calls.find(([type]) => type === "emailTemplate"), ["emailTemplate", "municipality-a", AuthPurpose.PASSWORD_RESET]);
  assert.deepEqual(f.calls.find(([type]) => type === "identity"), ["identity", "municipality-a"]);
  const { templateParams } = sent;
  assert.deepEqual([templateParams.code, templateParams.validade, templateParams.validity_minutes],
    ["012345", "10 minutos", "10"]);
  assert.equal(Object.hasOwn(templateParams, "codigo"), false);
  assert.equal(Object.hasOwn(templateParams, "codigo_recuperacao"), false);
  assert.deepEqual([templateParams.to_name, templateParams.purpose, templateParams.municipality_name], ["Tutor", AuthPurpose.PASSWORD_RESET, "Test Town"]);
  assert.equal(templateParams.subject, "Recuperação de senha");
  assert.equal(templateParams.message, "Use o código 012345 para redefinir sua senha. Válido por 10 minutos. Não compartilhe este código.");
});

test("a malformed or expired recovery code never reaches any provider", async () => {
  for (const channel of Object.values(NotificationChannel)) {
    for (const invalid of [{ code: "" }, { code: 123456 }, { code: "0123xx" }, { expiresAt: new Date(0) }]) {
      const f = fixture(); const sms = smsSent(f);
      const [result] = await deliverAuthMessage({ ...f.input, channel, ...invalid }, f.dependencies);
      assert.equal(result.code, DeliveryCode.PREPARATION_FAILED);
      assert.equal(result.channel, channel);
      assert.equal(f.calls.length + sms.length, 0);
    }
  }
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

test("trusted global staff reset uses the platform template, with no switch and no municipality identity", async () => {
  for (const role of ["master", "suporte"]) {
    const f = fixture();
    const results = await deliverAuthMessage({ ...f.input, channel: NotificationChannel.EMAIL, municipalityId: null, user: { name: "Staff", role } }, f.dependencies);
    assert.equal(results[0].status, DeliveryStatus.SENT);
    assert.equal(results[0].channel, NotificationChannel.EMAIL);
    assert.deepEqual(f.calls.map(([type]) => type), ["emailTemplate", "identity", "email"]);
    assert.deepEqual(f.calls[0], ["emailTemplate", null, AuthPurpose.PASSWORD_RESET]);
    assert.deepEqual(f.calls[1], ["identity", null]);
    assert.equal(f.calls[2][1].templateId, "email_password_reset");
  }
});

test("staff reset has no platform template when the master has not set one", async () => {
  const f = fixture();
  f.emailTemplates[AuthPurpose.PASSWORD_RESET] = "";
  const results = await deliverAuthMessage({ ...f.input, channel: NotificationChannel.EMAIL, municipalityId: null, user: { name: "Staff", role: "master" } }, f.dependencies);
  assert.equal(results[0].code, DeliveryCode.NOT_CONFIGURED);
  assert.equal(f.calls.some(([type]) => type === "email"), false);
});

test("absent municipality cannot select global fallback for tutors or other purposes", async () => {
  const f = fixture();
  assert.deepEqual(await deliverAuthMessage({ ...f.input, municipalityId: null, user: { role: "tutor" } }, f.dependencies), []);
  assert.deepEqual(await deliverAuthMessage({ ...f.input, municipalityId: null, purpose: AuthPurpose.VERIFY_EMAIL, user: { role: "master" } }, f.dependencies), []);
  assert.deepEqual(f.calls, []);
});

test("selected SMS invokes only the SMS use with the challenge binding and never email or WhatsApp", async () => {
  const f = fixture(); const sent = [];
  f.dependencies.sendSms = async (input) => { sent.push(input); return { status: DeliveryStatus.SENT, providerMessageId: "1", reference: input.messageId }; };
  const result = await deliverAuthMessage({ ...f.input, channel: NotificationChannel.SMS, challengeId: "challenge" }, f.dependencies);
  assert.deepEqual(sent, [{ municipalityId: "municipality-a", use: AuthPurpose.PASSWORD_RESET, phone: "48999999999", data: { code: "012345", minutes: "10" },
    messageId: "challenge", expiresAt: f.input.expiresAt }]);
  assert.deepEqual([result[0].status, result[0].channel, result[0].providerMessageId, result[0].reference], [DeliveryStatus.SENT, NotificationChannel.SMS, "1", "challenge"]);
  assert.deepEqual(f.calls, []);
  assert.doesNotMatch(JSON.stringify(result), /012345|48999999999|tutor@example/);
});

test("selected SMS reports a switched-off use as skipped, an expired code as not prepared, and is never offered to staff", async () => {
  const off = fixture();
  const skipped = await deliverAuthMessage({ ...off.input, channel: NotificationChannel.SMS, challengeId: "challenge" }, off.dependencies);
  assert.deepEqual([skipped.length, skipped[0].channel, skipped[0].status, skipped[0].code], [1, NotificationChannel.SMS, DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED]);
  const expired = fixture(); const sent = smsSent(expired);
  const late = await deliverAuthMessage({ ...expired.input, channel: NotificationChannel.SMS, expiresAt: new Date(Date.now() - 1000) }, expired.dependencies);
  assert.equal(late[0].code, DeliveryCode.PREPARATION_FAILED); assert.equal(sent.length, 0);
  const staff = fixture(); const staffSent = smsSent(staff);
  const refused = await deliverAuthMessage({ ...staff.input, channel: NotificationChannel.SMS, municipalityId: null, user: { name: "Staff", role: "master" } }, staff.dependencies);
  assert.equal(refused[0].code, DeliveryCode.CHANNEL_DISABLED); assert.equal(staffSent.length, 0);
});

test("recovery expiration during template or quota reads prevents starting email and WhatsApp transports", async (t) => {
  const originalNow = Date.now;
  let current = originalNow();
  Date.now = () => current;
  t.after(() => { Date.now = originalNow; });
  for (const delayed of ["email-template", "whatsapp-config", "whatsapp-quota"]) {
    const f = fixture();
    f.input.expiresAt = new Date(current + 100);
    f.input.channel = delayed === "email-template" ? NotificationChannel.EMAIL : NotificationChannel.WHATSAPP;
    if (delayed === "email-template") f.dependencies.resolveEmailTemplate = async () => { current += 101; return { ok: true, templateId: "template" }; };
    if (delayed === "whatsapp-config") f.dependencies.loadWhatsappConfig = async () => {
      current += 101; return { active: true, tokenVariable: "WHATSAPP_TOKEN_TEST", phoneNumberId: "test" };
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
  const sender = createEmailSender({ loadAccount: async () => ({ serviceId: "test", publicKey: "test", privateKey: "test" }),
    now: () => current, wait: async (delay) => { current += delay; }, fetchImpl: async () => { sends += 1; return { ok: true }; } });
  const input = { toEmail: "test@example.test", templateId: "test", templateParams: { code: "123456" } };
  assert.equal((await sender(input)).status, DeliveryStatus.SENT);
  assert.equal((await sender({ ...input, expiresAt: new Date(current + 250) })).code, DeliveryCode.PREPARATION_FAILED);
  assert.equal(sends, 1);
});

const accessCode = (overrides = {}) => ({ purpose: AuthPurpose.REQUEST_TRACKING, municipalityId: "municipality-a", user: {}, code: "123456",
  challengeId: "challenge", expiresAt: new Date(Date.now() + 600000), email: "", phone: "", ...overrides });

test("the access code goes only by the chosen channel, to the destination the use case resolved, without verified flags", async () => {
  const f = fixture();
  const email = await deliverAuthMessage(accessCode({ channel: NotificationChannel.EMAIL, email: "citizen@example.test" }), f.dependencies);
  assert.deepEqual(email, [{ purpose: AuthPurpose.REQUEST_TRACKING, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }]);
  const sent = f.calls.find(([type]) => type === "email")[1];
  assert.equal(sent.toEmail, "citizen@example.test");
  assert.equal(sent.templateId, "email_request_tracking");
  assert.equal(sent.templateParams.code, "123456");
  assert.equal(f.calls.some(([type, channel]) => type === "whatsapp" || type === "sms" || (type === "quota" && channel !== NotificationChannel.EMAIL)), false);

  const whatsapp = fixture();
  const phone = await deliverAuthMessage(accessCode({ channel: NotificationChannel.WHATSAPP, phone: "48999991234" }), whatsapp.dependencies);
  assert.deepEqual(phone, [{ purpose: AuthPurpose.REQUEST_TRACKING, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SENT }]);
  const call = whatsapp.calls.find(([type]) => type === "whatsapp");
  assert.equal(call[1].templateName, "whatsapp_request_tracking");
  assert.equal(call[3][0].parameters[0].text, "123456");
  assert.equal(whatsapp.calls.some(([type]) => type === "sms" || type === "email"), false);

  const sms = fixture(); const smsCalls = smsSent(sms);
  const text = await deliverAuthMessage(accessCode({ channel: NotificationChannel.SMS, phone: "48999991234" }), sms.dependencies);
  assert.deepEqual(text.map(({ channel, status }) => [channel, status]), [[NotificationChannel.SMS, DeliveryStatus.SENT]]);
  assert.deepEqual([smsCalls[0].use, smsCalls[0].phone, smsCalls[0].data.code, smsCalls[0].messageId], [AuthPurpose.REQUEST_TRACKING, "48999991234", "123456", "challenge"]);
  assert.equal(sms.calls.some(([type]) => type === "whatsapp" || type === "email"), false);
  assert.equal(JSON.stringify([email, phone, text]).includes("123456"), false);
});

test("the access code needs a six digit code, a chosen channel and a configured template", async () => {
  const f = fixture();
  for (const code of [undefined, "", "12345", "1234567", "12ab56"]) {
    const [result] = await deliverAuthMessage(accessCode({ channel: NotificationChannel.EMAIL, email: "citizen@example.test", code }), f.dependencies);
    assert.equal(result.code, DeliveryCode.PREPARATION_FAILED);
  }
  assert.deepEqual(await deliverAuthMessage(accessCode({ channel: undefined, email: "citizen@example.test" }), f.dependencies), []);
  assert.equal(f.calls.some(([type]) => type === "email" || type === "whatsapp" || type === "sms"), false);

  f.emailTemplates[AuthPurpose.REQUEST_TRACKING] = "";
  const [missing] = await deliverAuthMessage(accessCode({ channel: NotificationChannel.EMAIL, email: "citizen@example.test" }), f.dependencies);
  assert.equal(missing.code, DeliveryCode.NOT_CONFIGURED);
  assert.equal(f.calls.some(([type]) => type === "email"), false);
});

test("an access code whose WhatsApp is off never falls back to SMS or e-mail, nor reads the request follow-up", async () => {
  const f = fixture(); const smsCalls = smsSent(f);
  f.dependencies.loadWhatsappConfig = async () => ({ active: false });
  const results = await deliverAuthMessage(accessCode({ channel: NotificationChannel.WHATSAPP, phone: "48999991234",
    followUp: { enabled: true, email: "attacker@example.test" } }), f.dependencies);
  assert.equal(results.length, 1);
  assert.deepEqual([results[0].channel, results[0].code], [NotificationChannel.WHATSAPP, DeliveryCode.CHANNEL_DISABLED]);
  assert.equal(smsCalls.length, 0);
  assert.equal(f.calls.some(([type]) => type === "email"), false);
});
