import test from "node:test";
import assert from "node:assert/strict";
import { NotificationChannel } from "../../shared/notification-contract.js";
import { MESSAGE_QUOTA_KEYS, hasServiceSwitch, isContractInForce, isServiceAvailable, isServiceOn, messageQuotaDates, messageQuotaKey, normalizeMessageQuotaInput } from "../../shared/message-quota-contract.js";
import { checkAndConsumeQuota, evaluateMessageQuota, getQuotaStatus, isQuotaAvailable, isServiceEnabled, resetQuotaUsage, saveQuota, setServiceEnabled } from "../src/services/message-quota.js";
import { quotaDatabase, QUOTA_TEST_MUNICIPALITY as MUNICIPALITY, QUOTA_TEST_OTHER as OTHER } from "./fixtures/message-quota-db.js";

const { WHATSAPP, SMS, EMAIL } = NotificationChannel;
const CHANNELS = [WHATSAPP, SMS, EMAIL];
const date = new Date("2026-11-13T12:00:00Z");

test("each channel has its own contract key, and WhatsApp keeps the one it always had", () => {
  assert.deepEqual(CHANNELS.map(messageQuotaKey), ["whatsapp_quota", "sms_quota", "email_quota"]);
  assert.equal(MESSAGE_QUOTA_KEYS[WHATSAPP], "whatsapp_quota");
  for (const channel of ["fax", "", undefined, null, "constructor", "__proto__"]) assert.equal(messageQuotaKey(channel), null, String(channel));
});

test("quota validates contract, limit and period using the Brazilian calendar, for every channel", () => {
  for (const channel of CHANNELS) {
    assert.equal(evaluateMessageQuota(channel, null, date).allowed, false);
    assert.equal(evaluateMessageQuota(channel, { plan: 1, contractStart: "2026-11-14" }, date).allowed, false);
    assert.equal(evaluateMessageQuota(channel, { plan: 1, contractEnd: "2026-11-12" }, date).allowed, false);
    assert.equal(evaluateMessageQuota(channel, { plan: 1, currentPeriodStart: "2026-11", currentPeriodUsed: 1 }, date).allowed, false);
    const reset = evaluateMessageQuota(channel, { plan: 1, currentPeriodStart: "2026-10", currentPeriodUsed: 1 }, date);
    assert.equal(reset.allowed, true);
    assert.equal(reset.remaining, 0);
    assert.equal(reset.next.currentPeriodUsed, 1);
    const lateEvening = evaluateMessageQuota(channel, { plan: 1, contractEnd: "2026-11-12" }, new Date("2026-11-13T01:00:00Z"));
    assert.equal(lateEvening.allowed, true);
  }
  assert.deepEqual(messageQuotaDates(new Date("2026-11-13T01:00:00Z")), { period: "2026-11", today: "2026-11-12" });
});

test("the reason of a refusal names the channel", () => {
  assert.match(evaluateMessageQuota(WHATSAPP, null, date).reason, /WhatsApp/);
  assert.match(evaluateMessageQuota(SMS, { plan: 1, contractStart: "2026-11-14" }, date).reason, /SMS/);
  assert.match(evaluateMessageQuota(EMAIL, { plan: 1, contractEnd: "2026-11-12" }, date).reason, /e-mail/);
  assert.match(evaluateMessageQuota(SMS, { plan: 1, currentPeriodStart: "2026-11", currentPeriodUsed: 1 }, date).reason, /SMS/);
});

test("a contract is in force with a plan and while today is inside its dates, whatever the balance", () => {
  const today = "2026-11-13";
  assert.equal(isContractInForce({ plan: 5 }, today), true);
  assert.equal(isContractInForce({ plan: 5, contractStart: "2026-11-13", contractEnd: "2026-11-13" }, today), true);
  for (const quota of [null, {}, { plan: 0 }, { plan: -1 }, { plan: "x" }, { plan: 1.5 }, { plan: 5, contractStart: "2026-11-14" }, { plan: 5, contractEnd: "2026-11-12" }]) {
    assert.equal(isContractInForce(quota, today), false, JSON.stringify(quota));
  }
  assert.equal(isContractInForce({ plan: 5, currentPeriodStart: "2026-11", currentPeriodUsed: 5 }, today), true);
});

test("a saved contract is a whole-number limit with valid, ordered dates and nothing else", () => {
  assert.deepEqual(normalizeMessageQuotaInput({ plan: 100, contractStart: "2026-01-01", contractEnd: "2026-12-31" }), { value: { plan: 100, contractStart: "2026-01-01", contractEnd: "2026-12-31" } });
  assert.deepEqual(normalizeMessageQuotaInput({ plan: 100 }), { value: { plan: 100, contractStart: "", contractEnd: "" } });
  assert.deepEqual(normalizeMessageQuotaInput({ plan: 100, contractStart: "", contractEnd: "" }).value, { plan: 100, contractStart: "", contractEnd: "" });
  for (const input of [undefined, null, [], "plan", {}, { plan: 0 }, { plan: -5 }, { plan: "100" }, { plan: 1.5 }, { plan: Number.MAX_VALUE },
    { plan: 10, contractStart: "2026-13-01" }, { plan: 10, contractEnd: "2026-02-30" }, { plan: 10, contractStart: "01/12/2026" }, { plan: 10, contractStart: 20260101 },
    { plan: 10, contractStart: "2026-12-01", contractEnd: "2026-11-01" }, { plan: 10, currentPeriodUsed: 0 }, { plan: 10, extra: true }]) {
    assert.ok(normalizeMessageQuotaInput(input).error, JSON.stringify(input));
  }
});

test("consuming spends one message of the channel's month and answers without the stored value", async () => {
  for (const channel of CHANNELS) {
    const database = quotaDatabase({ configs: { [`${messageQuotaKey(channel)}:${MUNICIPALITY}`]: { plan: 2 } } });
    const first = await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date });
    assert.deepEqual(first, { allowed: true, remaining: 1 });
    assert.deepEqual(database.store.get(`${messageQuotaKey(channel)}:${MUNICIPALITY}`), { plan: 2, currentPeriodStart: "2026-11", currentPeriodUsed: 1 });
    assert.equal((await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date })).remaining, 0);
    const spent = await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date });
    assert.equal(spent.allowed, false); assert.equal(Object.hasOwn(spent, "next"), false);
    assert.equal(database.store.get(`${messageQuotaKey(channel)}:${MUNICIPALITY}`).currentPeriodUsed, 2);
    const nextMonth = await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: new Date("2026-12-02T12:00:00Z") });
    assert.equal(nextMonth.allowed, true); assert.equal(database.store.get(`${messageQuotaKey(channel)}:${MUNICIPALITY}`).currentPeriodStart, "2026-12");
  }
});

test("a channel or a municipality never spends another one's contract", async () => {
  const database = quotaDatabase({ configs: { [`whatsapp_quota:${MUNICIPALITY}`]: { plan: 5 }, [`sms_quota:${MUNICIPALITY}`]: { plan: 5 }, [`sms_quota:${OTHER}`]: { plan: 5 } } });
  await checkAndConsumeQuota(SMS, MUNICIPALITY, { database, now: date });
  assert.equal(database.store.get(`sms_quota:${MUNICIPALITY}`).currentPeriodUsed, 1);
  assert.equal(database.store.get(`whatsapp_quota:${MUNICIPALITY}`).currentPeriodUsed, undefined);
  assert.equal(database.store.get(`sms_quota:${OTHER}`).currentPeriodUsed, undefined);
  const without = await checkAndConsumeQuota(EMAIL, MUNICIPALITY, { database, now: date });
  assert.equal(without.allowed, false); assert.equal(database.store.has(`email_quota:${MUNICIPALITY}`), false, "a refusal creates no row");
});

test("an unknown channel or a missing municipality is refused without touching the database", async () => {
  const database = quotaDatabase();
  for (const [channel, municipalityId] of [["fax", MUNICIPALITY], [SMS, null], [SMS, ""], [undefined, MUNICIPALITY]]) {
    assert.equal((await checkAndConsumeQuota(channel, municipalityId, { database, now: date })).allowed, false);
    assert.equal(await isQuotaAvailable(channel, municipalityId, { database, now: date }), false);
    assert.equal(await getQuotaStatus(channel, municipalityId, { database, now: date }), null);
  }
  assert.equal(database.calls.length, 0);
});

test("concurrent consumption serializes existing rows and cannot exceed the last slot", async () => {
  for (const channel of CHANNELS) {
    const database = quotaDatabase({ configs: { [`${messageQuotaKey(channel)}:${MUNICIPALITY}`]: { plan: 1, currentPeriodStart: "2026-11", currentPeriodUsed: 0 } } });
    const results = await Promise.all([
      checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date }),
      checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date }),
    ]);
    assert.equal(results.filter(({ allowed }) => allowed).length, 1);
    assert.equal(database.store.get(`${messageQuotaKey(channel)}:${MUNICIPALITY}`).currentPeriodUsed, 1);
    assert.equal(database.state.releases, 2);
    assert.equal(results.some((result) => Object.hasOwn(result, "next")), false);
  }
});

test("quota errors rollback and release the borrowed connection", async () => {
  const database = quotaDatabase(); database.state.failRead = true;
  await assert.rejects(checkAndConsumeQuota(SMS, MUNICIPALITY, { database, now: date }));
  assert.deepEqual(database.calls.slice(-1).map(({ sql }) => sql), ["ROLLBACK"]);
  assert.equal(database.state.releases, 1);
  assert.equal(database.calls.some(({ sql }) => sql === "COMMIT"), false);
});

test("asking whether a message could go spends nothing", async () => {
  const key = `sms_quota:${MUNICIPALITY}`;
  const database = quotaDatabase({ configs: { [key]: { plan: 1 } } });
  assert.equal(await isQuotaAvailable(SMS, MUNICIPALITY, { database, now: date }), true);
  assert.equal(await isQuotaAvailable(SMS, MUNICIPALITY, { database, now: date }), true);
  assert.equal(database.store.get(key).currentPeriodUsed, undefined);
  assert.equal(await isQuotaAvailable(SMS, OTHER, { database, now: date }), false);
  database.store.set(key, { plan: 1, currentPeriodStart: "2026-11", currentPeriodUsed: 1 });
  assert.equal(await isQuotaAvailable(SMS, MUNICIPALITY, { database, now: date }), false);
  assert.equal(database.calls.some(({ sql }) => sql.includes("INSERT") || sql === "BEGIN"), false);
});

test("the status tells the plan, the month's usage, what is left and whether the contract is in force", async () => {
  const database = quotaDatabase({ configs: {
    [`whatsapp_quota:${MUNICIPALITY}`]: { plan: 100, currentPeriodStart: "2026-11", currentPeriodUsed: 30, contractStart: "2026-01-01", contractEnd: "2026-12-31" },
    [`sms_quota:${MUNICIPALITY}`]: { plan: 10, currentPeriodStart: "2026-10", currentPeriodUsed: 10, contractEnd: "2026-11-12" },
    [`email_quota:${MUNICIPALITY}`]: { currentPeriodUsed: 3 },
  } });
  assert.deepEqual(await getQuotaStatus(WHATSAPP, MUNICIPALITY, { database, now: date }), { plan: 100, used: 30, remaining: 70, contractStart: "2026-01-01", contractEnd: "2026-12-31", active: true, enabled: true });
  assert.deepEqual(await getQuotaStatus(SMS, MUNICIPALITY, { database, now: date }), { plan: 10, used: 0, remaining: 10, contractStart: null, contractEnd: "2026-11-12", active: false, enabled: true });
  assert.equal(await getQuotaStatus(EMAIL, MUNICIPALITY, { database, now: date }), null, "no plan, no contract");
  assert.equal(await getQuotaStatus(WHATSAPP, OTHER, { database, now: date }), null);
});

test("saving a contract keeps the usage already counted this month, rejects an invalid one, and is audited without anything else", async () => {
  const key = `email_quota:${OTHER}`;
  const database = quotaDatabase({ configs: { [key]: { plan: 100, currentPeriodStart: "2026-11", currentPeriodUsed: 8, contractEnd: "2026-12-31" } } });
  const audit = { userId: "44444444-4444-4444-8444-444444444444", municipalityId: null };
  const status = await saveQuota({ channel: EMAIL, municipalityId: OTHER, input: { plan: 200, contractStart: "2026-01-01" }, audit, database });
  assert.deepEqual(database.store.get(key), { plan: 200, contractStart: "2026-01-01", contractEnd: "", currentPeriodStart: "2026-11", currentPeriodUsed: 8 });
  assert.equal(status.plan, 200); assert.equal(status.contractEnd, null, "the end date can be cleared");
  assert.deepEqual(database.audits.map(({ userId, municipalityId, action, entityId, changes }) => [userId, municipalityId, action, entityId, changes]),
    [[audit.userId, OTHER, "CONFIG_UPDATE", "email_quota", { key: "email_quota", municipalityId: OTHER, plan: 200, contractStart: "2026-01-01", contractEnd: "" }]]);
  const created = await saveQuota({ channel: SMS, municipalityId: OTHER, input: { plan: 5 }, database });
  assert.deepEqual(database.store.get(`sms_quota:${OTHER}`), { plan: 5, contractStart: "", contractEnd: "", currentPeriodStart: "", currentPeriodUsed: 0 });
  assert.equal(created.used, 0);
  const before = structuredClone([...database.store]);
  await assert.rejects(saveQuota({ channel: SMS, municipalityId: OTHER, input: { plan: 0 }, database }), { status: 400 });
  await assert.rejects(saveQuota({ channel: "fax", municipalityId: OTHER, input: { plan: 5 }, database }), { status: 400 });
  assert.deepEqual([...database.store], before);
});

test("resetting starts the month over and keeps the contract; it creates nothing for a municipality without one", async () => {
  const key = `whatsapp_quota:${MUNICIPALITY}`;
  const database = quotaDatabase({ configs: { [key]: { plan: 100, currentPeriodStart: "2026-11", currentPeriodUsed: 50, contractEnd: "2026-12-31" } } });
  const status = await resetQuotaUsage({ channel: WHATSAPP, municipalityId: MUNICIPALITY, database });
  assert.deepEqual(database.store.get(key), { plan: 100, currentPeriodStart: "", currentPeriodUsed: 0, contractEnd: "2026-12-31" });
  assert.equal(status.used, 0); assert.equal(status.plan, 100);
  assert.equal(await resetQuotaUsage({ channel: SMS, municipalityId: MUNICIPALITY, database }), null);
  assert.equal(database.store.has(`sms_quota:${MUNICIPALITY}`), false);
  await assert.rejects(resetQuotaUsage({ channel: "fax", municipalityId: MUNICIPALITY, database }), { status: 400 });
});

test("only SMS and e-mail have a service switch, and absent means on", () => {
  assert.deepEqual(CHANNELS.map(hasServiceSwitch), [false, true, true]);
  assert.equal(isServiceOn(undefined), true);
  assert.equal(isServiceOn({ plan: 1 }), true);
  assert.equal(isServiceOn({ plan: 1, enabled: true }), true);
  assert.equal(isServiceOn({ plan: 1, enabled: false }), false);
  assert.equal(isServiceAvailable({ plan: 5 }, "2026-11-13"), true);
  assert.equal(isServiceAvailable({ plan: 5, enabled: false }, "2026-11-13"), false, "the contract is in force but the service is off");
  assert.equal(isServiceAvailable({ plan: 5, contractEnd: "2026-11-12" }, "2026-11-13"), false);
  assert.equal(isServiceAvailable({ enabled: true }, "2026-11-13"), false, "on, but with no contract");
  assert.equal(isServiceAvailable(null, "2026-11-13"), false);
});

test("a service switched off refuses every send and the balance stays untouched, whatever the contract", async () => {
  for (const channel of [SMS, EMAIL]) {
    const key = `${messageQuotaKey(channel)}:${MUNICIPALITY}`;
    const database = quotaDatabase({ configs: { [key]: { plan: 10, enabled: false } } });
    const refused = await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date });
    assert.equal(refused.allowed, false); assert.match(refused.reason, /desativado/);
    assert.equal(await isQuotaAvailable(channel, MUNICIPALITY, { database, now: date }), false);
    assert.equal(await isServiceEnabled(channel, MUNICIPALITY, { database }), false);
    assert.deepEqual(database.store.get(key), { plan: 10, enabled: false });
    database.store.set(key, { plan: 10, enabled: true });
    assert.equal((await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date })).allowed, true);
    database.store.set(key, { plan: 10 });
    assert.equal((await checkAndConsumeQuota(channel, MUNICIPALITY, { database, now: date })).allowed, true, "a contract with no switch is on");
  }
  const none = quotaDatabase();
  assert.equal(await isServiceEnabled(SMS, MUNICIPALITY, { database: none }), true, "a municipality with no contract counts as on");
  assert.equal(await isServiceEnabled("fax", MUNICIPALITY, { database: none }), false);
  assert.equal(await isServiceEnabled(SMS, null, { database: none }), false);
});

test("the service switch needs a contract and a lone boolean, exists for SMS and e-mail only, keeps the rest and is audited", async () => {
  const key = `sms_quota:${OTHER}`;
  const database = quotaDatabase({ configs: { [key]: { plan: 50, currentPeriodStart: "2026-11", currentPeriodUsed: 7 } } });
  const audit = { userId: "44444444-4444-4444-8444-444444444444", municipalityId: null };
  const off = await setServiceEnabled({ channel: SMS, municipalityId: OTHER, input: { enabled: false }, audit, database });
  assert.deepEqual(database.store.get(key), { plan: 50, currentPeriodStart: "2026-11", currentPeriodUsed: 7, enabled: false });
  assert.equal(off.enabled, false); assert.equal(off.plan, 50);
  assert.deepEqual(database.audits.map(({ userId, municipalityId, action, entityId, changes }) => [userId, municipalityId, action, entityId, changes]),
    [[audit.userId, OTHER, "CONFIG_UPDATE", "sms_quota", { key: "sms_quota", municipalityId: OTHER, enabled: false }]]);
  const before = structuredClone([...database.store]);
  for (const [channel, input] of [[WHATSAPP, { enabled: false }], [SMS, {}], [SMS, { enabled: "false" }], [SMS, { enabled: 0 }], [SMS, { enabled: true, plan: 1 }], [SMS, null], [SMS, []], [SMS, undefined], ["fax", { enabled: false }]]) {
    await assert.rejects(setServiceEnabled({ channel, municipalityId: OTHER, input, database }), { status: 400 }, JSON.stringify([channel, input]));
  }
  await assert.rejects(setServiceEnabled({ channel: EMAIL, municipalityId: OTHER, input: { enabled: false }, database }), { status: 400, message: /Cadastre o contrato/ });
  assert.equal(database.store.has(`email_quota:${OTHER}`), false, "no contract is created by the switch");
  assert.deepEqual([...database.store], before);
});

test("saving the contract and resetting the month keep the service switch", async () => {
  const key = `email_quota:${MUNICIPALITY}`;
  const database = quotaDatabase({ configs: { [key]: { plan: 10, currentPeriodStart: "2026-11", currentPeriodUsed: 4, enabled: false } } });
  await saveQuota({ channel: EMAIL, municipalityId: MUNICIPALITY, input: { plan: 20 }, database });
  assert.deepEqual(database.store.get(key), { plan: 20, contractStart: "", contractEnd: "", currentPeriodStart: "2026-11", currentPeriodUsed: 4, enabled: false });
  await resetQuotaUsage({ channel: EMAIL, municipalityId: MUNICIPALITY, database });
  assert.deepEqual(database.store.get(key), { plan: 20, contractStart: "", contractEnd: "", currentPeriodStart: "", currentPeriodUsed: 0, enabled: false });
  const fresh = quotaDatabase();
  await saveQuota({ channel: SMS, municipalityId: MUNICIPALITY, input: { plan: 5 }, database: fresh });
  assert.equal(Object.hasOwn(fresh.store.get(`sms_quota:${MUNICIPALITY}`), "enabled"), false, "a new contract carries no switch");
});
