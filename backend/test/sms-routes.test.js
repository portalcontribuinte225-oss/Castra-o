import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import smsRoutes from "../src/routes/sms.js";
import configRoutes from "../src/routes/config.js";
import { pool } from "../src/db/index.js";
import { SMS_CONFIG_KEY } from "../../shared/sms-contract.js";
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
    remoteCalls.push({ url, options }); assert.equal(db.state.borrowed, 0); assert.equal(url, "https://smsmais.com/saldo");
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

test("SMS config and connection test deny public, tutor and operator before any settings/provider access", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  for (const user of [null, { ...ADMIN, role: "tutor" }, { ...ADMIN, role: "analista" }]) {
    const expected = user ? 403 : 401;
    assert.equal((await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${MUNICIPALITY}`, { user })).status, expected);
    assert.equal((await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${MUNICIPALITY}`, { user, method: "PUT", body: { token: TOKEN } })).status, expected);
    assert.equal((await request("/sms/test-connection", { user, method: "POST", body: { municipalityId: MUNICIPALITY, token: TOKEN } })).status, expected);
  }
  assert.equal(db.calls.length, 0); assert.equal(remoteCalls.length, 0);
});

test("SMS admin save/read never reveals token and forged municipality cannot cross tenant", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  const saved = await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${OTHER}`, { method: "PUT", body: { active: true, token: TOKEN } });
  assert.equal(saved.status, 200); assert.equal(saved.body.value.active, true); assert.equal(saved.body.value.tokenValid, true); assert.equal(saved.cache, "no-store");
  assert.equal(db.records.has(MUNICIPALITY), true); assert.equal(db.records.has(OTHER), false); assert.equal(remoteCalls.length, 1);
  const own = await request(`/config/${SMS_CONFIG_KEY}?municipalityId=${OTHER}`);
  assert.equal(own.status, 200); assert.equal(own.body.hasToken, true);
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
