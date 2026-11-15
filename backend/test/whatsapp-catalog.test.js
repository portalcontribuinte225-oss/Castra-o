import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import whatsappTemplateRoutes from "../src/routes/whatsapp-templates.js";
import { pool } from "../src/db/index.js";
import { DeliveryCode } from "../../shared/notification-contract.js";
import { WHATSAPP_CATALOG_CONFIG_KEY } from "../../shared/whatsapp-binding-contract.js";
import { describeGraphTemplate, fetchGraphTemplates } from "../src/services/whatsapp-graph-templates.js";
import { findCatalogTemplateByName, markCatalogTemplateStatus, normalizeWhatsappCatalog, syncWhatsappCatalog } from "../src/services/whatsapp-catalog.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const clientFetch = globalThis.fetch;
const credentials = { accessToken: "private-token", wabaId: "987654321" };
const body = (text) => ({ type: "BODY", text });

function fakeDatabase(initial = {}) {
  const store = new Map(Object.entries(initial));
  const calls = [];
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("SELECT value FROM config")) {
      const value = store.get(`${values[0]}:${values[1]}`);
      return { rows: value === undefined ? [] : [{ value }] };
    }
    if (sql.includes("INSERT INTO config")) { store.set(`${values[0]}:${values[1]}`, JSON.parse(values[2])); return { rows: [] }; }
    if (sql.includes("INSERT INTO audit_logs")) return { rows: [] };
    throw new Error("Unexpected test database operation");
  };
  return { store, calls, query, connect: async () => ({ query, release() {} }) };
}

const page = (data, after = "") => ({ ok: true, status: 200, json: async () => ({ data, ...(after ? { paging: { cursors: { after }, next: "https://evil.example/next?access_token=leak" } } : {}) }) });

test("a template with a numbered body, optional footer and fixed buttons is supported with its variable count", () => {
  const described = describeGraphTemplate({
    name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "approved", category: "utility",
    components: [{ type: "HEADER", format: "TEXT", text: "Castração" }, body("Olá {{1}}, {{2}} às {{3}} em {{4}}."), { type: "FOOTER", text: "Prefeitura" },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Ok" }, { type: "URL", text: "Site", url: "https://example.com" }, { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5548000000000" }] }],
  });
  assert.deepEqual(described, {
    name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY",
    bodyText: "Olá {{1}}, {{2}} às {{3}} em {{4}}.", variableCount: 4, supported: true, unsupportedReason: "",
  });
  assert.equal(describeGraphTemplate({ name: "no_variables", language: "pt_BR", status: "APPROVED", components: [body("Texto fixo")] }).variableCount, 0);
});

test("formats the bindings cannot fill are flagged instead of failing at send time", () => {
  const unsupported = (components) => describeGraphTemplate({ name: "t", language: "pt_BR", status: "APPROVED", category: "UTILITY", components });
  const cases = [
    [[body("Olá {{nome}}")], /nomeados/],
    [[body("Olá {{1}} {{3}}")], /fora de sequência/],
    [[{ type: "HEADER", format: "IMAGE" }, body("Olá")], /Cabeçalho/],
    [[{ type: "HEADER", format: "TEXT", text: "Oi {{1}}" }, body("Olá")], /Cabeçalho/],
    [[body("Olá"), { type: "BUTTONS", buttons: [{ type: "URL", url: "https://example.com/{{1}}" }] }], /Botão/],
    [[body("Seu código é {{1}}"), { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] }], /Botão/],
    [[{ type: "CAROUSEL" }, body("Olá")], /componente/],
    [[{ type: "FOOTER", text: "sem corpo" }], /corpo/],
  ];
  for (const [components, reason] of cases) {
    const described = unsupported(components);
    assert.equal(described.supported, false);
    assert.equal(described.variableCount, 0);
    assert.match(described.unsupportedReason, reason);
  }
  for (const invalid of [null, "text", {}, { name: "only-name" }, { name: "x".repeat(513), language: "pt_BR" }]) assert.equal(describeGraphTemplate(invalid), null);
});

test("the catalog is read page by page through the cursor and never follows the provider's next URL", async () => {
  const requests = [];
  const pages = [page([{ name: "a", language: "pt_BR" }], "cursor-1"), page([{ name: "b", language: "pt_BR" }])];
  const raw = await fetchGraphTemplates(credentials, { fetchImpl: async (url, options) => {
    requests.push({ url: new URL(url), options });
    return pages.shift();
  } });
  assert.deepEqual(raw.map(({ name }) => name), ["a", "b"]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.origin, "https://graph.facebook.com");
  assert.equal(requests[0].url.pathname.endsWith("/987654321/message_templates"), true);
  assert.equal(requests[0].url.searchParams.get("fields"), "name,language,status,category,components");
  assert.equal(requests[0].url.searchParams.has("after"), false);
  assert.equal(requests[1].url.searchParams.get("after"), "cursor-1");
  assert.equal(requests[0].options.headers.Authorization, "Bearer private-token");
  assert.equal(requests.some(({ url }) => url.href.includes("access_token") || url.host.includes("evil")), false);
  assert.ok(requests[0].options.signal instanceof AbortSignal);
});

test("catalog errors become safe codes without provider bodies or credentials", async () => {
  const run = (fetchImpl) => fetchGraphTemplates(credentials, { fetchImpl }).then(() => null, (error) => error);
  const cases = [
    [async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "private-token expired" } }) }), DeliveryCode.INVALID_CREDENTIALS],
    [async () => ({ ok: false, status: 429 }), DeliveryCode.RATE_LIMITED],
    [async () => ({ ok: false, status: 400 }), DeliveryCode.PROVIDER_REJECTED],
    [async () => ({ ok: true, json: async () => ({ unexpected: true }) }), DeliveryCode.INVALID_RESPONSE],
    [async () => ({ ok: true, json: async () => { throw new Error("bad json private-token"); } }), DeliveryCode.INVALID_RESPONSE],
    [async () => { throw Object.assign(new Error("private-token"), { name: "TimeoutError" }); }, DeliveryCode.TIMEOUT],
    [async () => { throw new Error("private-token network"); }, DeliveryCode.TRANSPORT_FAILED],
  ];
  for (const [fetchImpl, code] of cases) {
    const error = await run(fetchImpl);
    assert.equal(error.code, code);
    assert.equal(error.status, 502);
    assert.equal(error.message.includes("private-token"), false);
  }
});

test("a synchronization stores a sorted catalog per municipality, audits it and is rate limited", async () => {
  const database = fakeDatabase();
  const fetchImpl = async () => page([
    { name: "zeta", language: "pt_BR", status: "APPROVED", category: "UTILITY", components: [body("Olá {{1}}")] },
    { name: "alpha", language: "pt_BR", status: "PAUSED", category: "UTILITY", components: [body("Oi")] },
    { language: "pt_BR" },
  ]);
  const audit = { userId: "user", action: "ignored" };
  const catalog = await syncWhatsappCatalog({ municipalityId: "municipality-sync", runtime: credentials, audit, fetchImpl, now: 1_000_000, database });
  assert.deepEqual(catalog.templates.map(({ name }) => name), ["alpha", "zeta"]);
  assert.equal(catalog.syncedAt, new Date(1_000_000).toISOString());
  assert.deepEqual(database.store.get(`${WHATSAPP_CATALOG_CONFIG_KEY}:municipality-sync`), catalog);
  const auditCall = database.calls.find(({ sql }) => sql.includes("INSERT INTO audit_logs"));
  assert.equal(auditCall.values[3], "WHATSAPP_CATALOG_SYNC");
  assert.equal(JSON.stringify(auditCall.values).includes("private-token"), false);
  await assert.rejects(syncWhatsappCatalog({ municipalityId: "municipality-sync", runtime: credentials, fetchImpl, now: 1_010_000, database }), { status: 429 });
  assert.equal((await syncWhatsappCatalog({ municipalityId: "municipality-sync", runtime: credentials, fetchImpl, now: 1_031_000, database })).templates.length, 2);
  await assert.rejects(syncWhatsappCatalog({ municipalityId: "municipality-empty", runtime: { accessToken: "", wabaId: "" }, fetchImpl, database }), { status: 400 });
  await assert.rejects(syncWhatsappCatalog({ municipalityId: "municipality-no-waba", runtime: { accessToken: "t", wabaId: "" }, fetchImpl, database }), { status: 400 });
});

test("a failed synchronization keeps the previous catalog", async () => {
  const previous = { syncedAt: "2026-11-14T00:00:00.000Z", templates: [] };
  const database = fakeDatabase({ [`${WHATSAPP_CATALOG_CONFIG_KEY}:municipality-keep`]: previous });
  await assert.rejects(syncWhatsappCatalog({ municipalityId: "municipality-keep", runtime: credentials, fetchImpl: async () => ({ ok: false, status: 401 }), database }), { code: DeliveryCode.INVALID_CREDENTIALS });
  assert.deepEqual(database.store.get(`${WHATSAPP_CATALOG_CONFIG_KEY}:municipality-keep`), previous);
});

test("marking a template changes only that entry and writes nothing when there is nothing to change", async () => {
  const entries = [
    { name: "a", language: "pt_BR", status: "APPROVED", category: "", bodyText: "", variableCount: 0, supported: true, unsupportedReason: "" },
    { name: "a", language: "en_US", status: "APPROVED", category: "", bodyText: "", variableCount: 0, supported: true, unsupportedReason: "" },
  ];
  const database = fakeDatabase({ [`${WHATSAPP_CATALOG_CONFIG_KEY}:municipality-mark`]: { syncedAt: "x", templates: entries } });
  await markCatalogTemplateStatus("municipality-mark", "a", "pt_BR", "PAUSED", database);
  const stored = database.store.get(`${WHATSAPP_CATALOG_CONFIG_KEY}:municipality-mark`);
  assert.deepEqual(stored.templates.map(({ status }) => status), ["PAUSED", "APPROVED"]);
  const writes = () => database.calls.filter(({ sql }) => sql.includes("INSERT INTO config")).length;
  assert.equal(writes(), 1);
  await markCatalogTemplateStatus("municipality-mark", "a", "pt_BR", "PAUSED", database);
  await markCatalogTemplateStatus("municipality-mark", "missing", "pt_BR", "PAUSED", database);
  assert.equal(writes(), 1);
  const unsynced = fakeDatabase();
  await markCatalogTemplateStatus("municipality-none", "a", "pt_BR", "PAUSED", unsynced);
  assert.equal(unsynced.store.size, 0);
});

test("stored catalogs are validated on read and access templates are found by name preferring Brazilian Portuguese", () => {
  const catalog = normalizeWhatsappCatalog({ syncedAt: 5, templates: [{ name: "ok", language: "en_US", status: "APPROVED", category: "", bodyText: "", variableCount: 0, supported: true, unsupportedReason: "" }, { name: "broken" }, null,
    { name: "ok", language: "pt_BR", status: "PAUSED", category: "", bodyText: "", variableCount: 0, supported: true, unsupportedReason: "" }] });
  assert.equal(catalog.syncedAt, "");
  assert.equal(catalog.templates.length, 2);
  assert.equal(findCatalogTemplateByName(catalog, "ok").language, "pt_BR");
  assert.equal(findCatalogTemplateByName(catalog, "missing"), null);
  assert.deepEqual(normalizeWhatsappCatalog(null), { syncedAt: "", templates: [] });
});

test("the sync endpoint uses the municipal credentials, hides provider failures and ignores forged municipalities", async (t) => {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, key: process.env.CONFIG_ENCRYPTION_KEY };
  process.env.JWT_SECRET = "whatsapp-catalog-tests-only";
  delete process.env.CONFIG_ENCRYPTION_KEY;
  const database = fakeDatabase({ "whatsapp:99999999-9999-4999-8999-999999999999": { active: true, wabaId: "987654321", accessToken: "legacy-private-token" } });
  const users = new Map();
  const queries = [];
  pool.query = async (sql, values = []) => { const session = resolveTestSession(sql, values, users); if (session) return session; queries.push(values); return database.query(sql, values); };
  pool.connect = database.connect;
  const app = express();
  app.use(express.json());
  app.use("/whatsapp", whatsappTemplateRoutes);
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
  const admin = { id: "66666666-6666-4666-8666-666666666666", role: "admin_municipal", municipalityId: "99999999-9999-4999-8999-999999999999" };
  const call = async (method, path, requestBody) => {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${registerTestSession(users, admin)}` },
      ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const sentTo = [];
  globalThis.fetch = async (url, options) => {
    sentTo.push({ url: String(url), auth: options.headers.Authorization });
    return page([{ name: "castracao_cancelamento", language: "pt_BR", status: "APPROVED", category: "UTILITY", components: [body("{{1}} {{2}} {{3}}")] }]);
  };
  const synced = await call("POST", "/whatsapp/catalog/sync", { municipalityId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(synced.status, 200);
  assert.equal(synced.body.templates[0].variableCount, 3);
  assert.equal(sentTo[0].auth, "Bearer legacy-private-token");
  assert.equal(sentTo[0].url.includes("/987654321/message_templates"), true);
  assert.equal(database.store.has(`${WHATSAPP_CATALOG_CONFIG_KEY}:99999999-9999-4999-8999-999999999999`), true);
  assert.equal(queries.every((values) => !values.includes("11111111-1111-4111-8111-111111111111")), true);
  assert.deepEqual((await call("GET", "/whatsapp/catalog")).body, synced.body);
  const limited = await call("POST", "/whatsapp/catalog/sync");
  assert.equal(limited.status, 429);
});

test("the sync endpoint answers with a safe message when the provider rejects the request", async (t) => {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "whatsapp-catalog-tests-only";
  const municipalityId = "88888888-8888-4888-8888-888888888888";
  const database = fakeDatabase({ [`whatsapp:${municipalityId}`]: { active: true, wabaId: "987654321", accessToken: "plain-private-token" } });
  const users = new Map();
  pool.query = async (sql, values = []) => resolveTestSession(sql, values, users) || database.query(sql, values);
  pool.connect = database.connect;
  const app = express();
  app.use(express.json());
  app.use("/whatsapp", whatsappTemplateRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
    globalThis.fetch = clientFetch;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  const admin = { id: "77777777-7777-4777-8777-777777777777", role: "admin_municipal", municipalityId };
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "plain-private-token expired" } }) });
  const response = await clientFetch(`http://127.0.0.1:${server.address().port}/whatsapp/catalog/sync`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${registerTestSession(users, admin)}` },
  });
  const result = await response.json();
  assert.equal(response.status, 502);
  assert.equal(result.code, DeliveryCode.INVALID_CREDENTIALS);
  assert.equal(JSON.stringify(result).includes("plain-private-token"), false);
  assert.equal(database.store.has(`${WHATSAPP_CATALOG_CONFIG_KEY}:${municipalityId}`), false);
});
