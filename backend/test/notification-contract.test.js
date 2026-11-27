import test from "node:test";
import assert from "node:assert/strict";
import * as notificationContract from "../../shared/notification-contract.js";
import {
  normalizeFollowUp, validateFollowUp, NotificationEvent, OTHER_REJECTION_REASON, REJECTED_CANCEL_REASON, REJECTION_REASONS, rejectionReasonText,
} from "../../shared/notification-contract.js";

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

test("the phone is accepted only when the municipality has a phone channel (WhatsApp or SMS), and must be a mobile", () => {
  assert.equal(validateFollowUp({ enabled: true, email: "a@example.com" }, { phoneEnabled: true }), "");
  assert.throws(() => normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "(48) 3333-4444" }, { phoneEnabled: true }), { status: 400, message: /celular/ });
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

test("the request events distinguish cancellation, a no-show and a rejection, and the review of documents is not one of them", () => {
  assert.equal(NotificationEvent.NO_SHOW, "no_show");
  assert.equal(NotificationEvent.REQUEST_REJECTED, "request_rejected");
  assert.equal(NotificationEvent.REQUEST_REGISTERED, "request_registered");
  assert.equal(NotificationEvent.SCHEDULE_CANCELLED, "schedule_cancelled");
  assert.equal(Object.values(NotificationEvent).some((event) => event.startsWith("documents_")), false);
  assert.equal(Object.values(NotificationEvent).length, 7);
});

test("the tutor is told the reason the staff chose, never the internal note, and nothing when the reason says nothing", () => {
  assert.equal(rejectionReasonText({ rejectionReason: "Documentação incompleta", rejectionNote: "internal note" }), "Documentação incompleta");
  for (const workflow of [undefined, null, {}, { rejectionReason: "" }, { rejectionReason: "   " }, { rejectionReason: OTHER_REJECTION_REASON },
    { rejectionReason: REJECTED_CANCEL_REASON }, { rejectionReason: 7 }, { rejectionNote: "internal note" }]) {
    assert.equal(rejectionReasonText(workflow), "", JSON.stringify(workflow));
  }
  assert.equal(rejectionReasonText({ rejectionReason: "  two   words \n" }), "two words");
  assert.equal(rejectionReasonText({ rejectionReason: "x".repeat(200) }).length, 60);
  assert.ok(REJECTION_REASONS.includes(OTHER_REJECTION_REASON));
  assert.equal(new Set(REJECTION_REASONS).size, REJECTION_REASONS.length);
});

test("accepting the follow-up needs at least one contact that can be reached: an e-mail, or a mobile when there is a phone channel", () => {
  const phoneEnabled = { phoneEnabled: true };
  assert.deepEqual(normalizeFollowUp({ enabled: true, phone: "(48) 99999-1234" }, phoneEnabled), { enabled: true, email: "", phone: "48999991234" });
  assert.deepEqual(normalizeFollowUp({ enabled: true, email: "a@example.com", phone: "(48) 99999-1234" }, phoneEnabled), { enabled: true, email: "a@example.com", phone: "48999991234" });
  for (const input of [{ enabled: true }, { enabled: true, email: "", phone: "" }, { enabled: true, email: null, phone: null }]) {
    assert.match(validateFollowUp(input, phoneEnabled), /ao menos um contato/, JSON.stringify(input));
  }
  assert.match(validateFollowUp({ enabled: true, phone: "(48) 99999-1234" }), /ao menos um contato/, "a phone alone is nothing without a phone channel");
  assert.match(validateFollowUp({ enabled: true, email: "bad", phone: "(48) 99999-1234" }, phoneEnabled), /e-mail/, "a contact that is given must be valid");
  assert.equal(validateFollowUp({ enabled: false }, phoneEnabled), "");
});

test("the usable contacts of a follow-up come back empty when they cannot be reached", () => {
  const { followUpContacts } = notificationContract;
  assert.deepEqual(followUpContacts({ email: " A@Example.com ", phone: "(48) 99999-1234" }, { phoneEnabled: true }), { email: "a@example.com", phone: "48999991234" });
  assert.deepEqual(followUpContacts({ email: "a@example.com", phone: "(48) 99999-1234" }), { email: "a@example.com", phone: "" });
  assert.deepEqual(followUpContacts({ email: "bad", phone: "(48) 3333-4444" }, { phoneEnabled: true }), { email: "", phone: "" });
  assert.deepEqual(followUpContacts(undefined, { phoneEnabled: true }), { email: "", phone: "" });
  assert.deepEqual(followUpContacts({ email: "x".repeat(250) + "@a.co", phone: 48999991234 }, { phoneEnabled: true }), { email: "", phone: "" });
});
