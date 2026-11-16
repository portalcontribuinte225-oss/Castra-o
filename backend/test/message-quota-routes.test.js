import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import messageQuotaRoutes from "../src/routes/message-quota.js";
import { pool } from "../src/db/index.js";
import { NotificationChannel } from "../../shared/notification-contract.js";
import { messageQuotaKey } from "../../shared/message-quota-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { quotaDatabase, QUOTA_TEST_MUNICIPALITY as MUNICIPALITY, QUOTA_TEST_OTHER as OTHER } from "./fixtures/message-quota-db.js";
import { isPermissionRead, permissionConfigs, permissionGroup } from "./fixtures/permission-groups.js";

const { WHATSAPP, SMS, EMAIL } = NotificationChannel;
const CHANNELS = [WHATSAPP, SMS, EMAIL];
const clientFetch = globalThis.fetch;
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY };
const ANALYST = { id: "44444444-4444-4444-8444-444444444444", role: "analista", municipalityId: MUNICIPALITY };
const OTHER_ANALYST = { id: "55555555-5555-4555-8555-555555555555", role: "analista", municipalityId: MUNICIPALITY };
const MASTER = { ...ADMIN, id: "66666666-6666-4666-8666-666666666666", role: "master", municipalityId: null };
const SUPPORT = { ...ADMIN, id: "77777777-7777-4777-8777-777777777777", role: "suporte", municipalityId: null };
const CONTRACT = { plan: 200, contractStart: "2026-01-01", contractEnd: "2026-12-31" };
// The analyst's group opens the SMS tab only.
const analystGroup = () => permissionConfigs(MUNICIPALITY, { users: [{ id: ANALYST.id, permissionGroupId: "g" }], groups: [permissionGroup("g", ["sms_settings"])] });

async function fixture(t, options) {
  const previous = { query: pool.query, connect: pool.connect, jwt: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "message-quota-route-tests";
  const db = quotaDatabase(options); const sessions = new Map();
  pool.query = async (sql, values) => resolveTestSession(sql, values, sessions) || db.query(sql, values);
  pool.connect = db.connect;
  const app = express(); app.use(express.json()); app.use("/message-quota", messageQuotaRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
    if (previous.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.jwt;
  });
  const request = async (path, { method = "GET", body, user = ADMIN } = {}) => {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}/message-quota${path}`, { method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(sessions, user)}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json().catch(() => null) };
  };
  return { request, db };
}

const contractsFor = (municipalityId, plan) => Object.fromEntries(CHANNELS.map((channel) => [`${messageQuotaKey(channel)}:${municipalityId}`, { plan }]));

test("reading denies the public and external roles before any database access", async (t) => {
  const { request, db } = await fixture(t);
  for (const channel of CHANNELS) {
    assert.equal((await request(`/${channel}`, { user: null })).status, 401);
    for (const role of ["tutor", "ong", "protetor"]) assert.equal((await request(`/${channel}`, { user: { ...ADMIN, role } })).status, 403, role);
  }
  assert.equal(db.calls.length, 0);
});

test("the manager with no group reads every channel, and a staff user only the channels their group opens, despite a forged query", async (t) => {
  const { request, db } = await fixture(t, { configs: { ...contractsFor(MUNICIPALITY, 100), ...contractsFor(OTHER, 5), ...analystGroup() } });
  for (const channel of CHANNELS) {
    const response = await request(`/${channel}?municipalityId=${OTHER}`, { user: ADMIN });
    assert.equal(response.status, 200, channel); assert.equal(response.cache, "no-store");
    assert.deepEqual([response.body.plan, response.body.used, response.body.remaining, response.body.active, response.body.enabled], [100, 0, 100, true, true]);
  }
  assert.equal((await request(`/${SMS}?municipalityId=${OTHER}`, { user: ANALYST })).body.plan, 100);
  for (const channel of [WHATSAPP, EMAIL]) assert.equal((await request(`/${channel}`, { user: ANALYST })).status, 403, channel);
  for (const channel of CHANNELS) assert.equal((await request(`/${channel}`, { user: OTHER_ANALYST })).status, 403, `${channel} for a user with no group`);
  assert.equal(db.calls.filter(({ values }) => values.length).every(({ values }) => values[1] === MUNICIPALITY), true);
  assert.equal((await request("/fax")).status, 400);
  assert.equal((await request(`/${SMS}`, { user: { ...ADMIN, municipalityId: "33333333-3333-4333-8333-333333333333" } })).body, null, "a municipality without a contract reads nothing");
});

test("a global user chooses the municipality to read, and none or an invalid one answers safely", async (t) => {
  const { request } = await fixture(t, { configs: { ...contractsFor(MUNICIPALITY, 100), ...contractsFor(OTHER, 5) } });
  for (const user of [MASTER, SUPPORT]) {
    assert.equal((await request(`/${SMS}?municipalityId=${OTHER}`, { user })).body.plan, 5);
    assert.equal((await request(`/${SMS}?municipalityId=${MUNICIPALITY}`, { user })).body.plan, 100);
    assert.equal((await request(`/${SMS}`, { user })).body, null);
    assert.equal((await request(`/${SMS}?municipalityId=not-a-municipality`, { user })).status, 400);
  }
});

test("only the master saves, switches or resets a contract: the support, the manager and the others are denied before any database access", async (t) => {
  const { request, db } = await fixture(t);
  for (const user of [null, { ...ADMIN, role: "tutor" }, { ...ADMIN, role: "analista" }, { ...ADMIN, role: "servidor_publico" }, ADMIN, SUPPORT]) {
    for (const channel of CHANNELS) {
      const expected = user ? 403 : 401;
      assert.equal((await request(`/${channel}?municipalityId=${MUNICIPALITY}`, { user, method: "PUT", body: CONTRACT })).status, expected);
      assert.equal((await request(`/${channel}/enabled?municipalityId=${MUNICIPALITY}`, { user, method: "PUT", body: { enabled: false } })).status, expected);
      assert.equal((await request(`/${channel}/reset?municipalityId=${MUNICIPALITY}`, { user, method: "POST", body: {} })).status, expected);
    }
  }
  assert.equal(db.calls.length, 0);
});

test("the master saves the contract of the chosen municipality, keeping the month's usage and the service switch, and it is audited", async (t) => {
  const { request, db } = await fixture(t, { configs: { [`email_quota:${OTHER}`]: { plan: 100, currentPeriodStart: "2026-11", currentPeriodUsed: 8, enabled: false } } });
  for (const channel of CHANNELS) {
    const saved = await request(`/${channel}?municipalityId=${OTHER}`, { user: MASTER, method: "PUT", body: CONTRACT });
    assert.equal(saved.status, 200, channel); assert.equal(saved.cache, "no-store");
    assert.deepEqual([saved.body.plan, saved.body.contractStart, saved.body.contractEnd], [200, "2026-01-01", "2026-12-31"]);
    assert.equal(db.store.has(`${messageQuotaKey(channel)}:${MUNICIPALITY}`), false, "the other municipality is untouched");
  }
  assert.deepEqual(db.store.get(`email_quota:${OTHER}`), { ...CONTRACT, currentPeriodStart: "2026-11", currentPeriodUsed: 8, enabled: false });
  assert.deepEqual(db.store.get(`sms_quota:${OTHER}`), { ...CONTRACT, currentPeriodStart: "", currentPeriodUsed: 0 });
  assert.deepEqual(db.audits.map(({ action, municipalityId, entityId }) => [action, municipalityId, entityId]),
    [["CONFIG_UPDATE", OTHER, "whatsapp_quota"], ["CONFIG_UPDATE", OTHER, "sms_quota"], ["CONFIG_UPDATE", OTHER, "email_quota"]]);
  assert.deepEqual(db.audits[1].changes, { key: "sms_quota", municipalityId: OTHER, ...CONTRACT });
});

test("a contract is validated, and it needs an active municipality and a known channel", async (t) => {
  const { request, db } = await fixture(t);
  for (const body of [{}, { plan: 0 }, { plan: "100" }, { plan: 1.5 }, { plan: 10, contractStart: "2026-13-01" }, { plan: 10, contractStart: "2026-12-01", contractEnd: "2026-11-01" },
    { plan: 10, extra: 1 }, { plan: 10, currentPeriodUsed: 0 }, { plan: 10, enabled: false }, [], null]) {
    const response = await request(`/${SMS}?municipalityId=${MUNICIPALITY}`, { user: MASTER, method: "PUT", body });
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal((await request(`/${SMS}`, { user: MASTER, method: "PUT", body: CONTRACT })).status, 400, "no municipality chosen");
  assert.equal((await request(`/${SMS}?municipalityId=33333333-3333-4333-8333-333333333333`, { user: MASTER, method: "PUT", body: CONTRACT })).status, 400, "not an active municipality");
  assert.equal((await request(`/${SMS}?municipalityId=not-a-municipality`, { user: MASTER, method: "PUT", body: CONTRACT })).status, 400);
  assert.equal((await request(`/fax?municipalityId=${MUNICIPALITY}`, { user: MASTER, method: "PUT", body: CONTRACT })).status, 400);
  assert.equal(db.store.size, 0);
});

test("the master switches the service of SMS and e-mail for a municipality, keeping the contract, and it is audited", async (t) => {
  const { request, db } = await fixture(t, { configs: { [`sms_quota:${OTHER}`]: { plan: 50, currentPeriodStart: "2026-11", currentPeriodUsed: 7, contractEnd: "2026-12-31" }, [`email_quota:${OTHER}`]: { plan: 20 } } });
  const off = await request(`/${SMS}/enabled?municipalityId=${OTHER}`, { user: MASTER, method: "PUT", body: { enabled: false } });
  assert.equal(off.status, 200); assert.equal(off.cache, "no-store");
  assert.deepEqual([off.body.plan, off.body.used, off.body.enabled, off.body.active], [50, 7, false, true]);
  assert.deepEqual(db.store.get(`sms_quota:${OTHER}`), { plan: 50, currentPeriodStart: "2026-11", currentPeriodUsed: 7, contractEnd: "2026-12-31", enabled: false });
  assert.equal(db.store.get(`email_quota:${OTHER}`).enabled, undefined, "the other channel is untouched");
  const on = await request(`/${SMS}/enabled?municipalityId=${OTHER}`, { user: MASTER, method: "PUT", body: { enabled: true } });
  assert.equal(on.body.enabled, true); assert.equal(db.store.get(`sms_quota:${OTHER}`).enabled, true);
  assert.equal((await request(`/${EMAIL}/enabled?municipalityId=${OTHER}`, { user: MASTER, method: "PUT", body: { enabled: false } })).body.enabled, false);
  assert.deepEqual(db.audits.map(({ action, municipalityId, entityId, changes }) => [action, municipalityId, entityId, changes.enabled]),
    [["CONFIG_UPDATE", OTHER, "sms_quota", false], ["CONFIG_UPDATE", OTHER, "sms_quota", true], ["CONFIG_UPDATE", OTHER, "email_quota", false]]);
  assert.equal((await request(`/${EMAIL}?municipalityId=${OTHER}`, { user: MASTER })).body.enabled, false, "the counter reads the switch");
});

test("the service switch is only for SMS and e-mail, needs a contract and a real boolean, and an active municipality", async (t) => {
  const { request, db } = await fixture(t, { configs: { [`whatsapp_quota:${OTHER}`]: { plan: 10 }, [`sms_quota:${OTHER}`]: { plan: 10 } } });
  const put = (channel, body, query = `?municipalityId=${OTHER}`) => request(`/${channel}/enabled${query}`, { user: MASTER, method: "PUT", body });
  assert.equal((await put(WHATSAPP, { enabled: false })).status, 400, "WhatsApp has its own switch in the credentials");
  assert.equal((await put(EMAIL, { enabled: false })).status, 400, "no e-mail contract yet");
  for (const body of [{}, { enabled: "true" }, { enabled: 1 }, { enabled: null }, { enabled: false, plan: 5 }, [], null]) {
    const response = await put(SMS, body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal((await put(SMS, { enabled: false }, "")).status, 400, "no municipality chosen");
  assert.equal((await put(SMS, { enabled: false }, "?municipalityId=33333333-3333-4333-8333-333333333333")).status, 400);
  assert.equal((await put("fax", { enabled: false })).status, 400);
  assert.deepEqual(db.store.get(`sms_quota:${OTHER}`), { plan: 10 });
  assert.equal(db.store.has(`email_quota:${OTHER}`), false);
});

test("resetting starts the month over and keeps the contract and the service switch, and creates nothing for a municipality without one", async (t) => {
  const { request, db } = await fixture(t, { configs: { [`whatsapp_quota:${OTHER}`]: { plan: 100, currentPeriodStart: "2026-11", currentPeriodUsed: 50, contractEnd: "2026-12-31" },
    [`sms_quota:${OTHER}`]: { plan: 10, currentPeriodStart: "2026-11", currentPeriodUsed: 3, enabled: false } } });
  const reset = await request(`/${WHATSAPP}/reset?municipalityId=${OTHER}`, { user: MASTER, method: "POST" });
  assert.equal(reset.status, 200); assert.equal(reset.cache, "no-store"); assert.deepEqual([reset.body.plan, reset.body.used, reset.body.contractEnd], [100, 0, "2026-12-31"]);
  assert.deepEqual(db.store.get(`whatsapp_quota:${OTHER}`), { plan: 100, currentPeriodStart: "", currentPeriodUsed: 0, contractEnd: "2026-12-31" });
  assert.deepEqual((await request(`/${SMS}/reset?municipalityId=${OTHER}`, { user: MASTER, method: "POST" })).body.enabled, false);
  assert.deepEqual(db.store.get(`sms_quota:${OTHER}`), { plan: 10, currentPeriodStart: "", currentPeriodUsed: 0, enabled: false });
  const none = await request(`/${EMAIL}/reset?municipalityId=${OTHER}`, { user: MASTER, method: "POST" });
  assert.equal(none.status, 200); assert.equal(none.body, null); assert.equal(db.store.has(`email_quota:${OTHER}`), false);
  assert.equal((await request(`/${WHATSAPP}/reset`, { user: MASTER, method: "POST" })).status, 400, "no municipality chosen");
});

test("a failed write rolls back and the answer carries no database detail", async (t) => {
  const { request, db } = await fixture(t);
  db.state.failWrite = true;
  const failed = await request(`/${SMS}?municipalityId=${MUNICIPALITY}`, { user: MASTER, method: "PUT", body: CONTRACT });
  assert.equal(failed.status, 500); assert.equal(JSON.stringify(failed.body).includes("private database"), false);
  assert.equal(db.calls.some(({ sql }) => sql === "ROLLBACK"), true); assert.equal(db.calls.some(({ sql }) => sql === "COMMIT"), false);
  assert.equal(db.state.releases, 1);
});

test("a failure of the permission read answers without detail and lets nothing through", async (t) => {
  const { request, db } = await fixture(t, { configs: contractsFor(MUNICIPALITY, 10) });
  db.state.failRead = true;
  const failed = await request(`/${SMS}`, { user: ANALYST });
  assert.equal(failed.status, 503); assert.equal(JSON.stringify(failed.body).includes("unavailable"), false);
  assert.equal(db.calls.filter((call) => !isPermissionRead(call)).length, 0);
});
