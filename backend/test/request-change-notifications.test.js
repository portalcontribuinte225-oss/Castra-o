import test from "node:test";
import assert from "node:assert/strict";
import { notifyRequestChanges } from "../src/services/request-change-notifications.js";
import { NotificationEvent, NotificationChannel, DeliveryStatus } from "../../shared/notification-contract.js";

const before = { id: "request-a", municipality_id: "municipality-a", status: "NOVA", workflow_data: { followUp: { enabled: true, email: "private@example.com" } } };
const after = () => ({ ...structuredClone(before), status: "AGENDADA", history: [] });
const dependencies = (overrides = {}) => ({
  loadSettings: async () => ({ notifications: {} }),
  dispatch: async ({ event }) => [{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }],
  appendHistory: async () => {},
  ...overrides,
});

test("notifications persist structured results and only append history within the request municipality", async () => {
  const request = after();
  const result = await notifyRequestChanges(before, request, dependencies({ appendHistory: async (entries, id, municipalityId) => {
    assert.equal(id, before.id);
    assert.equal(municipalityId, before.municipality_id);
    assert.equal(entries[0].notification.event, NotificationEvent.SCHEDULE_CONFIRMED);
    assert.doesNotMatch(JSON.stringify(entries), /private@example.com/);
  } }));
  assert.equal(result[0].status, DeliveryStatus.SENT);
  assert.equal(request.history.length, 1);
});

test("configuration failures are sanitized and recorded instead of rejecting the saved operation", async () => {
  let recorded = false;
  const result = await notifyRequestChanges(before, after(), dependencies({
    loadSettings: async () => { throw new Error("secret DB URL"); },
    appendHistory: async (entries) => { recorded = true; assert.equal(entries[0].notification.status, DeliveryStatus.FAILED); },
  }));
  assert.equal(recorded, true);
  assert.doesNotMatch(JSON.stringify(result), /secret DB/);
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

test("refusal bypasses configuration reads and every provider even if other contact fields exist", async () => {
  const request = { ...after(), tutor_email: "private@example.com", phone: "48999991234", workflow_data: { followUp: { enabled: false } } };
  const result = await notifyRequestChanges(before, request, dependencies({ loadSettings: async () => assert.fail("no settings lookup after refusal") }));
  assert.deepEqual(result, []);
});

test("legacy requests do not acquire completion or document notification consent", async () => {
  const oldBefore = { ...before, workflow_data: {} };
  const result = await notifyRequestChanges(oldBefore, { ...oldBefore, status: "REALIZADA" }, dependencies({ loadSettings: async () => assert.fail("no new legacy event") }));
  assert.deepEqual(result, []);
});

test("unchanged state never sends a repeated notification", async () => {
  const result = await notifyRequestChanges(after(), after(), dependencies({ dispatch: async () => assert.fail("no repeated send") }));
  assert.deepEqual(result, []);
});
