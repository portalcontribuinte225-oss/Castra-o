import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import configRoutes from "../src/routes/config.js";
import whatsappRoutes from "../src/routes/whatsapp.js";
import { pool } from "../src/db/index.js";
import { NOTIFICATIONS_CONFIG_KEY, buildDefaultNotificationConfig } from "../../shared/notification-contract.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const TEST_SECRET = "notification-route-tests-only";
const clientFetch = globalThis.fetch;

async function fixture(t, { beforeQuotaLock, failConfigWrite = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = TEST_SECRET;
  const store = new Map();
  const calls = [];
  let transactionStarted = false;
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql === "BEGIN") { transactionStarted = true; return { rows: [] }; }
    if (sql === "COMMIT" || sql === "ROLLBACK") { transactionStarted = false; return { rows: [] }; }
    if (sql.includes("SELECT value FROM config")) {
      if (values[0] === "whatsapp_quota" && sql.includes("FOR UPDATE")) {
        assert.equal(transactionStarted, true, "Quota row must be locked inside a transaction");
        await beforeQuotaLock?.(store);
      }
      const value = store.get(`${values[0]}:${values[1]}`);
      return { rows: value === undefined ? [] : [{ value }] };
    }
    if (sql.includes("INSERT INTO config")) {
      if (failConfigWrite) throw new Error("Simulated config write failure");
      const value = JSON.parse(values[2]);
      store.set(`${values[0]}:${values[1]}`, value);
      return { rows: [{ key: values[0], municipality_id: values[1], value }] };
    }
    if (sql.includes("INSERT INTO audit_logs")) return { rows: [] };
    throw new Error("Unexpected test database operation");
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() { assert.equal(transactionStarted, false); } });
  const app = express();
  app.use(express.json());
  app.use("/config", configRoutes);
  app.use("/whatsapp", whatsappRoutes);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
    globalThis.fetch = previous.fetch;
    if (previous.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.secret;
  });
  async function request(path, { user, method = "GET", body } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(user ? { Authorization: `Bearer ${jwt.sign(user, TEST_SECRET)}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, store, calls };
}

test("public notification configuration requires a municipality and returns safe defaults", async (t) => {
  const { request, calls } = await fixture(t);
  assert.equal((await request(`/config/${NOTIFICATIONS_CONFIG_KEY}`)).status, 400);
  assert.equal(calls.length, 0);
  const response = await request(`/config/${NOTIFICATIONS_CONFIG_KEY}?municipalityId=${MUNICIPALITY_ID}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, buildDefaultNotificationConfig());
  assert.deepEqual(calls[0].values, [NOTIFICATIONS_CONFIG_KEY, MUNICIPALITY_ID]);
});

test("public notification configuration whitelists fields even for older malformed stored values", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`${NOTIFICATIONS_CONFIG_KEY}:${MUNICIPALITY_ID}`, {
    emailEnabled: false, smsEnabled: true, emailTemplateId: "template_notifications", accessToken: "must-not-be-public",
    whatsappTemplates: { completed: "finished", accessToken: "must-not-be-public" },
  });
  const response = await request(`/config/${NOTIFICATIONS_CONFIG_KEY}?municipalityId=${MUNICIPALITY_ID}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.emailEnabled, true);
  assert.equal(response.body.smsEnabled, false);
  assert.equal(response.body.emailTemplateId, "template_notifications");
  assert.equal(response.body.whatsappTemplates.completed, "finished");
  assert.equal(JSON.stringify(response.body).includes("must-not-be-public"), false);
});

test("tutors and operational users cannot write flow or notification configuration", async (t) => {
  const { request, calls } = await fixture(t);
  const keys = [NOTIFICATIONS_CONFIG_KEY, "whatsapp", "whatsapp_quota", "castragestao:request-types", "castragestao:identification-types"];
  for (const role of ["tutor", "analista", "servidor_publico", "ong", "protetor"]) {
    for (const key of keys) {
      const response = await request(`/config/${key}`, { method: "PUT", user: { ...ADMIN, role }, body: {} });
      assert.equal(response.status, 403, `${role} must not write ${key}`);
    }
  }
  assert.equal(calls.length, 0);
});

test("municipal administrators cannot redirect config writes to another municipality", async (t) => {
  const { request, calls, store } = await fixture(t);
  const response = await request(`/config/${NOTIFICATIONS_CONFIG_KEY}?municipalityId=${OTHER_MUNICIPALITY_ID}`, {
    method: "PUT", user: ADMIN,
    body: { ...buildDefaultNotificationConfig(), emailTemplateId: "template_own", municipalityId: OTHER_MUNICIPALITY_ID, accessToken: "discard-me" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.municipality_id, MUNICIPALITY_ID);
  assert.equal(response.body.value.emailTemplateId, "template_own");
  assert.equal(response.body.value.accessToken, undefined);
  assert.equal(store.has(`${NOTIFICATIONS_CONFIG_KEY}:${OTHER_MUNICIPALITY_ID}`), false);
  assert.equal(calls.find(({ sql }) => sql.includes("INSERT INTO config")).values[1], MUNICIPALITY_ID);
});

test("global administrators must select a municipality for restricted configuration", async (t) => {
  const { request, calls } = await fixture(t);
  for (const key of [NOTIFICATIONS_CONFIG_KEY, "whatsapp", "whatsapp_quota", "castragestao:request-types", "castragestao:identification-types"]) {
    assert.equal((await request(`/config/${key}`, { method: "PUT", user: { role: "master" }, body: {} })).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await request(`/config/${NOTIFICATIONS_CONFIG_KEY}?municipalityId=${OTHER_MUNICIPALITY_ID}`, {
    method: "PUT", user: { role: "master" }, body: buildDefaultNotificationConfig(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.municipality_id, OTHER_MUNICIPALITY_ID);
});

test("notification configuration rejects disabled email, enabled SMS and malformed templates", async (t) => {
  const { request, calls } = await fixture(t);
  for (const body of [
    { emailEnabled: false }, { emailEnabled: "true" }, { smsEnabled: true },
    { emailTemplateId: {} }, { emailTemplateId: "x".repeat(201) },
    { whatsappTemplates: [] }, { whatsappTemplates: { completed: false } },
    { whatsappTemplates: { unrecognized_event: "not_a_supported_event" } },
  ]) {
    assert.equal((await request(`/config/${NOTIFICATIONS_CONFIG_KEY}`, { method: "PUT", user: ADMIN, body })).status, 400);
  }
  assert.equal(calls.length, 0);
});

test("municipal quota readers are scoped to their municipality despite query override", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request(`/whatsapp/quota-status?municipalityId=${OTHER_MUNICIPALITY_ID}`, { user: { ...ADMIN, role: "tutor" } });
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].values, ["whatsapp_quota", MUNICIPALITY_ID]);
});

test("quota reset and WhatsApp tests require an administrator", async (t) => {
  const { request, calls } = await fixture(t);
  for (const role of ["tutor", "analista", "servidor_publico"]) {
    for (const path of ["/whatsapp/reset-quota", "/whatsapp/test"]) {
      assert.equal((await request(path, { method: "POST", user: { ...ADMIN, role }, body: { municipalityId: OTHER_MUNICIPALITY_ID, phone: "48999991234" } })).status, 403);
    }
  }
  assert.equal(calls.length, 0);
});

test("municipal WhatsApp reset/test operations ignore forged municipality identifiers", async (t) => {
  const { request, calls, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: false });
  assert.equal((await request("/whatsapp/reset-quota", { method: "POST", user: ADMIN, body: { municipalityId: OTHER_MUNICIPALITY_ID } })).status, 200);
  const response = await request("/whatsapp/test", { method: "POST", user: ADMIN, body: { municipalityId: OTHER_MUNICIPALITY_ID, phone: "48999991234" } });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "skipped");
  assert.equal(calls.filter(({ values }) => values.length).every(({ values }) => values[1] === MUNICIPALITY_ID), true);
});

test("quota settings lock the latest usage before saving contract changes", async (t) => {
  const key = `whatsapp_quota:${MUNICIPALITY_ID}`;
  const { request, calls, store } = await fixture(t, {
    beforeQuotaLock: (values) => values.set(key, { ...values.get(key), currentPeriodUsed: 8 }),
  });
  store.set(key, { plan: 100, currentPeriodUsed: 7, currentPeriodStart: "2026-11", contractStart: "2026-01-01", contractEnd: "2026-12-31" });
  const response = await request("/config/whatsapp_quota", {
    method: "PUT", user: ADMIN, body: { plan: 200, currentPeriodUsed: 0, currentPeriodStart: "forged" },
  });
  assert.equal(response.status, 200);
  assert.equal(store.get(key).plan, 200);
  assert.equal(store.get(key).currentPeriodUsed, 8);
  assert.equal(store.get(key).currentPeriodStart, "2026-11");
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[1].sql, /SELECT value FROM config.*FOR UPDATE$/);
  assert.match(calls[2].sql, /INSERT INTO config/);
  assert.match(calls[3].sql, /INSERT INTO audit_logs/);
  assert.equal(calls[4].sql, "COMMIT");
});

test("explicit quota reset serializes the read and preserves the latest contract", async (t) => {
  const key = `whatsapp_quota:${MUNICIPALITY_ID}`;
  const { request, calls, store } = await fixture(t, {
    beforeQuotaLock: (values) => values.set(key, { ...values.get(key), plan: 250, contractEnd: "2027-12-31" }),
  });
  store.set(key, { plan: 100, currentPeriodUsed: 50, currentPeriodStart: "2026-11", contractEnd: "2026-12-31" });
  const response = await request("/whatsapp/reset-quota", { method: "POST", user: ADMIN, body: {} });
  assert.equal(response.status, 200);
  assert.deepEqual(store.get(key), { plan: 250, currentPeriodUsed: 0, currentPeriodStart: "", contractEnd: "2027-12-31" });
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[1].sql, /SELECT value FROM config.*FOR UPDATE$/);
  assert.match(calls[2].sql, /INSERT INTO config/);
  assert.equal(calls[3].sql, "COMMIT");
});

test("quota setting and reset transactions rollback failed writes", async (t) => {
  const { request, calls } = await fixture(t, { failConfigWrite: true });
  for (const path of ["/config/whatsapp_quota", "/whatsapp/reset-quota"]) {
    const response = await request(path, { method: path.startsWith("/config") ? "PUT" : "POST", user: ADMIN, body: { plan: 100 } });
    assert.equal(response.status, 500);
  }
  assert.equal(calls.filter(({ sql }) => sql === "BEGIN").length, 2);
  assert.equal(calls.filter(({ sql }) => sql === "ROLLBACK").length, 2);
  assert.equal(calls.some(({ sql }) => sql === "COMMIT"), false);
});

test("WhatsApp test requires valid phone and does not expose provider error data", async (t) => {
  const { request, store } = await fixture(t);
  assert.equal((await request("/whatsapp/test", { method: "POST", user: ADMIN, body: { phone: "123" } })).status, 400);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: true, accessToken: "private-token", phoneNumberId: "12345", confirmationTemplate: "test_template" });
  globalThis.fetch = async () => ({ ok: false, status: 400, statusText: "refused", json: async () => ({ error: { message: "private-provider-details", code: 400 } }) });
  const response = await request("/whatsapp/test", { method: "POST", user: ADMIN, body: { phone: "48999991234" } });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "failed");
  assert.equal(response.body.providerResponse, undefined);
  assert.equal(JSON.stringify(response.body).includes("private-provider-details"), false);
  assert.equal(JSON.stringify(response.body).includes("private-token"), false);
});
