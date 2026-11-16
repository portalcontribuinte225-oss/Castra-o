import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import whatsappTemplateRoutes from "../src/routes/whatsapp-templates.js";
import { pool } from "../src/db/index.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { DeliveryCode, NotificationEvent } from "../../shared/notification-contract.js";
import {
  WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, WHATSAPP_CATALOG_CONFIG_KEY, activateTemplate, deactivateTemplate, getWhatsappUse,
  isWhatsappTemplateUsable, normalizeActiveTemplates, parseWhatsappTemplateName, recognizeWhatsappTemplate, whatsappUses,
} from "../../shared/whatsapp-templates-contract.js";
import { buildTemplateRows, resolveActiveTemplate, setWhatsappTemplateActive } from "../src/services/whatsapp-active-templates.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { permissionConfigs, permissionGroup } from "./fixtures/permission-groups.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const STAFF = { id: "44444444-4444-4444-8444-444444444444", role: "analista", municipalityId: MUNICIPALITY_ID };
const PERMITTED = { id: "88888888-8888-4888-8888-888888888888", role: "analista", municipalityId: MUNICIPALITY_ID };
const clientFetch = globalThis.fetch;

const entry = (name, overrides = {}) => ({
  name, language: "pt_BR", status: "APPROVED", category: "UTILITY", parameterFormat: "POSITIONAL", hasBody: true,
  bodyVariables: 5, bodySequential: true, header: "TEXT", buttons: [], extraComponents: false, ...overrides,
});
const confirmation = (overrides) => entry("castracao_confirmacao_agendamento", overrides);
const cancellation = (overrides) => entry("castracao_cancelamento", { bodyVariables: 3, ...overrides });
const authentication = (overrides) => entry("castracao_codigo_verificacao", { category: "AUTHENTICATION", bodyVariables: 1, header: "NONE", buttons: ["OTP_COPY_CODE"], ...overrides });
const catalogOf = (...templates) => ({ syncedAt: "2026-11-15T10:00:00.000Z", templates });

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

const withCatalog = (municipality, templates, active) => ({
  [`${WHATSAPP_CATALOG_CONFIG_KEY}:${municipality}`]: catalogOf(...templates),
  ...(active ? { [`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:${municipality}`]: { active } } : {}),
});

test("every use has a unique key and the notice keys are the notification events", () => {
  const keys = whatsappUses.map(({ key }) => key);
  assert.equal(new Set(keys).size, keys.length);
  for (const event of Object.values(NotificationEvent)) assert.ok(getWhatsappUse(event), event);
  assert.equal(getWhatsappUse(AuthPurpose.VERIFY_EMAIL), null);
  assert.deepEqual(getWhatsappUse(NotificationEvent.NO_SHOW).fields, ["tutor_name", "schedule_date", "schedule_time"]);
  assert.equal(whatsappUses.some((use) => use.fields?.includes("phone")), false);
});

test("template names follow castracao_<part> with an optional version suffix", () => {
  assert.equal(parseWhatsappTemplateName("castracao_cancelamento"), "cancelamento");
  assert.equal(parseWhatsappTemplateName("castracao_cancelamento_v2"), "cancelamento");
  assert.equal(parseWhatsappTemplateName("castracao_codigo_verificacao_v12"), "codigo_verificacao");
  for (const name of ["cancelamento", "Castracao_cancelamento", "castracao_", "castracao_cancel-amento", "castracao_cancelamento v2", undefined, 7]) {
    assert.equal(parseWhatsappTemplateName(name), null, String(name));
  }
});

test("each agenda and completion notice is recognized with the number of variables it expects", () => {
  const cases = [
    [confirmation(), NotificationEvent.SCHEDULE_CONFIRMED],
    [entry("castracao_reagendamento"), NotificationEvent.SCHEDULE_CHANGED],
    [cancellation(), NotificationEvent.NO_SHOW],
    [entry("castracao_documentos_conferidos", { bodyVariables: 2 }), NotificationEvent.DOCUMENTS_REVIEWED],
    [entry("castracao_atendimento_concluido", { bodyVariables: 2 }), NotificationEvent.COMPLETED],
    [entry("castracao_indeferimento", { bodyVariables: 2 }), NotificationEvent.REQUEST_REJECTED],
    [cancellation({ name: "castracao_cancelamento_v2" }), NotificationEvent.NO_SHOW],
  ];
  for (const [template, event] of cases) assert.deepEqual(recognizeWhatsappTemplate(template), { uses: [event], reason: "" }, template.name);
});

test("a template outside the convention is not recognized and says why", () => {
  assert.match(recognizeWhatsappTemplate(entry("lembrete_atendimento")).reason, /nome não indica/);
  assert.match(recognizeWhatsappTemplate(entry("castracao_outra_coisa")).reason, /nome não indica/);
  assert.match(recognizeWhatsappTemplate(entry("castracao_cancelamento_final")).reason, /nome não indica/);
  assert.match(recognizeWhatsappTemplate(cancellation({ bodyVariables: 4 })).reason, /4 variável\(is\).*esperado é 3/);
  assert.match(recognizeWhatsappTemplate(cancellation({ parameterFormat: "NAMED" })).reason, /com nome/);
  assert.match(recognizeWhatsappTemplate(cancellation({ bodySequential: false })).reason, /sequência/);
  assert.match(recognizeWhatsappTemplate(cancellation({ hasBody: false })).reason, /corpo/);
  assert.match(recognizeWhatsappTemplate(cancellation({ header: "MEDIA" })).reason, /Cabeçalho/);
  assert.match(recognizeWhatsappTemplate(cancellation({ header: "TEXT_VARIABLE" })).reason, /Cabeçalho/);
  assert.match(recognizeWhatsappTemplate(cancellation({ extraComponents: true })).reason, /componentes/);
  for (const button of ["URL_VARIABLE", "OTP_COPY_CODE", "OTP_OTHER", "OTHER"]) assert.match(recognizeWhatsappTemplate(cancellation({ buttons: [button] })).reason, /Botão/);
  assert.deepEqual(recognizeWhatsappTemplate(cancellation({ buttons: ["QUICK_REPLY", "PHONE_NUMBER", "URL"] })).uses, [NotificationEvent.NO_SHOW]);
  assert.deepEqual(recognizeWhatsappTemplate(null), { uses: [], reason: "O nome não indica um aviso do sistema." });
});

test("an authentication template with the copy-code button serves the three code uses", () => {
  const recognized = recognizeWhatsappTemplate(authentication());
  assert.deepEqual(recognized, { uses: [AuthPurpose.PASSWORD_RESET, AuthPurpose.VERIFY_PHONE, AuthPurpose.REQUEST_TRACKING], reason: "" });
  assert.deepEqual(recognizeWhatsappTemplate(authentication({ name: "castracao_codigo_verificacao_v2" })).uses, recognized.uses);
  assert.deepEqual(recognizeWhatsappTemplate(authentication({ name: "castracao_codigo" })).uses, recognized.uses);
  assert.match(recognizeWhatsappTemplate(authentication({ category: "UTILITY" })).reason, /autenticação/);
  assert.match(recognizeWhatsappTemplate(authentication({ buttons: [] })).reason, /copiar código/);
  assert.match(recognizeWhatsappTemplate(authentication({ buttons: ["OTP_OTHER"] })).reason, /copiar código/);
  assert.match(recognizeWhatsappTemplate(authentication({ bodyVariables: 2 })).reason, /esperado é 1/);
});

test("contact-changed and initial-password templates are recognized by their own variable counts", () => {
  assert.deepEqual(recognizeWhatsappTemplate(entry("castracao_contato_alterado", { bodyVariables: 1 })).uses, [AuthPurpose.CONTACT_CHANGED]);
  assert.deepEqual(recognizeWhatsappTemplate(entry("castracao_senha_inicial", { bodyVariables: 2 })).uses, [AuthPurpose.INITIAL_PASSWORD]);
  assert.match(recognizeWhatsappTemplate(entry("castracao_senha_inicial", { bodyVariables: 1 })).reason, /esperado é 2/);
});

test("only approved templates that keep their structure are usable for a use", () => {
  assert.equal(isWhatsappTemplateUsable(confirmation(), NotificationEvent.SCHEDULE_CONFIRMED), true);
  for (const status of ["PENDING", "PAUSED", "DISABLED", "REJECTED", "NOT_FOUND"]) assert.equal(isWhatsappTemplateUsable(confirmation({ status }), NotificationEvent.SCHEDULE_CONFIRMED), false);
  assert.equal(isWhatsappTemplateUsable(confirmation(), NotificationEvent.SCHEDULE_CHANGED), false);
  assert.equal(isWhatsappTemplateUsable(confirmation({ bodyVariables: 3 }), NotificationEvent.SCHEDULE_CONFIRMED), false);
  assert.equal(isWhatsappTemplateUsable(null, NotificationEvent.SCHEDULE_CONFIRMED), false);
});

test("the active list keeps only known uses with a valid identity and turning on replaces the previous template", () => {
  const stored = normalizeActiveTemplates({ active: {
    [NotificationEvent.NO_SHOW]: { name: " castracao_cancelamento ", language: "pt_BR", extra: "x" },
    [NotificationEvent.COMPLETED]: { name: "", language: "pt_BR" },
    [NotificationEvent.SCHEDULE_CHANGED]: { name: "castracao_reagendamento" },
    unknown_use: { name: "a", language: "pt_BR" },
    [AuthPurpose.VERIFY_EMAIL]: { name: "a", language: "pt_BR" },
  } });
  assert.deepEqual(stored, { [NotificationEvent.NO_SHOW]: { name: "castracao_cancelamento", language: "pt_BR" } });
  assert.deepEqual(normalizeActiveTemplates(null), {});
  assert.deepEqual(normalizeActiveTemplates({ active: [] }), {});
  const replaced = activateTemplate(stored, cancellation({ name: "castracao_cancelamento_v2" }));
  assert.deepEqual(replaced, { [NotificationEvent.NO_SHOW]: { name: "castracao_cancelamento_v2", language: "pt_BR" } });
  const code = activateTemplate(replaced, authentication());
  assert.equal(Object.keys(code).length, 4);
  assert.deepEqual(deactivateTemplate(code, "castracao_codigo_verificacao", "pt_BR"), replaced);
  assert.deepEqual(deactivateTemplate(code, "other", "pt_BR"), code);
  assert.deepEqual(activateTemplate(stored, entry("lembrete")), stored);
});

test("the template list shows status, recognized use, order of variables and what can be turned on", () => {
  const catalog = catalogOf(authentication(), cancellation(), cancellation({ name: "castracao_cancelamento_v2", status: "PENDING" }), entry("lembrete_atendimento"), confirmation());
  const active = { [NotificationEvent.SCHEDULE_CONFIRMED]: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } };
  const rows = Object.fromEntries(buildTemplateRows(catalog, active).map((row) => [row.name, row]));
  assert.equal(rows.castracao_confirmacao_agendamento.active, true);
  assert.equal(rows.castracao_confirmacao_agendamento.canActivate, true);
  assert.equal(rows.castracao_confirmacao_agendamento.label, "Agendamento confirmado");
  assert.deepEqual(rows.castracao_confirmacao_agendamento.variables, ["Nome do tutor", "Data do agendamento", "Horário do agendamento", "Local do atendimento", "Protocolo"]);
  assert.equal(rows.castracao_cancelamento.active, false);
  assert.equal(rows.castracao_cancelamento.canActivate, true);
  assert.equal(rows.castracao_cancelamento_v2.canActivate, false);
  assert.equal(rows.castracao_cancelamento_v2.status, "PENDING");
  assert.equal(rows.castracao_codigo_verificacao.label, "Códigos de acesso");
  assert.equal(rows.castracao_codigo_verificacao.uses.length, 3);
  assert.deepEqual(rows.castracao_codigo_verificacao.variables, ["Código de verificação"]);
  assert.equal(rows.lembrete_atendimento.label, "");
  assert.match(rows.lembrete_atendimento.reason, /nome não indica/);
  assert.equal(rows.lembrete_atendimento.canActivate, false);
  assert.equal(Object.values(rows).some((row) => row.variables.some((label) => /telefone|cpf/i.test(label))), false);
});

test("an active template that disappeared from Meta or lost its structure stays visible so it can be turned off", () => {
  const active = {
    [NotificationEvent.NO_SHOW]: { name: "castracao_cancelamento", language: "pt_BR" },
    [NotificationEvent.SCHEDULE_CONFIRMED]: { name: "castracao_confirmacao_agendamento", language: "pt_BR" },
  };
  const rows = buildTemplateRows(catalogOf(confirmation({ bodyVariables: 2 })), active);
  const changed = rows.find((row) => row.name === "castracao_confirmacao_agendamento");
  assert.equal(changed.active, true);
  assert.equal(changed.canActivate, false);
  assert.match(changed.reason, /esperado é 5/);
  const removed = rows.find((row) => row.name === "castracao_cancelamento");
  assert.deepEqual({ status: removed.status, active: removed.active, canActivate: removed.canActivate, label: removed.label }, { status: "NOT_FOUND", active: true, canActivate: false, label: "Não comparecimento" });
});

test("turning a template on requires it in the catalog, recognized and approved, and replaces the previous version", async () => {
  const database = fakeDatabase(withCatalog("municipality-a", [cancellation(), cancellation({ name: "castracao_cancelamento_v2" }), cancellation({ name: "castracao_cancelamento_v3", status: "PAUSED" }), entry("lembrete_atendimento")]));
  const turn = (name, active = true, extra = {}) => setWhatsappTemplateActive({ municipalityId: "municipality-a", name, language: "pt_BR", active, database, ...extra });
  await assert.rejects(turn("castracao_inexistente"), { status: 400, message: /Sincronize/ });
  await assert.rejects(turn("lembrete_atendimento"), { status: 400, message: /nome não indica/ });
  await assert.rejects(turn("castracao_cancelamento_v3"), { status: 400, message: /aprovados/ });
  await assert.rejects(turn("castracao_cancelamento", "yes"), { status: 400 });
  await assert.rejects(turn("", true), { status: 400 });
  assert.equal(database.store.has(`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:municipality-a`), false);
  const first = await turn("castracao_cancelamento", true, { audit: { userId: "user", userEmail: "staff@example.test" } });
  assert.equal(first.templates.find((row) => row.name === "castracao_cancelamento").active, true);
  const auditCall = database.calls.find(({ sql }) => sql.includes("INSERT INTO audit_logs"));
  assert.equal(auditCall.values[3], "WHATSAPP_TEMPLATE_UPDATE");
  const second = await turn("castracao_cancelamento_v2");
  assert.deepEqual(second.templates.filter((row) => row.active).map((row) => row.name), ["castracao_cancelamento_v2"]);
  assert.deepEqual(database.store.get(`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:municipality-a`), { active: { no_show: { name: "castracao_cancelamento_v2", language: "pt_BR" } } });
  const off = await turn("castracao_cancelamento_v2", false);
  assert.equal(off.templates.some((row) => row.active), false);
  assert.deepEqual(database.store.get(`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:municipality-a`), { active: {} });
  await turn("castracao_nunca_ligado", false);
});

test("resolving a use answers not configured, unavailable or ready, per municipality", async () => {
  const active = { [NotificationEvent.SCHEDULE_CONFIRMED]: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } };
  const database = fakeDatabase({ ...withCatalog("municipality-a", [confirmation()], active), ...withCatalog("municipality-b", [confirmation({ status: "PAUSED" })], active), ...withCatalog("municipality-c", [], active) });
  const resolve = (municipality, use = NotificationEvent.SCHEDULE_CONFIRMED) => resolveActiveTemplate(municipality, use, database);
  assert.deepEqual(await resolve("municipality-a"), { ok: true, template: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } });
  assert.deepEqual(await resolve("municipality-a", NotificationEvent.NO_SHOW), { ok: false, code: DeliveryCode.NOT_CONFIGURED });
  assert.deepEqual(await resolve("municipality-a", "unknown_use"), { ok: false, code: DeliveryCode.NOT_CONFIGURED });
  assert.deepEqual(await resolve("municipality-b"), { ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE });
  assert.deepEqual(await resolve("municipality-c"), { ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE });
  assert.deepEqual(await resolve("municipality-without-config"), { ok: false, code: DeliveryCode.NOT_CONFIGURED });
});

async function routeFixture(t, initial = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "whatsapp-templates-route-tests";
  const database = fakeDatabase(initial);
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
  async function request(path, { user, method = "GET", body } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, database };
}

test("template endpoints need a session and the WhatsApp permission, and syncing with Meta is the master's", async (t) => {
  const { request, database } = await routeFixture(t, {
    ...withCatalog(MUNICIPALITY_ID, [confirmation()]),
    ...permissionConfigs(MUNICIPALITY_ID, { users: [{ id: PERMITTED.id, permissionGroupId: "g" }], groups: [permissionGroup("g", ["whatsapp_settings"])] }),
  });
  for (const [method, path] of [["GET", "/whatsapp/templates"], ["POST", "/whatsapp/templates/sync"], ["PUT", "/whatsapp/templates/active"]]) {
    const body = method === "GET" ? undefined : {};
    assert.equal((await request(path, { method, body })).status, 401);
    assert.equal((await request(path, { method, user: STAFF, body })).status, 403, `no group: ${method} ${path}`);
  }
  assert.equal((await request("/whatsapp/templates", { user: PERMITTED })).status, 200);
  assert.equal((await request("/whatsapp/templates/active", { method: "PUT", user: PERMITTED, body: { name: "castracao_confirmacao_agendamento", language: "pt_BR", active: true } })).status, 200);
  for (const user of [PERMITTED, ADMIN, { ...ADMIN, role: "suporte", municipalityId: undefined }]) {
    assert.equal((await request("/whatsapp/templates/sync", { method: "POST", user, body: { municipalityId: MUNICIPALITY_ID } })).status, 403, `sync is the master's: ${user.role}`);
  }
  assert.equal(database.calls.some(({ values }) => values[0] === "whatsapp_catalog" && values[1] === OTHER_MUNICIPALITY_ID), false);
});

test("the list endpoint returns the municipal catalog with its states and ignores a forged municipality", async (t) => {
  const { request, database } = await routeFixture(t, {
    ...withCatalog(MUNICIPALITY_ID, [confirmation(), entry("lembrete_atendimento")]),
    ...withCatalog(OTHER_MUNICIPALITY_ID, [cancellation()]),
  });
  const listed = await request(`/whatsapp/templates?municipalityId=${OTHER_MUNICIPALITY_ID}`, { user: ADMIN });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.templates.map((row) => row.name), ["castracao_confirmacao_agendamento", "lembrete_atendimento"]);
  assert.equal(listed.body.syncedAt, "2026-11-15T10:00:00.000Z");
  assert.equal(database.calls.every(({ values }) => values[1] === MUNICIPALITY_ID), true);
});

test("the active endpoint turns templates on and off, validates the body and audits the change", async (t) => {
  const { request, database } = await routeFixture(t, withCatalog(MUNICIPALITY_ID, [confirmation(), confirmation({ name: "castracao_reagendamento", status: "PENDING" })]));
  const url = "/whatsapp/templates/active";
  assert.equal((await request(url, { user: ADMIN, method: "PUT", body: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } })).status, 400);
  assert.equal((await request(url, { user: ADMIN, method: "PUT", body: { name: "castracao_reagendamento", language: "pt_BR", active: true } })).status, 400);
  assert.equal((await request(url, { user: ADMIN, method: "PUT", body: { name: "castracao_inexistente", language: "pt_BR", active: true } })).status, 400);
  const on = await request(url, { user: ADMIN, method: "PUT", body: { name: "castracao_confirmacao_agendamento", language: "pt_BR", active: true, municipalityId: OTHER_MUNICIPALITY_ID } });
  assert.equal(on.status, 200);
  assert.equal(on.body.templates.find((row) => row.name === "castracao_confirmacao_agendamento").active, true);
  assert.equal(database.store.has(`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:${OTHER_MUNICIPALITY_ID}`), false);
  assert.equal(database.calls.some(({ sql, values }) => sql.includes("INSERT INTO audit_logs") && values[3] === "WHATSAPP_TEMPLATE_UPDATE"), true);
  const off = await request(url, { user: ADMIN, method: "PUT", body: { name: "castracao_confirmacao_agendamento", language: "pt_BR", active: false } });
  assert.equal(off.body.templates.some((row) => row.active), false);
});

test("the catalog and active-template keys stay off the generic configuration route", async () => {
  const { default: configRoutes } = await import("../src/routes/config.js");
  const layers = configRoutes.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.equal(layers.some((path) => String(path).includes("catalog") || String(path).includes("templates")), false);
  const source = (await import("node:fs")).readFileSync(new URL("../src/routes/config.js", import.meta.url), "utf8");
  for (const key of ["whatsapp_catalog", "whatsapp_active_templates", WHATSAPP_CATALOG_CONFIG_KEY, WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY]) assert.equal(source.includes(`"${key}"`), false, key);
});
