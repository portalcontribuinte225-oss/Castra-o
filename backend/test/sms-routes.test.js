import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import smsRoutes from "../src/routes/sms.js";
import configRoutes from "../src/routes/config.js";
import { pool } from "../src/db/index.js";
import { SMS_ACTIVE_USES_CONFIG_KEY, SMS_CONFIG_KEY } from "../../shared/sms-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { NotificationEvent } from "../../shared/notification-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { smsSettingsDatabase, SMS_TEST_MUNICIPALITY as MUNICIPALITY, SMS_TEST_OTHER as OTHER } from "./fixtures/sms-settings-db.js";

const clientFetch = globalThis.fetch;
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY };
const TOKEN = "private-production-test-token";
async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect, cipher: process.env.CONFIG_ENCRYPTION_KEY, jwt: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = "sms-route-test-key"; process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64");
  const db = smsSettingsDatabase(); const sessions = new Map(); const remoteCalls = [];
  pool.query = async (sql, values) => resolveTestSession(sql, values, sessions) || db.query(sql, values);
  pool.connect = db.connect;
  globalThis.fetch = async (url, options) => {
    remoteCalls.push({ url, options }); assert.equal(db.state.borrowed, 0);
    if (url === "https://smsmais.com/send") {
      const [message] = JSON.parse(options.body).messages;
      return new Response(JSON.stringify([{ id: 4321, schedule: "", nome: "", to: message.destinations[0].to, msg: message.msg, externalId: message.id }]), { status: 200 });
    }
    assert.equal(url, "https://smsmais.com/saldo");
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ success: true, data: { saldo: 0, sms_equivalente: 0, total_recargas: 1234, privateToken: TOKEN } }), { status: 200 });
  };
  const app = express(); app.use(express.json()); app.use("/config", configRoutes); app.use("/sms", smsRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect; globalThis.fetch = previous.fetch;
    if (previous.cipher === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previous.cipher;
    if (previous.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.jwt;
  });
  const request = async (path, { method = "GET", body, user = ADMIN } = {}) => {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, { method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(sessions, user)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
  };
  return { request, db, remoteCalls };
}

const OUTSIDERS = [null, { ...ADMIN, role: "tutor" }, { ...ADMIN, role: "analista" }];

test("writing the SMS settings, testing the connection and switching a message deny public, tutor and operator before any settings/provider access", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  for (const user of OUTSIDERS) {
    const expected = user ? 403 : 401;
    assert.equal((await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${MUNICIPALITY}`, { user, method: "PUT", body: { token: TOKEN } })).status, expected);
    assert.equal((await request("/sms/test-connection", { user, method: "POST", body: { municipalityId: MUNICIPALITY, token: TOKEN } })).status, expected);
    assert.equal((await request("/sms/test-message", { user, method: "POST", body: { municipalityId: MUNICIPALITY, phone: "48999991234" } })).status, expected);
    assert.equal((await request(`/sms/uses/active?municipalityId=${MUNICIPALITY}`, { user, method: "PUT", body: { use: AuthPurpose.PASSWORD_RESET, active: false } })).status, expected);
  }
  assert.equal(db.calls.length, 0); assert.equal(remoteCalls.length, 0);
});

test("anyone can read whether SMS is on for a municipality, and nothing else about the account", async (t) => {
  const { request } = await fixture(t);
  assert.deepEqual((await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${MUNICIPALITY}`, { user: null })).body, { active: false });
  await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { active: true, token: TOKEN } });
  for (const user of OUTSIDERS) {
    const response = await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${MUNICIPALITY}`, { user });
    assert.equal(response.status, 200); assert.deepEqual(response.body, { active: true }); assert.equal(response.cache, "no-store");
  }
  assert.deepEqual((await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${OTHER}`, { user: null })).body, { active: false });
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}`, { user: null })).status, 400);
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}?municipalityId=not-a-municipality`, { user: null })).status, 400);
});

test("SMS admin save/read never reveals token and forged municipality cannot cross tenant", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  const saved = await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${OTHER}`, { method: "PUT", body: { active: true, token: TOKEN } });
  assert.equal(saved.status, 200); assert.equal(saved.body.value.active, true); assert.equal(saved.body.value.tokenValid, true); assert.equal(saved.cache, "no-store");
  assert.equal(db.records.has(MUNICIPALITY), true); assert.equal(db.records.has(OTHER), false); assert.equal(remoteCalls.length, 1);
  const own = await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${OTHER}`);
  assert.equal(own.status, 200); assert.equal(own.body.hasToken, true); assert.equal(own.body.tokenPreview, TOKEN.slice(0, 8));
  assert.equal(own.body.municipalityName, "Test Town"); assert.equal(own.body.uses.length, 9);
  const different = await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${MUNICIPALITY}`, { user: { ...ADMIN, municipalityId: OTHER } });
  assert.equal(different.body.hasToken, false);
  for (const dto of [saved.body, own.body, different.body]) { assert.equal(JSON.stringify(dto).includes(TOKEN), false); assert.equal(JSON.stringify(dto).includes("enc:v1:"), false); }
});

test("test-connection only queries balance without saving or activating and global users must choose an active municipality", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  const result = await request("/sms/test-connection", { method: "POST", body: { municipalityId: OTHER, token: TOKEN } });
  assert.equal(result.status, 200); assert.equal(result.body.valid, true); assert.deepEqual(result.body.balance, { credits: 0, sms: 0 });
  assert.equal(result.body.total_recargas, undefined); assert.equal(result.body.token, undefined); assert.equal(db.records.size, 0);
  assert.equal(db.calls.find(({ sql }) => sql.includes("FROM municipalities")).values[0], MUNICIPALITY);
  const global = { ...ADMIN, role: "master", municipalityId: null };
  assert.equal((await request("/sms/test-connection", { method: "POST", body: { token: TOKEN }, user: global })).status, 400);
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}`, { user: global })).status, 400);
  assert.equal(remoteCalls.length, 1);
});

test("secure-storage absence blocks secrets and activation while permitting safe removal, and errors contain no raw database details", async (t) => {
  const { request, db } = await fixture(t);
  await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { token: TOKEN, active: false } });
  delete process.env.CONFIG_ENCRYPTION_KEY;
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}`)).body.secureStorageAvailable, false);
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { token: "replacement-token", active: false } })).status, 503);
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { active: true } })).status, 503);
  assert.equal((await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { clearToken: true } })).body.value.hasToken, false);
  db.state.failAudit = true;
  const failed = await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { active: false } });
  assert.equal(failed.status, 500); assert.equal(JSON.stringify(failed.body).includes("private database"), false);
});

test("an administrator switches a message for their own municipality only and gets the whole screen back", async (t) => {
  const { request, db } = await fixture(t);
  const confirmed = NotificationEvent.SCHEDULE_CONFIRMED;
  const early = await request("/sms/uses/active", { method: "PUT", body: { use: confirmed, active: true } });
  assert.equal(early.status, 400); assert.equal(db.configs.size, 0);
  await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { active: true, token: TOKEN } });
  const on = await request(`/sms/uses/active?municipalityId=${OTHER}`, { method: "PUT", body: { use: confirmed, active: true, municipalityId: OTHER } });
  assert.equal(on.status, 200); assert.equal(on.cache, "no-store"); assert.equal(on.body.municipalityName, "Test Town");
  assert.equal(on.body.uses.find(({ key }) => key === confirmed).active, true);
  assert.deepEqual(db.configs.get(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [confirmed]: true } });
  assert.equal(db.configs.has(`${SMS_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), false);
  assert.equal(JSON.stringify(on.body).includes(TOKEN), false); assert.equal(JSON.stringify(on.body).includes("enc:v1:"), false);
  const audit = db.audits.find(({ action }) => action === "SMS_USE_UPDATE");
  assert.deepEqual([audit.municipalityId, audit.changes], [MUNICIPALITY, { use: confirmed, active: true }]);
  assert.equal(JSON.stringify(db.audits).includes(TOKEN), false);
  const off = await request("/sms/uses/active", { method: "PUT", body: { use: confirmed, active: false } });
  assert.equal(off.body.uses.find(({ key }) => key === confirmed).active, false);
  assert.equal(off.body.uses.find(({ key }) => key === AuthPurpose.PASSWORD_RESET).active, true);
});

test("a message switch is validated, and a global user must choose an active municipality", async (t) => {
  const { request, db } = await fixture(t);
  for (const body of [{ use: "unknown", active: true }, { use: AuthPurpose.INITIAL_PASSWORD, active: true }, { use: AuthPurpose.PASSWORD_RESET, active: "true" },
    { use: AuthPurpose.PASSWORD_RESET }, {}]) {
    assert.equal((await request("/sms/uses/active", { method: "PUT", body })).status, 400, JSON.stringify(body));
  }
  assert.equal(db.configs.size, 0);
  const global = { ...ADMIN, role: "master", municipalityId: null };
  const body = { use: NotificationEvent.COMPLETED, active: false };
  assert.equal((await request("/sms/uses/active", { method: "PUT", body, user: global })).status, 400);
  assert.equal((await request(`/sms/uses/active?municipalityId=33333333-3333-4333-8333-333333333333`, { method: "PUT", body, user: global })).status, 400);
  const chosen = await request(`/sms/uses/active?municipalityId=${OTHER}`, { method: "PUT", body, user: global });
  assert.equal(chosen.status, 200); assert.equal(chosen.body.municipalityName, "Other Town");
  assert.deepEqual(db.configs.get(`${SMS_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), { active: { [NotificationEvent.COMPLETED]: false } });
});

test("an administrator sends a test SMS to a typed phone through their own municipality's account, and only learns whether it went", async (t) => {
  const { request, remoteCalls } = await fixture(t);
  const body = { municipalityId: OTHER, phone: "(48) 99999-1234" };
  const off = await request("/sms/test-message", { method: "POST", body });
  assert.equal(off.status, 200); assert.equal(off.cache, "no-store");
  assert.deepEqual(off.body, { status: "skipped", reason: "Ative o SMS antes de enviar um teste." });
  assert.equal(remoteCalls.length, 0);
  await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { active: true, token: TOKEN } });
  const before = remoteCalls.length;
  const sent = await request("/sms/test-message", { method: "POST", body });
  assert.equal(sent.status, 200); assert.equal(sent.cache, "no-store");
  assert.deepEqual(sent.body, { status: "sent", providerMessageId: "4321" });
  assert.equal(remoteCalls.length, before + 1);
  const call = remoteCalls[before];
  assert.equal(call.url, "https://smsmais.com/send"); assert.equal(call.options.headers.Authorization, `Bearer ${TOKEN}`);
  const [message] = JSON.parse(call.options.body).messages;
  assert.equal(message.destinations[0].to, "5548999991234");
  assert.match(message.msg, /^Test Town: teste de envio de SMS/, "the municipality is the administrator's own, not the forged one");
  assert.equal(JSON.stringify(sent.body).includes(TOKEN), false); assert.equal(JSON.stringify(sent.body).includes(message.msg), false);
});

test("a test SMS needs a phone that can receive it, and a global user must choose the municipality", async (t) => {
  const { request, remoteCalls } = await fixture(t);
  await request(`/config/${SMS_CONFIG_KEY}`, { method: "PUT", body: { active: true, token: TOKEN } });
  const before = remoteCalls.length;
  for (const phone of ["", "123", "abc", 48999991234, undefined]) {
    const refused = await request("/sms/test-message", { method: "POST", body: { phone } });
    assert.equal(refused.status, 400, String(phone)); assert.equal(refused.body.error, "Informe um telefone válido com DDD.");
  }
  assert.equal((await request("/sms/test-message", { method: "POST" })).status, 400);
  const global = { ...ADMIN, role: "master", municipalityId: null };
  assert.equal((await request("/sms/test-message", { method: "POST", body: { phone: "48999991234" }, user: global })).status, 400);
  const chosen = await request("/sms/test-message", { method: "POST", body: { municipalityId: OTHER, phone: "48999991234" }, user: global });
  assert.equal(chosen.status, 200); assert.deepEqual(chosen.body, { status: "skipped", reason: "Ative o SMS antes de enviar um teste." });
  assert.equal(remoteCalls.length, before);
});
