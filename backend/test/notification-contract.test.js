import test from "node:test";
import assert from "node:assert/strict";
import * as notificationContract from "../../shared/notification-contract.js";
import { normalizeFollowUp, validateFollowUp, configsAllowStep, NotificationEvent } from "../../shared/notification-contract.js";

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
  assert.deepEqual(normalizeFollowUp({ enabled: false, email: "stored@example.com", phone: "48999999999" }, { phoneEnabled: true }), {
    enabled: false, email: "", phone: "",
  });
});

test("phone is optional and is accepted only when the municipality has a phone channel (WhatsApp or SMS)", () => {
  assert.equal(validateFollowUp({ enabled: true, email: "a@example.com" }, { phoneEnabled: true }), "");
  assert.throws(() => normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "123" }, { phoneEnabled: true }), { status: 400 });
  assert.deepEqual(normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "(48) 99999-9999" }, { phoneEnabled: true }), {
    enabled: true, email: "a@example.com", phone: "48999999999",
  });
  assert.equal(normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "hidden" }).phone, "");
  assert.equal(normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "(48) 99999-9999" }, { phoneEnabled: false }).phone, "");
  assert.equal(validateFollowUp({ enabled: true, email: "a@example.com", phone: "123" }, { phoneEnabled: false }), "");
});

test("the old channel option and its configuration no longer exist in the contract", () => {
  for (const name of ["NOTIFICATIONS_CONFIG_KEY", "buildDefaultNotificationConfig", "normalizeNotificationConfig", "validateNotificationConfig"]) {
    assert.equal(name in notificationContract, false, name);
  }
});

test("the no-show event exists next to the other agenda events, and the old cancellation is gone", () => {
  assert.equal(NotificationEvent.NO_SHOW, "no_show");
  assert.equal("SCHEDULE_CANCELLED" in NotificationEvent, false);
  assert.equal(Object.values(NotificationEvent).length, 5);
});

test("step configuration shares the explicit-false combination rule", () => {
  assert.equal(configsAllowStep([null, {}, { stepTutor: true }], "stepTutor"), true);
  assert.equal(configsAllowStep([{ stepTutor: true }, { stepTutor: false }], "stepTutor"), false);
  assert.equal(configsAllowStep([], "stepTutor"), true);
});
