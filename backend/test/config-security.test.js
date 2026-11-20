import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import configRoutes from "../src/routes/config.js";
import whatsappRoutes from "../src/routes/whatsapp.js";
import { pool } from "../src/db/index.js";
import { decryptSecretStrict, encryptSecretStrict } from "../src/services/config-secret-cipher.js";
import { SMS_CONFIG_KEY } from "../../shared/sms-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const MASTER = { id: "66666666-6666-4666-8666-666666666666", role: "master" };
const ALLOWED_LOCKS = [`schedule:${MUNICIPALITY_ID}`];
const TEST_SECRET = "notification-route-tests-only";
const clientFetch = globalThis.fetch;

async function fixture(t) {
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
      const value = store.get(`${values[0]}:${values[1]}`);
      return { rows: value === undefined ? [] : [{ value }] };
    }
    if (sql.includes("INSERT INTO config")) {
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
    return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
  }
  return { request, store, calls };
}

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
  const saved = await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: [{ id: "procedure", overrideDailyLimit: true, documents: [{ id: "identity", required: false }] }] });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.value[0].overrideDailyLimit, true);
  assert.deepEqual(saved.body.value[0].documents[0], { id: "identity", required: false, reuseScope: "request", reuseValidityDays: null });
});

test("tutors cannot read internal config or write any known or unknown key", async (t) => {
  const { request, calls } = await fixture(t);
  const user = { ...ADMIN, role: "tutor" };
  for (const key of ["castragestao:teams", "permission_groups"]) {
    assert.equal((await request(`/config/${key}`, { user })).status, 403);
  }
  for (const key of ["castragestao:teams", "permission_groups", "castragestao:species", "new_unregistered_key"]) {
    assert.equal((await request(`/config/${key}`, { user, method: "PUT", body: {} })).status, 403);
  }
  assert.equal(calls.length, 0);
});

test("the retired auth delivery, notification, contract and SMS keys are no longer served or writable", async (t) => {
  const { request, calls, store } = await fixture(t);
  store.set(`castragestao:notifications:${MUNICIPALITY_ID}`, { multiChannel: true });
  for (const key of ["castragestao:auth-delivery", "castragestao:notifications", "whatsapp_quota", "sms_quota", "email_quota", SMS_CONFIG_KEY]) {
    assert.equal((await request(`/config/${key}?municipalityId=${MUNICIPALITY_ID}`)).status, 404, key);
    assert.equal((await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: { multiChannel: true } })).status, 403, key);
  }
  assert.equal(calls.length, 0);
});

test("tutors and operational users cannot write flow or channel configuration", async (t) => {
  const { request, calls } = await fixture(t);
  const keys = ["whatsapp", "castragestao:request-types"];
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
  const species = "castragestao:species";
  const response = await request(`/config/${species}?municipalityId=${OTHER_MUNICIPALITY_ID}`, {
    method: "PUT", user: ADMIN, body: [{ id: "dog", name: "Dog" }],
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.municipality_id, MUNICIPALITY_ID);
  assert.equal(store.has(`${species}:${OTHER_MUNICIPALITY_ID}`), false);
  assert.equal(store.has(`${species}:${MUNICIPALITY_ID}`), true);
  assert.equal(calls.find(({ sql }) => sql.includes("INSERT INTO config")).values[1], MUNICIPALITY_ID);
});

test("global administrators must select a municipality for restricted configuration", async (t) => {
  const { request, calls } = await fixture(t);
  for (const key of ["whatsapp", "castragestao:request-types"]) {
    assert.equal((await request(`/config/${key}`, { method: "PUT", user: { role: "master" }, body: {} })).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await request(`/config/castragestao:species?municipalityId=${OTHER_MUNICIPALITY_ID}`, {
    method: "PUT", user: { role: "master" }, body: [{ id: "dog", name: "Dog" }],
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.municipality_id, OTHER_MUNICIPALITY_ID);
});

test("AI saves preserve the encrypted key when secure storage is temporarily unavailable", async (t) => {
  const { request, store } = await fixture(t);
  const originalKey = process.env.CONFIG_ENCRYPTION_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY;
    else process.env.CONFIG_ENCRYPTION_KEY = originalKey;
  });
  process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  const encryptedKey = encryptSecretStrict("saved-test-key");
  delete process.env.CONFIG_ENCRYPTION_KEY;

  const row = `ai:${MUNICIPALITY_ID}`;
  store.set(row, { active: true, provider: "OpenAI", model: "previous", apiKey: encryptedKey, keyValid: true });
  const save = (body) => request("/config/ai", { user: ADMIN, method: "PUT", body });

  const unchanged = await save({ active: true, apiKey: "" });
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.body.value.hasApiKey, true);
  assert.equal(unchanged.body.value.apiKey, "");
  assert.equal(store.get(row).apiKey, encryptedKey);

  const changeModel = await save({ model: "next" });
  assert.equal(changeModel.status, 503);
  assert.equal(store.get(row).model, "previous");
  assert.equal(store.get(row).apiKey, encryptedKey);

  assert.equal((await save({ active: false })).status, 200);
  assert.equal(store.get(row).apiKey, encryptedKey);
  assert.equal((await save({ apiKey: "replacement-test-key" })).status, 503);
  assert.equal(store.get(row).apiKey, encryptedKey);

  const removed = await save({ clearApiKey: true });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.value.hasApiKey, false);
  assert.equal(store.get(row).apiKey, "");
});

test("AI saves encrypt legacy keys and preserve provider validation when the key stays the same", async (t) => {
  const { request, store } = await fixture(t);
  const originalKey = process.env.CONFIG_ENCRYPTION_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY;
    else process.env.CONFIG_ENCRYPTION_KEY = originalKey;
  });
  process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  globalThis.fetch = async () => { throw new Error("Unexpected provider validation"); };

  const row = `ai:${MUNICIPALITY_ID}`;
  const lastValidatedAt = "2026-01-01T00:00:00Z";
  const apiKey = "legacy-test-key";
  store.set(row, { active: true, provider: "OpenAI", model: "previous", apiKey, keyValid: true, lastValidatedAt });
  const save = (body) => request("/config/ai", { user: ADMIN, method: "PUT", body });

  const saved = await save({ active: true });
  assert.equal(saved.status, 200);
  const encryptedKey = store.get(row).apiKey;
  assert.equal(decryptSecretStrict(encryptedKey), apiKey);

  const sameKey = await save({ apiKey });
  assert.equal(sameKey.status, 200);
  assert.equal(sameKey.body.value.lastValidatedAt, lastValidatedAt);
  assert.equal(store.get(row).apiKey, encryptedKey);
});

test("the WhatsApp quota is no longer served or reset through the configuration or WhatsApp routes", async (t) => {
  const { request, calls } = await fixture(t);
  for (const user of [ADMIN, { ...ADMIN, role: "master" }]) {
    assert.equal((await request(`/whatsapp/quota-status?municipalityId=${MUNICIPALITY_ID}`, { user })).status, 404);
    assert.equal((await request("/whatsapp/reset-quota", { method: "POST", user, body: {} })).status, 404);
  }
  assert.equal(calls.length, 0);
});

test("WhatsApp tests are the master's: the manager, the operators and the support are refused before any database access", async (t) => {
  const { request, calls } = await fixture(t);
  for (const role of ["tutor", "analista", "servidor_publico", "admin_municipal", "suporte"]) {
    assert.equal((await request("/whatsapp/test", { method: "POST", user: { ...ADMIN, role }, body: { municipalityId: OTHER_MUNICIPALITY_ID, phone: "48999991234" } })).status, 403);
  }
  assert.equal(calls.length, 0);
});

test("the WhatsApp connection is written by the master only, who chooses the municipality, and the manager cannot write it", async (t) => {
  const { request, calls, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: false });
  store.set(`whatsapp:${OTHER_MUNICIPALITY_ID}`, { active: false });
  const refused = await request("/config/whatsapp", { method: "PUT", user: ADMIN, body: { active: true } });
  assert.equal(refused.status, 403);
  assert.equal(store.get(`whatsapp:${MUNICIPALITY_ID}`).active, false);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO config")), false);
  const written = await request(`/config/whatsapp?municipalityId=${OTHER_MUNICIPALITY_ID}`, { method: "PUT", user: MASTER, body: { active: true } });
  assert.equal(written.status, 200);
  assert.equal(written.body.municipality_id, OTHER_MUNICIPALITY_ID);
  assert.equal(store.get(`whatsapp:${OTHER_MUNICIPALITY_ID}`).active, true);
  assert.equal(store.get(`whatsapp:${MUNICIPALITY_ID}`).active, false);
  const tested = await request("/whatsapp/test", { method: "POST", user: MASTER, body: { municipalityId: MUNICIPALITY_ID, phone: "48999991234" } });
  assert.equal(tested.status, 200);
  assert.equal(tested.body.status, "skipped");
});

test("WhatsApp test requires valid phone and does not expose provider error data", async (t) => {
  const { request, store } = await fixture(t);
  assert.equal((await request("/whatsapp/test", { method: "POST", user: MASTER, body: { phone: "123", municipalityId: MUNICIPALITY_ID } })).status, 400);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: true, accessToken: "private-token", phoneNumberId: "12345" });
  store.set(`whatsapp_active_templates:${MUNICIPALITY_ID}`, { active: { schedule_confirmed: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } } });
  store.set(`whatsapp_catalog:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [{ name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY",
    parameterFormat: "POSITIONAL", hasBody: true, bodyVariables: 5, bodySequential: true, header: "TEXT", buttons: [], extraComponents: false }] });
  globalThis.fetch = async () => ({ ok: false, status: 400, statusText: "refused", json: async () => ({ error: { message: "private-provider-details", code: 400 } }) });
  const response = await request("/whatsapp/test", { method: "POST", user: MASTER, body: { phone: "48999991234", municipalityId: MUNICIPALITY_ID } });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "failed");
  assert.equal(response.body.providerResponse, undefined);
  assert.equal(JSON.stringify(response.body).includes("private-provider-details"), false);
  assert.equal(JSON.stringify(response.body).includes("private-token"), false);
});

test("the identification types are not a configuration any more: nobody reads or writes them", async (t) => {
  const { request, calls } = await fixture(t);
  const key = "castragestao:identification-types";
  assert.equal((await request(`/config/${key}`)).status, 404);
  for (const user of [ADMIN, { ...ADMIN, role: "master" }]) {
    assert.equal((await request(`/config/${key}`, { user })).status, 404);
    assert.equal((await request(`/config/${key}`, { method: "PUT", user, body: [{ id: "animal_sem_tutor", stepTutor: false }] })).status, 403);
  }
  assert.equal(calls.length, 0);
});
