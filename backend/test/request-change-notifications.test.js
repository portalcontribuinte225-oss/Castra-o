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
  assert.deepEqual(dispatched.map(({ event, legacy, request: sent }) => [event, legacy, sent === request]), [[NotificationEvent.SCHEDULE_CONFIRMED, false, true]]);
  assert.deepEqual(Object.keys(dispatched[0]).sort(), ["event", "legacy", "request"], "the dispatcher reads the channels itself and gets no settings");
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

test("legacy requests do not acquire completion or document notification consent", async () => {
  const oldBefore = { ...before, workflow_data: {} };
  const result = await notifyRequestChanges(oldBefore, { ...oldBefore, status: "REALIZADA" }, dependencies({ dispatch: async () => assert.fail("no new legacy event") }));
  assert.deepEqual(result, []);
});

test("unchanged state never sends a repeated notification", async () => {
  const result = await notifyRequestChanges(after(), after(), dependencies({ dispatch: async () => assert.fail("no repeated send") }));
  assert.deepEqual(result, []);
});

test("the first confirmation uses the procedure actually confirmed instead of the nearest pending visit", async () => {
  const request = { ...after(), schedule_date: "2026-11-23", schedule_location_name: "Unidade A" };
  const procedureChange = {
    action: ProcedureAction.CONFIRM_SCHEDULE, animal: { name: "Luna", species: "Gato" },
    procedure: { status: ProcedureStatus.SCHEDULED, schedule: { date: "2026-11-30", slotTime: "09:15", locationName: "Unidade B" } },
  };
  const results = await notifyRequestChanges(before, request, dependencies({ procedureChange, dispatch: async ({ event, request: notice }) => {
    assert.equal(event, NotificationEvent.SCHEDULE_CONFIRMED);
    assert.equal(notice.schedule_date, "2026-11-30");
    assert.equal(notice.schedule_location_name, "Unidade B");
    assert.equal(notice.workflow_data.scheduleSlotTime, "09:15");
    assert.equal(notice.animal_name, "Luna");
    assert.equal(notice.species, "Gato");
    return [{ event, channel: NotificationChannel.SMS, status: DeliveryStatus.SENT }];
  } }));
  assert.equal(results.length, 1);
  assert.equal(request.schedule_date, "2026-11-23");
});

test("rescheduling a procedure uses its date even when the general agenda stays unchanged", async () => {
  const request = { ...after(), schedule_date: "2026-11-23" };
  const schedule = { date: "2026-11-30", slotTime: "09:15", locationName: "Unidade B" };
  const procedureChange = {
    action: ProcedureAction.RESCHEDULE, previousSchedule: { ...schedule, date: "2026-11-29" },
    procedure: { status: ProcedureStatus.SCHEDULED, schedule },
  };
  const result = await notifyRequestChanges(request, { ...request }, dependencies({ procedureChange, dispatch: async ({ event, request: notice }) => {
    assert.equal(event, NotificationEvent.SCHEDULE_CHANGED);
    assert.equal(notice.schedule_date, schedule.date);
    return [{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }];
  } }));
  assert.equal(result.length, 1);
  assert.deepEqual(await notifyRequestChanges(request, { ...request }, dependencies({
    procedureChange: { ...procedureChange, previousSchedule: schedule }, dispatch: async () => assert.fail("no notice for the same visit"),
  })), []);
});

test("closing a procedure does not reschedule the request just because another visit became the nearest", async () => {
  const first = { ...after(), schedule_date: "2026-11-23" };
  const next = { ...after(), schedule_date: "2026-11-24" };
  const result = await notifyRequestChanges(first, next, dependencies({
    procedureChange: { action: ProcedureAction.ATTEND, procedure: { status: ProcedureStatus.DONE, schedule: { date: first.schedule_date } } },
    dispatch: async () => assert.fail("no rescheduling without an agenda action"),
  }));
  assert.deepEqual(result, []);
});
