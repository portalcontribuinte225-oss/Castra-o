import test from "node:test";
import assert from "node:assert/strict";
import { selectNotificationEvents } from "../src/services/notifications/notification-events.js";
import { NotificationEvent } from "../../shared/notification-contract.js";

test("confirmation and completion only notify on transitions", () => {
  assert.deepEqual(selectNotificationEvents({ status: "NOVA" }, { status: "AGENDADA" }), [NotificationEvent.SCHEDULE_CONFIRMED]);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, { status: "AGENDADA" }), []);
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA" }, { status: "REALIZADA" }), [NotificationEvent.COMPLETED]);
  assert.deepEqual(selectNotificationEvents({ status: "REALIZADA" }, { status: "REALIZADA", notes: "updated" }), []);
});

test("real schedule changes include date, time and place, but not assignment or notes", () => {
  const scheduled = { status: "AGENDADA", schedule_date: "2026-11-20", workflow_data: { scheduleTime: "08:00" } };
  for (const change of [{ schedule_date: "2026-11-21" }, { workflow_data: { scheduleTime: "09:00" } }, { schedule_location_name: "New venue" }, { schedule_address: "New address" }]) {
    assert.deepEqual(selectNotificationEvents(scheduled, { ...scheduled, ...change }), [NotificationEvent.SCHEDULE_CHANGED]);
  }
  assert.deepEqual(selectNotificationEvents(scheduled, { ...scheduled, responsible: "analyst", notes: "note" }), []);
  assert.deepEqual(selectNotificationEvents({ ...scheduled, status: "NOVA" }, { ...scheduled, status: "NOVA", schedule_date: "2026-11-21" }), []);
});

test("document decisions are grouped and do not fire for initial uploads or evidence", () => {
  const documents = [{ documentId: "identity", status: "attached" }, { documentId: "address", status: "attached" }];
  const reviewed = documents.map((document, index) => ({ ...document, status: index ? "rejected" : "approved" }));
  assert.deepEqual(selectNotificationEvents({ documents }, { documents: reviewed }), [NotificationEvent.DOCUMENTS_REVIEWED]);
  assert.deepEqual(selectNotificationEvents({ documents: reviewed }, { documents: reviewed }), []);
  assert.deepEqual(selectNotificationEvents({ documents: [] }, { documents: reviewed }), []);
  assert.deepEqual(selectNotificationEvents({ documents }, { documents: [...documents, { documentId: "evidence", status: "attached" }] }), []);
});

test("a review and an attendance transition remain distinct events", () => {
  const document = { documentId: "identity", status: "rejected" };
  assert.deepEqual(selectNotificationEvents({ status: "AGENDADA", documents: [document] }, {
    status: "REALIZADA", documents: [{ ...document, status: "approved" }],
  }), [NotificationEvent.DOCUMENTS_REVIEWED, NotificationEvent.COMPLETED]);
});

test("malformed legacy document entries do not suppress an agenda event", () => {
  assert.deepEqual(selectNotificationEvents({ status: "NOVA", documents: [null, "invalid"] }, {
    status: "AGENDADA", documents: [null, "invalid"],
  }), [NotificationEvent.SCHEDULE_CONFIRMED]);
});
