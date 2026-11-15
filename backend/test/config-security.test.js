import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import configRoutes from "../src/routes/config.js";
import whatsappRoutes from "../src/routes/whatsapp.js";
import { pool } from "../src/db/index.js";
import { NOTIFICATIONS_CONFIG_KEY, buildDefaultNotificationConfig } from "../../shared/notification-contract.js";
import { AUTH_DELIVERY_CONFIG_KEY, buildDefaultAuthDeliveryConfig } from "../../shared/auth-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const ALLOWED_LOCKS = [
  `schedule:${MUNICIPALITY_ID}`,
  ...[NOTIFICATIONS_CONFIG_KEY, AUTH_DELIVERY_CONFIG_KEY].flatMap((key) => [MUNICIPALITY_ID, OTHER_MUNICIPALITY_ID].map((id) => `channel-config:${key}:${id}`)),
];
const TEST_SECRET = "notification-route-tests-only";
const clientFetch = globalThis.fetch;

async function fixture(t, { beforeQuotaLock, failConfigWrite = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = TEST_SECRET;
  const store = new Map();
  const calls = [];
  const users = new Map();
  let transactionStarted = false;
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
    if (sql === "BEGIN") { transactionStarted = true; return { rows: [] }; }
    if (sql === "COMMIT" || sql === "ROLLBACK") { transactionStarted = false; return { rows: [] }; }
    if (sql.includes("pg_advisory_xact_lock")) {
      assert.equal(transactionStarted, true, "Locked configuration must hold a transaction lock");
      assert.equal(values.length, 1);
      assert.ok(ALLOWED_LOCKS.includes(values[0]), `Unexpected advisory lock ${values[0]}`);
      return { rows: [] };
    }
    if (sql.includes("SELECT value FROM config")) {
      if (sql.includes("FOR UPDATE")) assert.equal(transactionStarted, true, "Locked rows must be read inside a transaction");
      if (values[0] === "whatsapp_quota" && sql.includes("FOR UPDATE")) await beforeQuotaLock?.(store);
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
        ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
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

test("document policy reads default to request scope and admin writes validate bounded periods", async (t) => {
  const { request, store } = await fixture(t);
  const key = "castragestao:document-types";
  store.set(`${key}:${MUNICIPALITY_ID}`, [{ id: "identity", name: "Identity" }]);
  const read = await request(`/config/${key}?municipalityId=${MUNICIPALITY_ID}`);
  assert.equal(read.status, 200);
  assert.equal(read.body[0].reuseScope, "request");
  assert.equal(read.body[0].reuseValidityDays, null);
  for (const policy of [{ reuseScope: "global" }, { reuseValidityDays: 0 }, { reuseValidityDays: "30" }, { reuseValidityDays: Number.MAX_SAFE_INTEGER }]) {
    const rejected = await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: [{ id: "identity", ...policy }] });
    assert.equal(rejected.status, 400);
  }
  const saved = await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: [{ id: "identity", reuseScope: "tutor", reuseValidityDays: 30 }] });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.value[0].reuseValidityDays, 30);
  assert.equal((await request(`/config/${key}`, { user: { ...ADMIN, role: "tutor" }, method: "PUT", body: [] })).status, 403);
});

test("request type document policy is validated and normalized without removing existing fields", async (t) => {
  const { request } = await fixture(t);
  const key = "castragestao:request-types";
  const invalid = await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: [{ id: "procedure", documents: [{ id: "identity", reuseValidityDays: -1 }] }] });
  assert.equal(invalid.status, 400);
  const saved = await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: [{ id: "procedure", stepAgenda: false, documents: [{ id: "identity", required: false }] }] });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.value[0].stepAgenda, false);
  assert.deepEqual(saved.body.value[0].documents[0], { id: "identity", required: false, reuseScope: "request", reuseValidityDays: null });
});

test("tutors cannot read internal config or write any known or unknown key", async (t) => {
  const { request, calls } = await fixture(t);
  const user = { ...ADMIN, role: "tutor" };
  for (const key of ["castragestao:teams", "permission_groups", "whatsapp_quota", AUTH_DELIVERY_CONFIG_KEY]) {
    assert.equal((await request(`/config/${key}`, { user })).status, 403);
  }
  for (const key of ["castragestao:teams", "permission_groups", "castragestao:species", "new_unregistered_key", AUTH_DELIVERY_CONFIG_KEY]) {
    assert.equal((await request(`/config/${key}`, { user, method: "PUT", body: {} })).status, 403);
  }
  assert.equal(calls.length, 0);
});

test("auth delivery configuration is municipal, internal-readable and admin-writable", async (t) => {
  const { request, store } = await fixture(t);
  assert.equal((await request(`/config/${AUTH_DELIVERY_CONFIG_KEY}?municipalityId=${MUNICIPALITY_ID}`)).status, 401);
  assert.equal((await request(`/config/${AUTH_DELIVERY_CONFIG_KEY}`, { user: { ...ADMIN, role: "analista" }, method: "PUT", body: {} })).status, 403);
  const settings = buildDefaultAuthDeliveryConfig();
  settings.emailTemplates.initial_password = "welcome";
  const saved = await request(`/config/${AUTH_DELIVERY_CONFIG_KEY}?municipalityId=${OTHER_MUNICIPALITY_ID}`, { user: ADMIN, method: "PUT", body: { ...settings, accessToken: "never-stored" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.value.emailTemplates.initial_password, "welcome");
  assert.equal(JSON.stringify(saved.body).includes("never-stored"), false);
  assert.equal(store.has(`${AUTH_DELIVERY_CONFIG_KEY}:${OTHER_MUNICIPALITY_ID}`), false);
  const invalid = await request(`/config/${AUTH_DELIVERY_CONFIG_KEY}`, { user: ADMIN, method: "PUT", body: { emailTemplates: { arbitrary: "wrong" } } });
  assert.equal(invalid.status, 400);
});

test("public notification configuration whitelists fields even for older malformed stored values", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`${NOTIFICATIONS_CONFIG_KEY}:${MUNICIPALITY_ID}`, {
    emailEnabled: false, smsEnabled: true, emailTemplateId: "template_notifications", accessToken: "must-not-be-public",
    whatsappTemplates: { completed: "legacy-name", accessToken: "must-not-be-public" },
  });
  const response = await request(`/config/${NOTIFICATIONS_CONFIG_KEY}?municipalityId=${MUNICIPALITY_ID}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.emailEnabled, true);
  assert.equal(response.body.smsEnabled, false);
  assert.equal(response.body.emailTemplateId, "template_notifications");
  assert.equal(Object.hasOwn(response.body, "whatsappTemplates"), false);
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
  ]) {
    assert.equal((await request(`/config/${NOTIFICATIONS_CONFIG_KEY}`, { method: "PUT", user: ADMIN, body })).status, 400);
  }
  assert.equal(calls.length, 0);
});

test("quota status denies external roles and scopes internal readers despite query override", async (t) => {
  const { request, calls } = await fixture(t);
  for (const role of ["tutor", "ong", "protetor"]) {
    const denied = await request(`/whatsapp/quota-status?municipalityId=${OTHER_MUNICIPALITY_ID}`, { user: { ...ADMIN, role } });
    assert.equal(denied.status, 403);
  }
  assert.equal(calls.length, 0);
  const response = await request(`/whatsapp/quota-status?municipalityId=${OTHER_MUNICIPALITY_ID}`, { user: { ...ADMIN, role: "analista" } });
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].values, ["whatsapp_quota", MUNICIPALITY_ID]);
});

test("quota configuration is never publicly readable and excludes external roles", async (t) => {
  const { request, calls } = await fixture(t);
  const path = `/config/whatsapp_quota?municipalityId=${OTHER_MUNICIPALITY_ID}`;
  assert.equal((await request(path)).status, 401);
  for (const role of ["tutor", "ong", "protetor"]) {
    assert.equal((await request(path, { user: { ...ADMIN, role } })).status, 403);
  }
  assert.equal(calls.length, 0);
  const response = await request(path, { user: { ...ADMIN, role: "servidor_publico" } });
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
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: true, accessToken: "private-token", phoneNumberId: "12345" });
  globalThis.fetch = async () => ({ ok: false, status: 400, statusText: "refused", json: async () => ({ error: { message: "private-provider-details", code: 400 } }) });
  const response = await request("/whatsapp/test", { method: "POST", user: ADMIN, body: { phone: "48999991234" } });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "failed");
  assert.equal(response.body.providerResponse, undefined);
  assert.equal(JSON.stringify(response.body).includes("private-provider-details"), false);
  assert.equal(JSON.stringify(response.body).includes("private-token"), false);
});

test("channel configuration saves merge into the stored value under a transaction lock", async (t) => {
  const { request, store, calls } = await fixture(t);
  store.set(`${AUTH_DELIVERY_CONFIG_KEY}:${MUNICIPALITY_ID}`, {
    emailTemplates: { password_reset: "reset_email" }, whatsappTemplates: { initial_password: "welcome_whatsapp" },
  });
  const auth = await request(`/config/${AUTH_DELIVERY_CONFIG_KEY}`, {
    user: ADMIN, method: "PUT", body: { emailTemplates: { initial_password: "welcome_email" } },
  });
  assert.equal(auth.status, 200);
  assert.equal(auth.body.value.emailTemplates.initial_password, "welcome_email");
  assert.equal(auth.body.value.emailTemplates.password_reset, "reset_email");
  assert.equal(auth.body.value.whatsappTemplates.initial_password, "welcome_whatsapp");

  store.set(`${NOTIFICATIONS_CONFIG_KEY}:${MUNICIPALITY_ID}`, { emailTemplateId: "notify_email" });
  const notifications = await request(`/config/${NOTIFICATIONS_CONFIG_KEY}`, {
    user: ADMIN, method: "PUT", body: {},
  });
  assert.equal(notifications.status, 200);
  assert.deepEqual(notifications.body.value, { ...buildDefaultNotificationConfig(), emailTemplateId: "notify_email" });

  const order = calls.map(({ sql }) => sql.match(/^(?:BEGIN|COMMIT)$|pg_advisory_xact_lock|FOR UPDATE|INSERT INTO config/)?.[0]).filter(Boolean);
  const write = ["BEGIN", "pg_advisory_xact_lock", "FOR UPDATE", "INSERT INTO config", "COMMIT"];
  assert.deepEqual(order, [...write, ...write]);
});

test("email integration status is admin-only, requires a municipality and exposes no credential values", async (t) => {
  const { request, calls } = await fixture(t);
  const secrets = { EMAILJS_SERVICE_ID: "service-secret-value", EMAILJS_PUBLIC_KEY: "public-secret-value", EMAILJS_PRIVATE_KEY: "private-secret-value" };
  const previous = Object.fromEntries([...Object.keys(secrets), "EMAILJS_TEMPLATE_ID"].map((name) => [name, process.env[name]]));
  Object.assign(process.env, secrets);
  delete process.env.EMAILJS_TEMPLATE_ID;
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const path = `/config/email/status?municipalityId=${MUNICIPALITY_ID}`;
  assert.equal((await request(path)).status, 401);
  for (const role of ["tutor", "analista", "servidor_publico", "ong", "protetor"]) {
    assert.equal((await request(path, { user: { ...ADMIN, role } })).status, 403, `${role} must not read e-mail status`);
  }
  assert.equal((await request("/config/email/status", { user: { role: "master" } })).status, 400);
  assert.equal((await request("/config/email/status?municipalityId=invalid", { user: { role: "master" } })).status, 400);
  for (const user of [ADMIN, { role: "master" }]) {
    const response = await request(path, { user });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(response.body, { serviceConfigured: true, publicKeyConfigured: true, privateKeyConfigured: true, recoveryTemplateConfigured: false });
    for (const secret of Object.values(secrets)) assert.equal(JSON.stringify(response.body).includes(secret), false);
  }
  assert.equal(calls.length, 0);
});
