import test from "node:test";
import assert from "node:assert/strict";
import { notifyRequestChanges } from "../src/services/request-change-notifications.js";
import { NotificationEvent, NotificationChannel, DeliveryStatus } from "../../shared/notification-contract.js";
import { ProcedureAction, ProcedureStatus } from "../../shared/request-procedure-contract.js";

const before = { id: "request-a", municipality_id: "municipality-a", status: "NOVA", workflow_data: { followUp: { enabled: true, email: "private@example.com" } } };
const after = () => ({ ...structuredClone(before), status: "AGENDADA", history: [] });
const dependencies = (overrides = {}) => ({
  dispatch: async ({ event }) => [{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }],
  appendHistory: async () => {},
  ...overrides,
});

test("notifications persist structured results and only append history within the request municipality", async () => {
  const request = after();
  const dispatched = [];
  const result = await notifyRequestChanges(before, request, dependencies({ dispatch: async (input) => {
    dispatched.push(input);
    return [{ event: input.event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }];
  }, appendHistory: async (entries, id, municipalityId) => {
    assert.equal(id, before.id);
    assert.equal(municipalityId, before.municipality_id);
    assert.equal(entries[0].notification.event, NotificationEvent.SCHEDULE_CONFIRMED);
    assert.doesNotMatch(JSON.stringify(entries), /private@example.com/);
  } }));
  assert.equal(result[0].status, DeliveryStatus.SENT);
  assert.equal(request.history.length, 1);
  assert.deepEqual(dispatched.map(({ event, request: sent }) => [event, sent === request]), [[NotificationEvent.SCHEDULE_CONFIRMED, true]]);
  assert.deepEqual(Object.keys(dispatched[0]).sort(), ["event", "request"], "the dispatcher reads the channels itself and gets no settings");
});

test("a notice that cannot be prepared is recorded as failed without exposing the error, instead of rejecting the saved operation", async () => {
  let recorded = false;
  const result = await notifyRequestChanges(before, after(), dependencies({
    dispatch: async () => { throw new Error("secret DB URL"); },
    appendHistory: async (entries) => { recorded = true; assert.equal(entries[0].notification.status, DeliveryStatus.FAILED); },
  }));
  assert.equal(recorded, true);
  assert.equal(result[0].channel, NotificationChannel.EMAIL);
  assert.doesNotMatch(JSON.stringify(result), /secret DB/);
});

test("a result for each channel in use is recorded, and a notice no channel uses leaves no history entry", async () => {
  const entries = [];
  const dispatch = async ({ event }) => [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP, NotificationChannel.SMS].map((channel) => ({ event, channel, status: DeliveryStatus.SENT }));
  const result = await notifyRequestChanges(before, after(), dependencies({ dispatch, appendHistory: async (recorded) => { entries.push(...recorded); } }));
  assert.deepEqual(result.map(({ channel }) => channel), [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP, NotificationChannel.SMS]);
  assert.match(entries.map(({ notes }) => notes).join("|"), /E-mail.*WhatsApp.*SMS/);
  let appended = false;
  const none = await notifyRequestChanges(before, after(), dependencies({ dispatch: async () => [], appendHistory: async () => { appended = true; } }));
  assert.deepEqual(none, []);
  assert.equal(appended, false);
});

test("provider exceptions and history failure cannot reject an already committed change", async () => {
  const result = await notifyRequestChanges(before, after(), dependencies({
    dispatch: async () => { throw new Error("sensitive provider error"); },
    appendHistory: async () => { throw new Error("database unavailable"); },
  }));
  assert.equal(result.length, 2);
  assert.equal(result[0].status, DeliveryStatus.FAILED);
  assert.doesNotMatch(JSON.stringify(result), /sensitive|database unavailable/);
});

test("refusal bypasses every channel even if other contact fields exist", async () => {
  const request = { ...after(), tutor_email: "private@example.com", phone: "48999991234", workflow_data: { followUp: { enabled: false } } };
  const result = await notifyRequestChanges(before, request, dependencies({ dispatch: async () => assert.fail("no dispatch after refusal") }));
  assert.deepEqual(result, []);
});

test("a request without follow-up sends no notice", async () => {
  const withoutFollowUp = { ...before, workflow_data: {} };
  for (const status of ["AGENDADA", "REALIZADA"]) {
    const result = await notifyRequestChanges(withoutFollowUp, { ...withoutFollowUp, status },
      dependencies({ dispatch: async () => assert.fail("no notice without follow-up") }));
    assert.deepEqual(result, []);
  }
});

test("unchanged state never sends a repeated notification", async () => {
  const result = await notifyRequestChanges(after(), after(), dependencies({ dispatch: async () => assert.fail("no repeated send") }));
  assert.deepEqual(result, []);
});

test("group confirmation and rescheduling each send one notice with the saved appointment", async () => {
  for (const [action, event] of [[ProcedureAction.CONFIRM_SCHEDULE, NotificationEvent.SCHEDULE_CONFIRMED], [ProcedureAction.RESCHEDULE, NotificationEvent.SCHEDULE_CHANGED]]) {
    const request = { ...after(), schedule_date: "2026-11-30", schedule_location_name: "Unidade B", animal_name: "Luna",
      workflow_data: { ...after().workflow_data, scheduleSlotTime: "09:15" } };
    const results = await notifyRequestChanges(before, request, dependencies({ procedureAction: action, dispatch: async (notice) => {
      assert.equal(notice.event, event);
      assert.equal(notice.request.schedule_date, "2026-11-30");
      assert.equal(notice.request.schedule_location_name, "Unidade B");
      assert.equal(notice.request.workflow_data.scheduleSlotTime, "09:15");
      return [{ event, channel: NotificationChannel.SMS, status: DeliveryStatus.SENT }];
    } }));
    assert.equal(results.length, 1);
  }
});

test("replacing an unavailable reservation before confirmation sends no agenda notice", async () => {
  const pending = { ...before, schedule_date: "2026-12-03" };
  const results = await notifyRequestChanges(before, pending, dependencies({ procedureAction: ProcedureAction.RESCHEDULE,
    dispatch: async () => assert.fail("the new reservation still needs confirmation"),
  }));
  assert.deepEqual(results, []);
});

test("saving a result never sends an agenda notice when the nearest remaining appointment changes", async () => {
  const scheduled = { ...after(), schedule_date: "2026-11-23" };
  const next = { ...scheduled, schedule_date: "2026-11-30" };
  const results = await notifyRequestChanges(scheduled, next, dependencies({
    procedureAction: ProcedureAction.SAVE, dispatch: async () => assert.fail("no notice"),
  }));
  assert.deepEqual(results, []);
});

test("an absence sends one notice per appointment and preserves the animals in that group", async () => {
  const scheduled = after();
  const next = { ...scheduled };
  const visit = (animalIndex, date, name) => ({ animalIndex, animal: { name, species: "Gato" },
    procedure: { status: ProcedureStatus.NO_SHOW, schedule: { date, occurrenceKey: "day:unit", slotTime: "09:15" } } });
  const outcomes = [visit(0, "2026-11-30", "Luna"), visit(0, "2026-11-30", "Luna"), visit(1, "2026-11-30", "Thor"), visit(2, "2026-12-01", "Mel")];
  const visits = [];
  await notifyRequestChanges(scheduled, next, dependencies({ procedureAction: ProcedureAction.NO_SHOW, outcomes, dispatch: async ({ event, request }) => {
    assert.equal(event, NotificationEvent.NO_SHOW);
    visits.push([request.animal_name, request.schedule_date, request.workflow_data.scheduleSlotTime]);
    return [];
  } }));
  assert.deepEqual(visits, [["Luna, Thor", "2026-11-30", "09:15"], ["Mel", "2026-12-01", "09:15"]]);
});

test("only an explicit successful closure sends the completion notice", async () => {
  const scheduled = after();
  const completed = { ...scheduled, status: "REALIZADA" };
  assert.equal((await notifyRequestChanges(scheduled, completed, dependencies({ procedureAction: ProcedureAction.SAVE }))).length, 0);
  const results = await notifyRequestChanges(scheduled, completed, dependencies({ procedureAction: ProcedureAction.CLOSE }));
  assert.equal(results[0].event, NotificationEvent.COMPLETED);
  const absent = { ...scheduled, status: "CANCELADA", workflow_data: { ...scheduled.workflow_data, cancelReason: "Não compareceu" } };
  assert.equal((await notifyRequestChanges(scheduled, absent, dependencies({ procedureAction: ProcedureAction.CLOSE }))).length, 0);
});
