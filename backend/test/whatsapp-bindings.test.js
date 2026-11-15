import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import configRoutes from "../src/routes/config.js";
import whatsappRoutes from "../src/routes/whatsapp.js";
import whatsappTemplateRoutes from "../src/routes/whatsapp-templates.js";
import { pool } from "../src/db/index.js";
import { NotificationEvent } from "../../shared/notification-contract.js";
import {
  WHATSAPP_BINDINGS_CONFIG_KEY, WHATSAPP_CATALOG_CONFIG_KEY, buildDefaultWhatsappBindings,
  normalizeWhatsappBindings, validateWhatsappBindingInput,
} from "../../shared/whatsapp-binding-contract.js";
import { buildBodyComponents } from "../src/services/notifications/whatsapp-template-parameters.js";
import { prepareWhatsappCredentials, publicWhatsappConfig } from "../src/services/whatsapp-credentials.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const STAFF = { id: "44444444-4444-4444-8444-444444444444", role: "analista", municipalityId: MUNICIPALITY_ID };
const TUTOR = { id: "55555555-5555-4555-8555-555555555555", role: "tutor", municipalityId: MUNICIPALITY_ID };
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const clientFetch = globalThis.fetch;

const entry = (overrides = {}) => ({
  name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY",
  bodyText: "Olá {{1}}, {{2}} {{3}} {{4}}", variableCount: 4, supported: true, unsupportedReason: "", ...overrides,
});
const field = (value) => ({ kind: "field", value });
const fourFields = ["tutor_name", "schedule_date", "schedule_time", "schedule_location_name"].map(field);

async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, key: process.env.CONFIG_ENCRYPTION_KEY };
  process.env.JWT_SECRET = "whatsapp-binding-tests-only";
  process.env.CONFIG_ENCRYPTION_KEY = ENCRYPTION_KEY;
  const store = new Map();
  const calls = [];
  const users = new Map();
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
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
  app.use("/whatsapp", whatsappTemplateRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
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
  return { request, store, calls };
}

test("default bindings point the agenda events to the approved Meta templates and leave the others unlinked", () => {
  const defaults = buildDefaultWhatsappBindings();
  assert.deepEqual(Object.keys(defaults), Object.values(NotificationEvent));
  assert.equal(defaults[NotificationEvent.SCHEDULE_CONFIRMED].templateName, "castracao_confirmacao_agendamento");
  assert.equal(defaults[NotificationEvent.SCHEDULE_CONFIRMED].mapping.length, 4);
  assert.equal(defaults[NotificationEvent.SCHEDULE_CHANGED].templateName, "castracao_reagendamento");
  assert.equal(defaults[NotificationEvent.SCHEDULE_CHANGED].mapping.length, 4);
  assert.equal(defaults[NotificationEvent.SCHEDULE_CANCELLED].templateName, "castracao_cancelamento");
  assert.equal(defaults[NotificationEvent.SCHEDULE_CANCELLED].mapping.length, 3);
  assert.equal(defaults[NotificationEvent.DOCUMENTS_REVIEWED], null);
  assert.equal(defaults[NotificationEvent.COMPLETED], null);
  assert.equal(JSON.stringify(defaults).includes('"phone"'), false);
});

test("stored bindings override the defaults, an explicit null unlinks and invalid values unlink safely", () => {
  const custom = { templateName: "custom", languageCode: "pt_BR", mapping: [field("protocol"), { kind: "text", value: " fixed " }] };
  const bindings = normalizeWhatsappBindings({ bindings: {
    [NotificationEvent.COMPLETED]: custom,
    [NotificationEvent.SCHEDULE_CONFIRMED]: null,
    [NotificationEvent.SCHEDULE_CHANGED]: { templateName: "x", languageCode: "pt_BR", mapping: [field("phone")] },
    unknown_event: custom,
  } });
  assert.deepEqual(bindings[NotificationEvent.COMPLETED].mapping, [field("protocol"), { kind: "text", value: "fixed" }]);
  assert.equal(bindings[NotificationEvent.SCHEDULE_CONFIRMED], null);
  assert.equal(bindings[NotificationEvent.SCHEDULE_CHANGED], null);
  assert.equal(bindings[NotificationEvent.SCHEDULE_CANCELLED].templateName, "castracao_cancelamento");
  assert.equal(Object.hasOwn(bindings, "unknown_event"), false);
  assert.deepEqual(normalizeWhatsappBindings(null), buildDefaultWhatsappBindings());
});

test("a binding is accepted only for an approved, supported template with matching variables", () => {
  const input = { templateName: "castracao_confirmacao_agendamento", languageCode: "pt_BR", mapping: fourFields };
  const event = NotificationEvent.SCHEDULE_CONFIRMED;
  assert.equal(validateWhatsappBindingInput(event, input, entry()), "");
  assert.match(validateWhatsappBindingInput("other", input, entry()), /Evento/);
  assert.match(validateWhatsappBindingInput(event, input, null), /Sincronize/);
  for (const status of ["PENDING", "PAUSED", "DISABLED", "REJECTED"]) assert.match(validateWhatsappBindingInput(event, input, entry({ status })), /aprovados/);
  assert.match(validateWhatsappBindingInput(event, input, entry({ supported: false, unsupportedReason: "Cabeçalho com mídia." })), /Cabeçalho/);
  assert.match(validateWhatsappBindingInput(event, { ...input, mapping: fourFields.slice(1) }, entry()), /4 variável/);
  assert.match(validateWhatsappBindingInput(event, { ...input, mapping: [...fourFields.slice(1), field("phone")] }, entry()), /campo/);
  assert.match(validateWhatsappBindingInput(event, { ...input, mapping: [...fourFields.slice(1), { kind: "text", value: "" }] }, entry()), /campo/);
  assert.match(validateWhatsappBindingInput(event, { ...input, mapping: [...fourFields.slice(1), { kind: "text", value: "x".repeat(201) }] }, entry()), /campo/);
  assert.match(validateWhatsappBindingInput(event, { ...input, mapping: [...fourFields.slice(1), { kind: "text", value: "line\nbreak" }] }, entry()), /campo/);
  assert.match(validateWhatsappBindingInput(event, { ...input, languageCode: "" }, entry()), /idioma/);
});

test("body parameters format the date, never send a dash and strip characters the Cloud API rejects", () => {
  const binding = { mapping: [field("tutor_name"), field("schedule_date"), field("schedule_time"), field("schedule_location_name"), field("protocol"), { kind: "text", value: "Fixo" }] };
  const full = buildBodyComponents(binding, { tutor_name: "Maria\nSilva", schedule_date: "2026-11-20", workflow_data: { scheduleSlotTime: "09:00" }, schedule_location_name: "Unidade   Municipal", protocol: "1/2026" });
  assert.deepEqual(full[0].parameters.map(({ text }) => text), ["Maria Silva", "20/11/2026", "09:00", "Unidade Municipal", "1/2026", "Fixo"]);
  const empty = buildBodyComponents(binding, {});
  assert.equal(empty[0].parameters.every(({ text }) => text && text !== "-"), true);
  assert.deepEqual(empty[0].parameters.slice(1, 4).map(({ text }) => text), ["data a confirmar", "hora a confirmar", "local a confirmar"]);
  assert.deepEqual(buildBodyComponents({ mapping: [] }, {}), []);
});

test("credentials keep only known fields, encrypt the token and reject malformed identifiers", (t) => {
  const previousKey = process.env.CONFIG_ENCRYPTION_KEY;
  process.env.CONFIG_ENCRYPTION_KEY = ENCRYPTION_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previousKey; });
  const saved = prepareWhatsappCredentials({ confirmationTemplate: "old", templateVariables: ["x"], languageCode: "pt_BR" }, {
    active: true, phoneNumberId: " 123456789 ", wabaId: "987654321", accessToken: " secret-token ", confirmationTemplate: "ignored", hasAccessToken: true,
  });
  assert.deepEqual(Object.keys(saved).sort(), ["accessToken", "active", "phoneNumberId", "provider", "wabaId"]);
  assert.equal(saved.phoneNumberId, "123456789");
  assert.match(saved.accessToken, /^enc:v1:/);
  assert.equal(saved.accessToken.includes("secret-token"), false);
  const kept = prepareWhatsappCredentials(saved, { phoneNumberId: "123456789" });
  assert.equal(kept.accessToken, saved.accessToken);
  assert.equal(kept.wabaId, "987654321");
  assert.equal(prepareWhatsappCredentials({ accessToken: "legacy-plain" }, {}).accessToken, "legacy-plain");
  for (const input of [{ phoneNumberId: "12 34" }, { wabaId: "abc12345" }, { phoneNumberId: "123" }, { accessToken: "x".repeat(1001) }]) {
    assert.throws(() => prepareWhatsappCredentials({}, input), { status: 400 });
  }
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
  const stored = { active: true, phoneNumberId: "123456", wabaId: "654321", accessToken: "enc:v1:secret", confirmationTemplate: "old" };
  assert.deepEqual(publicWhatsappConfig(stored, false), { active: true });
  assert.deepEqual(publicWhatsappConfig(stored, true), { active: true, provider: "cloud_api", phoneNumberId: "123456", wabaId: "654321", hasAccessToken: true });
  assert.deepEqual(publicWhatsappConfig(null, false), { active: false });
  assert.deepEqual(publicWhatsappConfig(undefined, true), { active: false, provider: "cloud_api", phoneNumberId: "", wabaId: "", hasAccessToken: false });
});

test("the public WhatsApp configuration exposes only the active flag, while staff reads omit the token", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: true, phoneNumberId: "123456", wabaId: "654321", accessToken: "enc:v1:secret", confirmationTemplate: "old" });
  const anonymous = await request(`/config/whatsapp?municipalityId=${MUNICIPALITY_ID}`);
  assert.deepEqual(anonymous.body, { active: true });
  assert.deepEqual((await request("/config/whatsapp", { user: TUTOR })).body, { active: true });
  const staff = await request("/config/whatsapp", { user: STAFF });
  assert.deepEqual(staff.body, { active: true, provider: "cloud_api", phoneNumberId: "123456", wabaId: "654321", hasAccessToken: true });
  assert.equal(JSON.stringify(staff.body).includes("secret"), false);
});

test("administrators save credentials with an encrypted token and the response never returns it", async (t) => {
  const { request, store } = await fixture(t);
  const saved = await request("/config/whatsapp", { user: ADMIN, method: "PUT", body: { active: true, phoneNumberId: "123456789", wabaId: "987654321", accessToken: "private-token", confirmationTemplate: "old", templateVariables: ["x"] } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.value, { active: true, provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", hasAccessToken: true });
  const stored = store.get(`whatsapp:${MUNICIPALITY_ID}`);
  assert.match(stored.accessToken, /^enc:v1:/);
  assert.equal(JSON.stringify(stored).includes("private-token"), false);
  assert.equal(Object.hasOwn(stored, "confirmationTemplate"), false);
  assert.equal((await request("/config/whatsapp", { user: ADMIN, method: "PUT", body: { phoneNumberId: "12 34 56" } })).status, 400);
  delete process.env.CONFIG_ENCRYPTION_KEY;
  const unavailable = await request("/config/whatsapp", { user: ADMIN, method: "PUT", body: { accessToken: "another-token" } });
  assert.equal(unavailable.status, 503);
  assert.equal(JSON.stringify(unavailable.body).includes("another-token"), false);
});

test("binding and catalog endpoints require a municipal administrator and stay off the generic config route", async (t) => {
  const { request, calls } = await fixture(t);
  const paths = [["GET", "/whatsapp/catalog"], ["POST", "/whatsapp/catalog/sync"], ["GET", "/whatsapp/bindings"], ["PUT", `/whatsapp/bindings/${NotificationEvent.COMPLETED}`], ["DELETE", `/whatsapp/bindings/${NotificationEvent.COMPLETED}`]];
  for (const [method, path] of paths) {
    const body = method === "GET" ? undefined : {};
    assert.equal((await request(path, { method, body })).status, 401);
    for (const user of [STAFF, TUTOR]) assert.equal((await request(path, { method, user, body })).status, 403);
  }
  assert.equal(calls.length, 0);
  for (const key of [WHATSAPP_BINDINGS_CONFIG_KEY, WHATSAPP_CATALOG_CONFIG_KEY]) {
    assert.equal((await request(`/config/${key}?municipalityId=${MUNICIPALITY_ID}`, { user: ADMIN })).status, 404);
    assert.equal((await request(`/config/${key}`, { user: ADMIN, method: "PUT", body: {} })).status, 403);
  }
});

test("bindings list the defaults, validate against the municipal catalog, audit changes and can be unlinked", async (t) => {
  const { request, store, calls } = await fixture(t);
  const listed = await request("/whatsapp/bindings", { user: ADMIN });
  assert.deepEqual(listed.body.bindings, buildDefaultWhatsappBindings());
  const completed = `/whatsapp/bindings/${NotificationEvent.COMPLETED}`;
  const body = { templateName: "attendance_done", languageCode: "pt_BR", mapping: [field("protocol"), field("notification_message")] };
  assert.equal((await request(completed, { user: ADMIN, method: "PUT", body })).status, 400);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${OTHER_MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [entry({ name: "attendance_done", variableCount: 2 })] });
  assert.equal((await request(completed, { user: ADMIN, method: "PUT", body: { ...body, municipalityId: OTHER_MUNICIPALITY_ID } })).status, 400);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [entry({ name: "attendance_done", variableCount: 2 }), entry({ name: "paused_one", status: "PAUSED", variableCount: 2 })] });
  assert.equal((await request(completed, { user: ADMIN, method: "PUT", body: { ...body, templateName: "paused_one" } })).status, 400);
  assert.equal((await request(completed, { user: ADMIN, method: "PUT", body: { ...body, mapping: [field("protocol")] } })).status, 400);
  const saved = await request(completed, { user: ADMIN, method: "PUT", body });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.bindings[NotificationEvent.COMPLETED].templateName, "attendance_done");
  assert.equal(saved.body.bindings[NotificationEvent.SCHEDULE_CONFIRMED].templateName, "castracao_confirmacao_agendamento");
  assert.equal(store.has(`${WHATSAPP_BINDINGS_CONFIG_KEY}:${OTHER_MUNICIPALITY_ID}`), false);
  assert.equal(calls.some(({ sql, values }) => sql.includes("INSERT INTO audit_logs") && values[3] === "WHATSAPP_BINDING_UPDATE"), true);
  const removed = await request(`/whatsapp/bindings/${NotificationEvent.SCHEDULE_CONFIRMED}`, { user: ADMIN, method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.bindings[NotificationEvent.SCHEDULE_CONFIRMED], null);
  assert.equal((await request("/whatsapp/bindings", { user: ADMIN })).body.bindings[NotificationEvent.SCHEDULE_CONFIRMED], null);
  assert.equal((await request("/whatsapp/bindings/not_an_event", { user: ADMIN, method: "DELETE" })).status, 400);
});

test("the connection test sends the confirmation binding, refuses unapproved templates and never exposes provider data", async (t) => {
  const { request, store } = await fixture(t);
  const key = `whatsapp:${MUNICIPALITY_ID}`;
  store.set(key, { active: true, phoneNumberId: "123456", accessToken: "private-token" });
  const sent = [];
  globalThis.fetch = async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true }; };
  try {
    const ok = await request("/whatsapp/test", { user: ADMIN, method: "POST", body: { phone: "48999991234" } });
    assert.equal(ok.body.status, "sent");
    assert.equal(sent[0].body.template.name, "castracao_confirmacao_agendamento");
    assert.deepEqual(sent[0].body.template.components[0].parameters.map(({ text }) => text), ["Teste", "20/11/2026", "09:00", "Unidade Veterinária Municipal"]);
    store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "", templates: [entry({ status: "PAUSED" })] });
    const blocked = await request("/whatsapp/test", { user: ADMIN, method: "POST", body: { phone: "48999991234" } });
    assert.equal(blocked.body.status, "skipped");
    assert.equal(sent.length, 1);
    store.set(`${WHATSAPP_BINDINGS_CONFIG_KEY}:${MUNICIPALITY_ID}`, { bindings: { [NotificationEvent.SCHEDULE_CONFIRMED]: null } });
    assert.match((await request("/whatsapp/test", { user: ADMIN, method: "POST", body: { phone: "48999991234" } })).body.reason, /Vincule/);
    store.set(`${WHATSAPP_BINDINGS_CONFIG_KEY}:${MUNICIPALITY_ID}`, {});
    store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "", templates: [entry()] });
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 132015, message: "private-provider-details" } }) });
    const paused = await request("/whatsapp/test", { user: ADMIN, method: "POST", body: { phone: "48999991234" } });
    assert.equal(paused.body.status, "failed");
    assert.equal(JSON.stringify(paused.body).includes("private-provider-details"), false);
    assert.equal(store.get(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`).templates[0].status, "PAUSED");
  } finally {
    globalThis.fetch = clientFetch;
  }
});
