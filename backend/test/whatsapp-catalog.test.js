import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import whatsappTemplateRoutes from "../src/routes/whatsapp-templates.js";
import { pool } from "../src/db/index.js";
import { DeliveryCode } from "../../shared/notification-contract.js";
import { WHATSAPP_CATALOG_CONFIG_KEY, recognizeWhatsappTemplate } from "../../shared/whatsapp-templates-contract.js";
import { describeGraphTemplate, fetchGraphTemplates } from "../src/services/whatsapp-graph-templates.js";
import { markCatalogTemplateStatus, normalizeWhatsappCatalog, syncWhatsappCatalog } from "../src/services/whatsapp-catalog.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const clientFetch = globalThis.fetch;
const credentials = { accessToken: "private-token", wabaId: "987654321" };
const body = (text) => ({ type: "BODY", text });
const graph = (name, components, extra = {}) => ({ name, language: "pt_BR", status: "approved", category: "utility", components, ...extra });
const facts = (overrides = {}) => ({
  name: "t", language: "pt_BR", status: "APPROVED", category: "UTILITY", parameterFormat: "POSITIONAL", hasBody: true,
  bodyVariables: 0, bodySequential: true, header: "NONE", buttons: [], extraComponents: false, ...overrides,
});

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

test("a template with a numbered body, text header, footer and fixed buttons is described by its structure", () => {
  const described = describeGraphTemplate(graph("castracao_confirmacao_agendamento", [
    { type: "HEADER", format: "TEXT", text: "Castração" }, body("Olá {{1}}, {{2}} às {{3}} em {{4}}. Protocolo {{5}}."), { type: "FOOTER", text: "Prefeitura" },
    { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Ok" }, { type: "URL", text: "Site", url: "https://example.com" }, { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5548000000000" }] },
  ], { parameter_format: "POSITIONAL" }));
  assert.deepEqual(described, facts({
    name: "castracao_confirmacao_agendamento", bodyVariables: 5, header: "TEXT", buttons: ["QUICK_REPLY", "URL", "PHONE_NUMBER"],
  }));
  assert.deepEqual(recognizeWhatsappTemplate(described).uses, ["schedule_confirmed"]);
  assert.equal(describeGraphTemplate(graph("castracao_x", [body("Texto fixo")])).bodyVariables, 0);
});

test("the facts expose everything the convention needs to reject a format the sender cannot fill", () => {
  const describe = (components, extra) => describeGraphTemplate(graph("t", components, extra));
  assert.equal(describe([body("Olá {{nome}}")]).parameterFormat, "NAMED");
  assert.equal(describe([body("Olá {{1}}")], { parameter_format: "NAMED" }).parameterFormat, "NAMED");
  assert.equal(describe([body("Olá {{1}}")], { parameter_format: "POSITIONAL" }).parameterFormat, "POSITIONAL");
  assert.equal(describe([body("Olá {{1}} {{3}}")]).bodySequential, false);
  assert.equal(describe([body("Olá {{2}}")]).bodySequential, false);
  const repeated = describe([body("{{1}} e de novo {{1}} com {{2}}")]);
  assert.deepEqual({ variables: repeated.bodyVariables, sequential: repeated.bodySequential }, { variables: 2, sequential: true });
  assert.equal(describe([body("Olá {{1}}")]).bodySequential, true);
  assert.equal(describe([{ type: "HEADER", format: "IMAGE" }, body("Olá")]).header, "MEDIA");
  assert.equal(describe([{ type: "HEADER", format: "TEXT", text: "Oi {{1}}" }, body("Olá")]).header, "TEXT_VARIABLE");
  assert.deepEqual(describe([body("Olá"), { type: "BUTTONS", buttons: [{ type: "URL", url: "https://example.com/{{1}}" }] }]).buttons, ["URL_VARIABLE"]);
  assert.deepEqual(describe([body("Olá"), { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }, { type: "OTP", otp_type: "ONE_TAP" }, { type: "FLOW" }] }]).buttons, ["OTP_COPY_CODE", "OTP_OTHER", "OTHER"]);
  assert.equal(describe([{ type: "CAROUSEL" }, body("Olá")]).extraComponents, true);
  assert.equal(describe([{ type: "FOOTER", text: "sem corpo" }]).hasBody, false);
  assert.equal(describe([body("x".repeat(1200))]).hasBody, false);
});

test("an authentication template that comes without body text is read as a single code variable", () => {
  const described = describeGraphTemplate(graph("castracao_codigo_verificacao", [{ type: "BODY", add_security_recommendation: true }, { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] }], { category: "authentication" }));
  assert.deepEqual({ category: described.category, hasBody: described.hasBody, variables: described.bodyVariables, sequential: described.bodySequential, buttons: described.buttons },
    { category: "AUTHENTICATION", hasBody: true, variables: 1, sequential: true, buttons: ["OTP_COPY_CODE"] });
  assert.equal(recognizeWhatsappTemplate(described).uses.length, 3);
  const utilityWithoutText = describeGraphTemplate(graph("castracao_x", [{ type: "BODY" }]));
  assert.equal(utilityWithoutText.hasBody, false);
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
  assert.equal(requests[0].url.searchParams.get("fields"), "name,language,status,category,components,parameter_format");
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

test("a synchronization stores a sorted catalog of facts per municipality, audits it and is rate limited", async () => {
  const database = fakeDatabase();
  const fetchImpl = async () => page([
    graph("zeta", [body("Olá {{1}}")]),
    graph("alpha", [body("Oi")], { status: "paused" }),
    { language: "pt_BR" },
  ]);
  const catalog = await syncWhatsappCatalog({ municipalityId: "municipality-sync", runtime: credentials, audit: { userId: "user", action: "ignored" }, fetchImpl, now: 1_000_000, database });
  assert.deepEqual(catalog.templates.map(({ name }) => name), ["alpha", "zeta"]);
  assert.equal(catalog.templates[1].bodyVariables, 1);
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
  const entries = [facts({ name: "a" }), facts({ name: "a", language: "en_US" })];
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

test("stored catalogs are validated on read and entries cached in an older format are dropped", () => {
  const legacy = { name: "old", language: "pt_BR", status: "APPROVED", category: "UTILITY", bodyText: "Olá {{1}}", variableCount: 1, supported: true, unsupportedReason: "" };
  const catalog = normalizeWhatsappCatalog({ syncedAt: 5, templates: [facts({ name: "ok" }), legacy, { name: "broken" }, null, facts({ name: "bad-format", parameterFormat: "OTHER" }), facts({ name: "bad-buttons", buttons: [1] })] });
  assert.equal(catalog.syncedAt, "");
  assert.deepEqual(catalog.templates.map(({ name }) => name), ["ok"]);
  assert.deepEqual(normalizeWhatsappCatalog(null), { syncedAt: "", templates: [] });
});

async function routeFixture(t, municipalityId, user, initial = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, key: process.env.CONFIG_ENCRYPTION_KEY };
  process.env.JWT_SECRET = "whatsapp-catalog-tests-only";
  delete process.env.CONFIG_ENCRYPTION_KEY;
  const database = fakeDatabase(initial);
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
  const call = async (method, path, requestBody) => {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${registerTestSession(users, user)}` },
      ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  return { call, database, queries, municipalityId };
}

test("the sync endpoint is the master's: it uses the credentials of the chosen municipality and returns the template list", async (t) => {
  const municipalityId = "99999999-9999-4999-8999-999999999999";
  const admin = { id: "66666666-6666-4666-8666-666666666666", role: "master" };
  const { call, database, queries } = await routeFixture(t, municipalityId, admin, { [`whatsapp:${municipalityId}`]: { active: true, wabaId: "987654321", accessToken: "legacy-private-token" } });
  const sentTo = [];
  globalThis.fetch = async (url, options) => {
    sentTo.push({ url: String(url), auth: options.headers.Authorization });
    return page([graph("castracao_cancelamento", [body("{{1}} {{2}} {{3}}")]), graph("lembrete_atendimento", [body("Oi")])]);
  };
  const synced = await call("POST", "/whatsapp/templates/sync", { municipalityId });
  assert.equal(synced.status, 200);
  assert.deepEqual(synced.body.templates.map(({ name, canActivate, label }) => ({ name, canActivate, label })), [
    { name: "castracao_cancelamento", canActivate: true, label: "Não comparecimento" },
    { name: "lembrete_atendimento", canActivate: false, label: "" },
  ]);
  assert.equal(sentTo[0].auth, "Bearer legacy-private-token");
  assert.equal(sentTo[0].url.includes("/987654321/message_templates"), true);
  assert.equal(database.store.has(`${WHATSAPP_CATALOG_CONFIG_KEY}:${municipalityId}`), true);
  assert.equal(queries.every((values) => !values.includes("11111111-1111-4111-8111-111111111111")), true);
  assert.deepEqual((await call("GET", `/whatsapp/templates?municipalityId=${municipalityId}`)).body, synced.body);
  assert.equal((await call("POST", "/whatsapp/templates/sync", { municipalityId })).status, 429);
  assert.equal((await call("POST", "/whatsapp/templates/sync")).status, 400, "the master must choose a municipality");
});

test("the sync endpoint answers with a safe message when the provider rejects the request", async (t) => {
  const municipalityId = "88888888-8888-4888-8888-888888888888";
  const admin = { id: "77777777-7777-4777-8777-777777777777", role: "master" };
  const { call, database } = await routeFixture(t, municipalityId, admin, { [`whatsapp:${municipalityId}`]: { active: true, wabaId: "987654321", accessToken: "plain-private-token" } });
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "plain-private-token expired" } }) });
  const result = await call("POST", "/whatsapp/templates/sync", { municipalityId });
  assert.equal(result.status, 502);
  assert.equal(result.body.code, DeliveryCode.INVALID_CREDENTIALS);
  assert.equal(JSON.stringify(result.body).includes("plain-private-token"), false);
  assert.equal(database.store.has(`${WHATSAPP_CATALOG_CONFIG_KEY}:${municipalityId}`), false);
});
