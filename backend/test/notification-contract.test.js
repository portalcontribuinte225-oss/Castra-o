import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultNotificationConfig, normalizeNotificationConfig, validateNotificationConfig, normalizeFollowUp, validateFollowUp, configsAllowStep, NotificationEvent } from "../../shared/notification-contract.js";

test("follow-up requires a real boolean and valid required e-mail", () => {
  for (const input of [undefined, null, [], {}, { enabled: "false" }, { enabled: true }, { enabled: true, email: "bad" }]) {
    assert.ok(validateFollowUp(input));
    assert.throws(() => normalizeFollowUp(input), { status: 400 });
  }
  assert.deepEqual(normalizeFollowUp({ enabled: true, email: " Citizen@Example.com " }), {
    enabled: true, email: "citizen@example.com", phone: "",
  });
});

test("declining follow-up clears contacts without inferring consent", () => {
  assert.deepEqual(normalizeFollowUp({ enabled: false, email: "stored@example.com", phone: "48999999999" }, { whatsappEnabled: true }), {
    enabled: false, email: "", phone: "",
  });
});

test("phone is optional and is accepted only when the municipality enables it", () => {
  assert.equal(validateFollowUp({ enabled: true, email: "a@example.com" }, { whatsappEnabled: true }), "");
  assert.throws(() => normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "123" }, { whatsappEnabled: true }), { status: 400 });
  assert.deepEqual(normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "(48) 99999-9999" }, { whatsappEnabled: true }), {
    enabled: true, email: "a@example.com", phone: "48999999999",
  });
  assert.equal(normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "hidden" }).phone, "");
});

test("notification settings keep e-mail on and SMS off and strip untrusted fields", () => {
  const settings = normalizeNotificationConfig({ emailEnabled: false, smsEnabled: true, accessToken: "secret", emailTemplateId: " notice ", whatsappTemplates: { [NotificationEvent.COMPLETED]: " done ", arbitrary: "private" } });
  assert.equal(settings.emailEnabled, true);
  assert.equal(settings.smsEnabled, false);
  assert.equal(settings.emailTemplateId, "notice");
  assert.equal(settings.whatsappTemplates[NotificationEvent.COMPLETED], "done");
  assert.equal(JSON.stringify(settings).includes("secret"), false);
  assert.equal(Object.hasOwn(settings.whatsappTemplates, "arbitrary"), false);
  assert.deepEqual(normalizeNotificationConfig(null), buildDefaultNotificationConfig());
  for (const invalid of [{ emailEnabled: false }, { smsEnabled: true }, { emailTemplateId: {} }, { whatsappTemplates: [] }, { whatsappTemplates: { arbitrary: "template" } }]) {
    assert.ok(validateNotificationConfig(invalid));
  }
  assert.equal(validateNotificationConfig(settings), "");
});

test("step configuration shares the explicit-false combination rule", () => {
  assert.equal(configsAllowStep([null, {}, { stepTutor: true }], "stepTutor"), true);
  assert.equal(configsAllowStep([{ stepTutor: true }, { stepTutor: false }], "stepTutor"), false);
  assert.equal(configsAllowStep([], "stepTutor"), true);
});
