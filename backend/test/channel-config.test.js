import test from "node:test";
import assert from "node:assert/strict";
import { AUTH_DELIVERY_CONFIG_KEY, buildDefaultAuthDeliveryConfig, mergeAuthDeliveryConfig } from "../../shared/auth-contract.js";
import { NOTIFICATIONS_CONFIG_KEY, buildDefaultNotificationConfig, mergeNotificationConfig } from "../../shared/notification-contract.js";
import { EMAIL_SETTINGS_PERMISSION, normalizeEmailStatus } from "../../shared/email-contract.js";
import { isChannelConfigKey, lockChannelConfig, mergeChannelConfig } from "../src/repositories/channel-config.js";
import { getEmailIntegrationStatus } from "../src/services/email.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";

function fakeDatabase(storedValue) {
  const calls = [];
  return { calls, query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: storedValue === undefined || !sql.includes("SELECT value FROM config") ? [] : [{ value: storedValue }] };
  } };
}

test("auth delivery merge changes only the patched template and keeps the other channel", () => {
  const stored = buildDefaultAuthDeliveryConfig();
  stored.emailTemplates.password_reset = "reset_email";
  stored.whatsappTemplates.initial_password = "welcome_whatsapp";
  const merged = mergeAuthDeliveryConfig(stored, { emailTemplates: { initial_password: " welcome_email " } });
  assert.equal(merged.emailTemplates.initial_password, "welcome_email");
  assert.equal(merged.emailTemplates.password_reset, "reset_email");
  assert.equal(merged.whatsappTemplates.initial_password, "welcome_whatsapp");
  assert.equal(mergeAuthDeliveryConfig(stored, { emailTemplates: { password_reset: "" } }).emailTemplates.password_reset, "");
});

test("auth delivery merge starts from defaults and drops unknown purposes and channels", () => {
  const merged = mergeAuthDeliveryConfig(undefined, { emailTemplates: { arbitrary: "wrong" }, smsTemplates: { initial_password: "wrong" } });
  assert.deepEqual(merged, buildDefaultAuthDeliveryConfig());
  assert.deepEqual(mergeAuthDeliveryConfig(null, undefined), buildDefaultAuthDeliveryConfig());
});

test("notification merge keeps omitted fields and merges WhatsApp templates per event", () => {
  const stored = { emailTemplateId: "notify_email", whatsappTemplates: { completed: "done" } };
  const merged = mergeNotificationConfig(stored, { whatsappTemplates: { schedule_changed: "changed" } });
  assert.equal(merged.emailTemplateId, "notify_email");
  assert.equal(merged.whatsappTemplates.completed, "done");
  assert.equal(merged.whatsappTemplates.schedule_changed, "changed");
  assert.equal(mergeNotificationConfig(stored, { emailTemplateId: "other" }).whatsappTemplates.completed, "done");
});

test("notification merge keeps e-mail on, SMS off and strips untrusted fields", () => {
  const merged = mergeNotificationConfig({ emailEnabled: false, smsEnabled: true, accessToken: "never-stored" }, {
    emailEnabled: false, smsEnabled: true, accessToken: "never-stored", whatsappTemplates: { accessToken: "never-stored", unknown_event: "x" },
  });
  assert.deepEqual(merged, { ...buildDefaultNotificationConfig(), emailEnabled: true, smsEnabled: false });
  assert.equal(JSON.stringify(merged).includes("never-stored"), false);
});

test("only authentication and notification configuration are channel configuration", () => {
  assert.equal(isChannelConfigKey(AUTH_DELIVERY_CONFIG_KEY), true);
  assert.equal(isChannelConfigKey(NOTIFICATIONS_CONFIG_KEY), true);
  for (const key of ["whatsapp", "whatsapp_quota", "ai", "castragestao:sms", "", undefined]) assert.equal(isChannelConfigKey(key), false);
});

test("channel locks are scoped by key and municipality", async () => {
  const database = fakeDatabase();
  await lockChannelConfig(database, NOTIFICATIONS_CONFIG_KEY, MUNICIPALITY_ID);
  assert.equal(database.calls.length, 1);
  assert.match(database.calls[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(database.calls[0].values, [`channel-config:${NOTIFICATIONS_CONFIG_KEY}:${MUNICIPALITY_ID}`]);
});

test("channel merge reads the municipal row with a row lock and merges the right contract", async () => {
  const notifications = fakeDatabase({ emailTemplateId: "notify_email" });
  const savedNotifications = await mergeChannelConfig(notifications, NOTIFICATIONS_CONFIG_KEY, MUNICIPALITY_ID, { whatsappTemplates: { completed: "done" } });
  assert.match(notifications.calls[0].sql, /FOR UPDATE/);
  assert.deepEqual(notifications.calls[0].values, [NOTIFICATIONS_CONFIG_KEY, MUNICIPALITY_ID]);
  assert.equal(savedNotifications.emailTemplateId, "notify_email");
  assert.equal(savedNotifications.whatsappTemplates.completed, "done");

  const auth = fakeDatabase({ whatsappTemplates: { initial_password: "welcome_whatsapp" } });
  const savedAuth = await mergeChannelConfig(auth, AUTH_DELIVERY_CONFIG_KEY, MUNICIPALITY_ID, { emailTemplates: { initial_password: "welcome_email" } });
  assert.deepEqual(auth.calls[0].values, [AUTH_DELIVERY_CONFIG_KEY, MUNICIPALITY_ID]);
  assert.equal(savedAuth.whatsappTemplates.initial_password, "welcome_whatsapp");
  assert.equal(savedAuth.emailTemplates.initial_password, "welcome_email");
});

test("channel merge falls back to defaults when the municipality has no stored row", async () => {
  const saved = await mergeChannelConfig(fakeDatabase(), AUTH_DELIVERY_CONFIG_KEY, MUNICIPALITY_ID, { emailTemplates: { initial_password: "welcome_email" } });
  assert.equal(saved.emailTemplates.initial_password, "welcome_email");
  assert.equal(saved.whatsappTemplates.initial_password, "");
});

test("e-mail integration status reports presence only and treats blanks as missing", () => {
  assert.deepEqual(getEmailIntegrationStatus({}), { serviceConfigured: false, publicKeyConfigured: false, privateKeyConfigured: false, recoveryTemplateConfigured: false });
  const status = getEmailIntegrationStatus({
    EMAILJS_SERVICE_ID: "service-secret-value", EMAILJS_PUBLIC_KEY: "public-secret-value", EMAILJS_PRIVATE_KEY: "", EMAILJS_TEMPLATE_ID: "template-secret-value",
  });
  assert.deepEqual(status, { serviceConfigured: true, publicKeyConfigured: true, privateKeyConfigured: false, recoveryTemplateConfigured: true });
  assert.equal(JSON.stringify(status).includes("secret-value"), false);
});

test("e-mail status normalization accepts only real booleans and drops other fields", () => {
  assert.deepEqual(normalizeEmailStatus({ serviceConfigured: true, publicKeyConfigured: "true", privateKeyConfigured: 1, accessToken: "never-stored" }), {
    serviceConfigured: true, publicKeyConfigured: false, privateKeyConfigured: false, recoveryTemplateConfigured: false,
  });
  assert.deepEqual(normalizeEmailStatus(null), normalizeEmailStatus({}));
  assert.equal(EMAIL_SETTINGS_PERMISSION, "email_settings");
});
