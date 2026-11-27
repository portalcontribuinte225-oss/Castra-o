import test from "node:test";
import assert from "node:assert/strict";
import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../shared/notification-contract.js";
import { ProcedureStatus } from "../../shared/request-procedure-contract.js";
import { RequestStatus } from "../../shared/request-contract.js";
import { sendProcedureReminders } from "../src/services/notifications/procedure-reminders.js";

const EVENT = NotificationEvent.SCHEDULE_REMINDER;
const TOMORROW = "2026-11-28";
const TODAY = "2026-11-27";
const followUp = { enabled: true, phone: "48999999999", email: "tutor@example.com" };

function scheduledRequest(id, overrides = {}) {
  return {
    id, municipality_id: "municipality-a", protocol: "123/2026", status: RequestStatus.SCHEDULED, request_type: "Castração",
    schedule_date: "28/11/2026", schedule_location_name: "Unidade A", workflow_data: { followUp, scheduleSlotTime: "09:00" },
    ...overrides,
  };
}

function procedure(requestTypeId, status, date, slotTime) {
  return { requestTypeId, status, schedule: { date, slotTime, locationName: "Unidade B" } };
}

test("only confirmed visits tomorrow are sent, grouped by appointment and persisted before dispatch", async () => {
  const confirmed = [procedure("first", ProcedureStatus.SCHEDULED, TOMORROW, "09:00"),
    procedure("second", ProcedureStatus.SCHEDULED, TOMORROW, "09:00"),
    procedure("third", ProcedureStatus.SCHEDULED, TOMORROW, "15:00")];
  const excluded = [procedure("waiting", ProcedureStatus.WAITING, TOMORROW, "10:00"),
    procedure("done", ProcedureStatus.DONE, TOMORROW, "11:00"),
    procedure("today", ProcedureStatus.SCHEDULED, TODAY, "13:00")];
  const procedures = [...confirmed, ...excluded];
  const requests = [
    scheduledRequest("legacy"),
    scheduledRequest("procedures", { schedule_date: TODAY,
      animals: [{ requestTypeIds: procedures.map(({ requestTypeId }) => requestTypeId), procedures }] }),
    scheduledRequest("opted-out", { workflow_data: { followUp: { ...followUp, enabled: false } } }),
    scheduledRequest("unconfirmed", { status: RequestStatus.NEW }),
    scheduledRequest("today", { schedule_date: TODAY }),
  ];
  const attempts = new Map();
  const sent = [];
  const history = [];
  const dependencies = {
    requests: () => requests.map((request) => ({ ...request, workflow_data: { ...request.workflow_data,
      notificationDispatches: { [EVENT]: attempts.get(request.id) } } })),
    claim: async (request, previous, next) => {
      if (attempts.get(request.id) !== previous) return false;
      attempts.set(request.id, next);
      return true;
    },
    dispatch: async ({ event, request }) => {
      assert.equal(event, EVENT);
      assert.equal(attempts.get(request.id).date, TOMORROW);
      sent.push([request.id, request.schedule_date, request.workflow_data.scheduleSlotTime, request.schedule_location_name]);
      return [{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }];
    },
    appendHistory: async (entries, id, municipalityId) => history.push([id, municipalityId, entries[0].notification.event]),
  };

  await Promise.all([sendProcedureReminders(TOMORROW, dependencies), sendProcedureReminders(TOMORROW, dependencies)]);
  await sendProcedureReminders(TOMORROW, dependencies);

  assert.deepEqual(sent, [
    ["legacy", TOMORROW, "09:00", "Unidade A"],
    ["procedures", TOMORROW, "09:00", "Unidade B"],
    ["procedures", TOMORROW, "15:00", "Unidade B"],
  ]);
  assert.deepEqual(history, sent.map(([id]) => [id, "municipality-a", EVENT]));
});
