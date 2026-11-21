import test from "node:test";
import assert from "node:assert/strict";
import { selectNotificationEvents } from "../src/services/notifications/notification-events.js";
import { NO_SHOW_CANCEL_REASON, NotificationEvent, REJECTED_CANCEL_REASON } from "../../shared/notification-contract.js";

test("confirmation and completion only notify on transitions", () => {
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, { status: "AGENDADA" }), [NotificationEvent.SCHEDULE_CONFIRMED]);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, { status: "AGENDADA" }), []);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, { status: "REALIZADA" }), [NotificationEvent.COMPLETED]);
  assert.deepEqual(selectNotificationEvents({ status: "REALIZADA" }, { status: "REALIZADA", notes: "updated" }), []);
});

test("only a no-show of a scheduled request notifies; any other cancellation, or one of an unscheduled request, does not", () => {
  const noShow = { status: "CANCELADA", workflow_data: { cancelReason: NO_SHOW_CANCEL_REASON } };
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, noShow), [NotificationEvent.NO_SHOW]);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, { status: "CANCELADA", workflow_data: { cancelReason: "Cancelado" } }), []);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, { status: "CANCELADA" }), []);
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, noShow), []);
  assert.deepEqual(selectNotificationEvents({ status: "CANCELADA" }, { status: "CANCELADA", notes: "updated" }), []);
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, { status: "CANCELADA" }), []);
  assert.deepEqual(selectNotificationEvents({ status: "REALIZADA" }, { status: "CANCELADA" }), []);
});

test("a rejection notifies once, whether the request was new or scheduled; another cancellation or a later edit does not", () => {
  const rejected = { status: "CANCELADA", workflow_data: { cancelReason: REJECTED_CANCEL_REASON } };
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, rejected), [NotificationEvent.REQUEST_REJECTED]);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, rejected), [NotificationEvent.REQUEST_REJECTED]);
  assert.deepEqual(selectNotificationEvents(rejected, { ...rejected, notes: "updated" }), []);
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, { status: "CANCELADA", workflow_data: { cancelReason: "Cancelado" } }), []);
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, { status: "NOVA", workflow_data: { cancelReason: REJECTED_CANCEL_REASON } }), []);
});

test("real schedule changes include date, time and place, but not assignment or notes", () => {
  const scheduled = { status: "AGENDADA", schedule_date: "2026-11-20", workflow_data: { scheduleTime: "08:00" } };
  for (const change of [{ schedule_date: "2026-11-21" }, { workflow_data: { scheduleTime: "09:00" } }, { schedule_location_name: "New venue" }, { schedule_address: "New address" }]) {
    assert.deepEqual(selectNotificationEvents(scheduled, { ...scheduled, ...change }), [NotificationEvent.SCHEDULE_CHANGED]);
  }
  assert.deepEqual(selectNotificationEvents(scheduled, { ...scheduled, responsible: "analyst", notes: "note" }), []);
  assert.deepEqual(selectNotificationEvents({ ...scheduled, status: "NOVA" }, { ...scheduled, status: "NOVA", schedule_date: "2026-11-21" }), []);
});

const attachment = (attachmentId, documentId = "identity", fields = {}) => ({ attachmentId, documentId, status: "attached", ...fields });
const decision = (document, status) => ({ ...document, status, review: { decision: status } });

test("a mixed review emits only one notice for each new result, even with repeated document types", () => {
  const documents = [attachment("identity-a"), attachment("identity-b"), attachment("address", "address"), attachment("other", "other")];
  const reviewed = documents.map((document, index) => decision(document, index < 2 ? "approved" : "rejected"));
  assert.deepEqual(selectNotificationEvents({ documents }, { documents: reviewed }), [NotificationEvent.DOCUMENTS_APPROVED, NotificationEvent.DOCUMENTS_REJECTED]);
  assert.deepEqual(selectNotificationEvents({ documents: reviewed }, { documents: reviewed.toReversed() }), []);
});

test("deciding one attachment does not send notices about existing decisions on other attachments", () => {
  const approved = decision(attachment("previous-approval"), "approved");
  const rejected = decision(attachment("previous-rejection"), "rejected");
  const pending = attachment("pending");
  const before = { documents: [approved, pending, rejected] };
  assert.deepEqual(selectNotificationEvents(before, { documents: [rejected, decision(pending, "approved"), approved] }), [NotificationEvent.DOCUMENTS_APPROVED]);
  assert.deepEqual(selectNotificationEvents(before, { documents: [approved, decision(pending, "rejected"), rejected] }), [NotificationEvent.DOCUMENTS_REJECTED]);
});

test("uploads, statuses without a recorded decision, evidence and photos send no document notice", () => {
  const pending = attachment("old-file");
  const ignored = [attachment("evidence", "another-type", { internalEvidence: true }), attachment("animal-photo", "animal_photo"),
    attachment("complaint-photo", "complaint_photo_1"), attachment("system", "requerimento-pedido")];
  assert.deepEqual(selectNotificationEvents({ documents: [pending, ...ignored] }, { documents: [
    { ...pending, status: "approved" }, decision(attachment("another-file"), "approved"),
    ...ignored.map((document) => decision(document, "rejected")),
  ] }), []);
});

test("a review and an attendance transition remain distinct events", () => {
  const document = decision(attachment("same-file"), "rejected");
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA", documents: [document] }, {
    status: "REALIZADA", documents: [decision(document, "approved")],
  }), [NotificationEvent.DOCUMENTS_APPROVED, NotificationEvent.COMPLETED]);
});

test("malformed legacy document entries do not suppress an agenda event", () => {
  assert.deepEqual(selectNotificationEvents({ status: "NOVA", documents: [null, "invalid"] }, {
    status: "AGENDADA", documents: [null, "invalid"],
  }), [NotificationEvent.SCHEDULE_CONFIRMED]);
});
