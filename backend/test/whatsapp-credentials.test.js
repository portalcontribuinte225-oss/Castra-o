import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import configRoutes from "../src/routes/config.js";
import whatsappRoutes from "../src/routes/whatsapp.js";
import { pool } from "../src/db/index.js";
import { WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, WHATSAPP_CATALOG_CONFIG_KEY } from "../../shared/whatsapp-templates-contract.js";
import { prepareWhatsappCredentials, publicWhatsappConfig } from "../src/services/whatsapp-credentials.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const STAFF = { id: "44444444-4444-4444-8444-444444444444", role: "analista", municipalityId: MUNICIPALITY_ID };
const MASTER = { id: "66666666-6666-4666-8666-666666666666", role: "master" };
const WHATSAPP_PATH = `/config/whatsapp?municipalityId=${MUNICIPALITY_ID}`;
const TUTOR = { id: "55555555-5555-4555-8555-555555555555", role: "tutor", municipalityId: MUNICIPALITY_ID };
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const clientFetch = globalThis.fetch;

const confirmation = (overrides = {}) => ({
  name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY", parameterFormat: "POSITIONAL", hasBody: true,
  bodyVariables: 5, bodySequential: true, header: "TEXT", buttons: [], extraComponents: false, ...overrides,
});
const activeConfirmation = { active: { schedule_confirmed: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } } };

async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, key: process.env.CONFIG_ENCRYPTION_KEY };
  process.env.JWT_SECRET = "whatsapp-credentials-tests-only";
  process.env.CONFIG_ENCRYPTION_KEY = ENCRYPTION_KEY;
  const store = new Map();
  const users = new Map();
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("SELECT value FROM config")) {
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
  pool.connect = async () => ({ query, release() {} });
  const app = express();
  app.use(express.json());
  app.use("/config", configRoutes);
  app.use("/whatsapp", whatsappRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
    globalThis.fetch = clientFetch;
    for (const [name, value] of [["JWT_SECRET", previous.secret], ["CONFIG_ENCRYPTION_KEY", previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  async function request(path, { user, method = "GET", body } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, store };
}

test("credentials keep only known fields, encrypt the token and reject malformed identifiers", (t) => {
  const previousKey = process.env.CONFIG_ENCRYPTION_KEY;
  process.env.CONFIG_ENCRYPTION_KEY = ENCRYPTION_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previousKey; });
  const saved = prepareWhatsappCredentials({ confirmationTemplate: "old", templateVariables: ["x"], languageCode: "pt_BR" }, {
    active: true, phoneNumberId: " 123456789 ", wabaId: "987654321", accessToken: " secret-token ", confirmationTemplate: "ignored", hasAccessToken: true,
  });
  assert.deepEqual(Object.keys(saved).sort(), ["accessToken", "active", "phoneNumberId", "provider", "tokenPreview", "wabaId"]);
  assert.equal(saved.phoneNumberId, "123456789");
  assert.match(saved.accessToken, /^enc:v1:/);
  assert.equal(saved.accessToken.includes("secret-token"), false);
  assert.equal(saved.tokenPreview, "secret-t");
  const kept = prepareWhatsappCredentials(saved, { phoneNumberId: "123456789" });
  assert.equal(kept.accessToken, saved.accessToken);
  assert.equal(kept.tokenPreview, "secret-t");
  assert.equal(kept.wabaId, "987654321");
  assert.equal(prepareWhatsappCredentials({ accessToken: "legacy-plain" }, {}).accessToken, "legacy-plain");
  for (const input of [{ phoneNumberId: "12 34" }, { wabaId: "abc12345" }, { phoneNumberId: "123" }, { accessToken: "x".repeat(1001) }]) {
    assert.throws(() => prepareWhatsappCredentials({}, input), { status: 400 });
  }
});

test("removing the token clears it and its preview, turns the channel off and wins over a new token", (t) => {
  const previousKey = process.env.CONFIG_ENCRYPTION_KEY;
  process.env.CONFIG_ENCRYPTION_KEY = ENCRYPTION_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previousKey; });
  const saved = prepareWhatsappCredentials({}, { active: true, phoneNumberId: "123456789", wabaId: "987654321", accessToken: "EAAFAKE0TOKEN1234567" });
  assert.equal(saved.tokenPreview, "EAAFAKE0");
  const removed = prepareWhatsappCredentials(saved, { clearAccessToken: true });
  assert.deepEqual(removed, { active: false, provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", accessToken: "", tokenPreview: "" });
  assert.deepEqual(prepareWhatsappCredentials(saved, { clearAccessToken: true, accessToken: "another-token", active: true }), removed);
  assert.equal(prepareWhatsappCredentials(saved, { clearAccessToken: "true" }).accessToken, saved.accessToken);
  assert.equal(prepareWhatsappCredentials({ accessToken: "legacy-plain" }, {}).tokenPreview, "");
  assert.equal(prepareWhatsappCredentials(removed, { accessToken: "fresh-token" }).tokenPreview, "fresh-to");
});

test("turning the switch on or off keeps the saved token and its preview, so it survives a page reload", (t) => {
  const previousKey = process.env.CONFIG_ENCRYPTION_KEY;
  process.env.CONFIG_ENCRYPTION_KEY = ENCRYPTION_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previousKey; });
  const saved = prepareWhatsappCredentials({}, { active: false, phoneNumberId: "123456789", wabaId: "987654321", accessToken: "EAAFAKE0TOKEN1234567" });
  assert.equal(saved.active, false);
  const on = prepareWhatsappCredentials(saved, { provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", active: true });
  assert.deepEqual(on, { ...saved, active: true });
  assert.deepEqual(prepareWhatsappCredentials(on, { phoneNumberId: "123456789", wabaId: "987654321", active: false }), saved);
  assert.equal(publicWhatsappConfig(on, true).active, true);
});

test("saving a token without the encryption key fails instead of storing plain text", () => {
  const previous = process.env.CONFIG_ENCRYPTION_KEY;
  delete process.env.CONFIG_ENCRYPTION_KEY;
  try {
    assert.throws(() => prepareWhatsappCredentials({}, { accessToken: "secret-token" }), (error) => error.status === 503 && !error.message.includes("secret-token"));
    assert.equal(prepareWhatsappCredentials({ accessToken: "stored" }, { phoneNumberId: "123456" }).accessToken, "stored");
  } finally {
    if (previous === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previous;
  }
});

test("visitors only learn whether WhatsApp is on; staff also see identifiers but never the token", () => {
  const stored = { active: true, phoneNumberId: "123456", wabaId: "654321", accessToken: "enc:v1:secret", tokenPreview: "EAAFAKE0", confirmationTemplate: "old" };
  assert.deepEqual(publicWhatsappConfig(stored, false), { active: true });
  assert.deepEqual(publicWhatsappConfig(stored, true), { active: true, provider: "cloud_api", phoneNumberId: "123456", wabaId: "654321", hasAccessToken: true, tokenPreview: "EAAFAKE0" });
  assert.equal(publicWhatsappConfig({ ...stored, accessToken: "" }, true).tokenPreview, "");
  assert.deepEqual(publicWhatsappConfig(null, false), { active: false });
  assert.deepEqual(publicWhatsappConfig(undefined, true), { active: false, provider: "cloud_api", phoneNumberId: "", wabaId: "", hasAccessToken: false, tokenPreview: "" });
});

test("the public WhatsApp configuration exposes only the active flag, while staff reads omit the token", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: true, phoneNumberId: "123456", wabaId: "654321", accessToken: "enc:v1:secret", confirmationTemplate: "old" });
  assert.deepEqual((await request(`/config/whatsapp?municipalityId=${MUNICIPALITY_ID}`)).body, { active: true });
  assert.deepEqual((await request("/config/whatsapp", { user: TUTOR })).body, { active: true });
  const staff = await request("/config/whatsapp", { user: STAFF });
  assert.deepEqual(staff.body, { active: true, provider: "cloud_api", phoneNumberId: "123456", wabaId: "654321", hasAccessToken: true, tokenPreview: "" });
  assert.equal(JSON.stringify(staff.body).includes("secret"), false);
});

test("the master saves the credentials of a municipality with an encrypted token and the response never returns it", async (t) => {
  const { request, store } = await fixture(t);
  const saved = await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { active: true, phoneNumberId: "123456789", wabaId: "987654321", accessToken: "private-token", confirmationTemplate: "old", templateVariables: ["x"] } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.value, { active: true, provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", hasAccessToken: true, tokenPreview: "private-" });
  const stored = store.get(`whatsapp:${MUNICIPALITY_ID}`);
  assert.match(stored.accessToken, /^enc:v1:/);
  assert.equal(JSON.stringify(stored).includes("private-token"), false);
  assert.equal(Object.hasOwn(stored, "confirmationTemplate"), false);
  assert.equal((await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { phoneNumberId: "12 34 56" } })).status, 400);
  const removed = await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { clearAccessToken: true } });
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.value, { active: false, provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", hasAccessToken: false, tokenPreview: "" });
  assert.equal(store.get(`whatsapp:${MUNICIPALITY_ID}`).accessToken, "");
  delete process.env.CONFIG_ENCRYPTION_KEY;
  const unavailable = await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { accessToken: "another-token" } });
  assert.equal(unavailable.status, 503);
  assert.equal(JSON.stringify(unavailable.body).includes("another-token"), false);
});

test("the municipal manager, the operators and the support cannot write the WhatsApp connection or test it, and nothing is stored", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: false, phoneNumberId: "123456" });
  for (const user of [ADMIN, STAFF, { id: "77777777-7777-4777-8777-777777777777", role: "suporte" }]) {
    assert.equal((await request(WHATSAPP_PATH, { user, method: "PUT", body: { active: true, accessToken: "x" } })).status, 403, user.role);
    assert.equal((await request("/whatsapp/test", { user, method: "POST", body: { phone: "48999991234", municipalityId: MUNICIPALITY_ID } })).status, 403, user.role);
  }
  assert.deepEqual(store.get(`whatsapp:${MUNICIPALITY_ID}`), { active: false, phoneNumberId: "123456" });
  assert.equal((await request(WHATSAPP_PATH, { user: null, method: "PUT", body: { active: true } })).status, 401);
});

test("the connection test sends the active confirmation template, refuses unusable ones and never exposes provider data", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: true, phoneNumberId: "123456", accessToken: "private-token" });
  const phone = { phone: "48999991234", municipalityId: MUNICIPALITY_ID };
  const sent = [];
  globalThis.fetch = async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true }; };
  const none = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(none.body.status, "skipped");
  assert.match(none.body.reason, /Ative o template/);
  assert.equal(sent.length, 0);
  store.set(`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:${MUNICIPALITY_ID}`, activeConfirmation);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [confirmation()] });
  const ok = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(ok.body.status, "sent");
  assert.equal(sent[0].body.template.name, "castracao_confirmacao_agendamento");
  assert.deepEqual(sent[0].body.template.components[0].parameters.map(({ text }) => text), ["Teste", "20/11/2026", "09:00", "Unidade Veterinária Municipal", "123/2026"]);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [confirmation({ status: "PAUSED" })] });
  const blocked = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(blocked.body.status, "skipped");
  assert.equal(sent.length, 1);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [confirmation()] });
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 132015, message: "private-provider-details" } }) });
  const paused = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(paused.body.status, "failed");
  assert.equal(JSON.stringify(paused.body).includes("private-provider-details"), false);
  assert.equal(store.get(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`).templates[0].status, "PAUSED");
});
