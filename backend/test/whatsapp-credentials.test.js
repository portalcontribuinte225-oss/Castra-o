import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import configRoutes from "../src/routes/config.js";
import whatsappRoutes from "../src/routes/whatsapp.js";
import { pool } from "../src/db/index.js";
import { CredentialIssue } from "../../shared/server-credential-contract.js";
import { WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, WHATSAPP_CATALOG_CONFIG_KEY } from "../../shared/whatsapp-templates-contract.js";
import { getRuntimeConfig } from "../src/services/whatsapp.js";
import { isWhatsappReady, listWhatsappTokenVariables, prepareWhatsappCredentials, publicWhatsappConfig, readWhatsappToken, usesWhatsapp } from "../src/services/whatsapp-credentials.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { clearServerCredentials, replaceServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const STAFF = { id: "44444444-4444-4444-8444-444444444444", role: "analista", municipalityId: MUNICIPALITY_ID };
const MASTER = { id: "66666666-6666-4666-8666-666666666666", role: "master" };
const WHATSAPP_PATH = `/config/whatsapp?municipalityId=${MUNICIPALITY_ID}`;
const TUTOR = { id: "55555555-5555-4555-8555-555555555555", role: "tutor", municipalityId: MUNICIPALITY_ID };
const TOKEN = "EAAFAKE0TOKEN1234567";
// The WhatsApp tokens as the server's variables hold them in these tests: one per Meta account.
const ENV = { WHATSAPP_TOKEN_TEST: TOKEN, WHATSAPP_TOKEN_OTHER: "EAAOTHER0TOKEN" };
const VARIABLES = ["WHATSAPP_TOKEN_OTHER", "WHATSAPP_TOKEN_TEST"];
const clientFetch = globalThis.fetch;
const leaks = (value) => [TOKEN, TOKEN.slice(0, 8)].some((part) => JSON.stringify(value).includes(part));

const confirmation = (overrides = {}) => ({
  name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY", parameterFormat: "POSITIONAL", hasBody: true,
  bodyVariables: 5, bodySequential: true, header: "TEXT", buttons: [], extraComponents: false, ...overrides,
});
const activeConfirmation = { active: { schedule_confirmed: { name: "castracao_confirmacao_agendamento", language: "pt_BR" } } };

async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "whatsapp-credentials-tests-only";
  const restoreCredentials = replaceServerCredentials(ENV);
  const store = new Map();
  const audits = [];
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
    if (sql.includes("INSERT INTO audit_logs")) { audits.push(values[6] ? JSON.parse(values[6]) : null); return { rows: [] }; }
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
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
    restoreCredentials();
  });
  async function request(path, { user, method = "GET", body } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, store, audits };
}

test("credentials keep only known fields, take the token variable by name and reject malformed identifiers", () => {
  const legacy = { active: true, confirmationTemplate: "old", templateVariables: ["x"], languageCode: "pt_BR", accessToken: "enc:v1:legacy", tokenPreview: "legacy00" };
  const saved = prepareWhatsappCredentials(legacy, {
    active: true, phoneNumberId: " 123456789 ", wabaId: "987654321", tokenVariable: "WHATSAPP_TOKEN_TEST", accessToken: " typed-token ",
    confirmationTemplate: "ignored", hasAccessToken: true,
  }, ENV);
  assert.deepEqual(saved, { provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", tokenVariable: "WHATSAPP_TOKEN_TEST" }, "the old switch is gone");
  assert.deepEqual(prepareWhatsappCredentials(saved, { phoneNumberId: "123456789" }, ENV), saved);
  for (const input of [{ phoneNumberId: "12 34" }, { wabaId: "abc12345" }, { phoneNumberId: "123" }]) {
    assert.throws(() => prepareWhatsappCredentials({}, input, ENV), { status: 400 });
  }
});

test("only a WhatsApp token variable the server holds can be chosen or read, never another variable of the server", () => {
  const env = { ...ENV, WHATSAPP_TOKEN_BAD: "has space", WHATSAPP_TOKEN: "no-suffix", JWT_SECRET: "jwt-secret", DATABASE_URL: "postgres://user:pass@host/db" };
  for (const tokenVariable of ["JWT_SECRET", "DATABASE_URL", "WHATSAPP_TOKEN", "whatsapp_token_test", "WHATSAPP_TOKEN_MISSING", "WHATSAPP_TOKEN_BAD", 42]) {
    assert.throws(() => prepareWhatsappCredentials({}, { tokenVariable }, env), { status: 400 }, String(tokenVariable));
  }
  assert.deepEqual(listWhatsappTokenVariables(env), VARIABLES);
  assert.deepEqual(readWhatsappToken("WHATSAPP_TOKEN_TEST", env), { token: TOKEN, issue: null });
  assert.deepEqual(readWhatsappToken("JWT_SECRET", env), { token: "", issue: CredentialIssue.INVALID });
  assert.deepEqual(readWhatsappToken("WHATSAPP_TOKEN_BAD", env), { token: "", issue: CredentialIssue.INVALID });
  assert.deepEqual(readWhatsappToken("WHATSAPP_TOKEN_MISSING", env), { token: "", issue: CredentialIssue.MISSING });
  assert.deepEqual(readWhatsappToken("", env), { token: "", issue: CredentialIssue.UNSET });
  assert.equal(getRuntimeConfig({ tokenVariable: "DATABASE_URL", phoneNumberId: "123456" }, env).accessToken, "", "a stored name out of the pattern reads nothing");
  assert.equal(getRuntimeConfig({ tokenVariable: "WHATSAPP_TOKEN_TEST", accessToken: "enc:v1:legacy" }, env).accessToken, TOKEN);
});

test("a chosen key puts WhatsApp in use, none takes it out, and it can send only with the key in the server and the sender's number", () => {
  const stored = prepareWhatsappCredentials({}, { phoneNumberId: "123456789", tokenVariable: "WHATSAPP_TOKEN_TEST" }, ENV);
  assert.equal(usesWhatsapp(stored), true);
  assert.equal(isWhatsappReady(getRuntimeConfig(stored, ENV)), true);
  assert.equal(usesWhatsapp(prepareWhatsappCredentials(stored, { tokenVariable: "" }, ENV)), false);
  assert.equal(isWhatsappReady(getRuntimeConfig({ ...stored, phoneNumberId: "" }, ENV)), false, "no sender number");
  assert.equal(isWhatsappReady(getRuntimeConfig({ ...stored, tokenVariable: "WHATSAPP_TOKEN_GONE" }, ENV)), false, "the key left the server");
  assert.equal(usesWhatsapp({ ...stored, tokenVariable: "WHATSAPP_TOKEN_GONE" }), true, "still in use, so the sending reports it as not configured");
  assert.equal(isWhatsappReady(getRuntimeConfig({ ...stored, provider: "other" }, ENV)), false);
  assert.equal(usesWhatsapp(null), false);
  assert.equal(isWhatsappReady(null), false);
  assert.equal(prepareWhatsappCredentials({ ...stored, tokenVariable: "WHATSAPP_TOKEN_GONE" }, { wabaId: "987654321" }, ENV).tokenVariable, "WHATSAPP_TOKEN_GONE",
    "saving the ids alone keeps the key");
});

test("no part of a token leaves: visitors learn whether WhatsApp can send, staff also whether the key is in the server, the master also the ids and the key names", () => {
  const stored = { active: false, phoneNumberId: "123456", wabaId: "654321", tokenVariable: "WHATSAPP_TOKEN_TEST", accessToken: "enc:v1:legacy", confirmationTemplate: "old" };
  assert.deepEqual(publicWhatsappConfig(stored, {}, ENV), { active: true }, "an old switch no longer matters");
  assert.deepEqual(publicWhatsappConfig({ ...stored, tokenVariable: "WHATSAPP_TOKEN_GONE" }, {}, ENV), { active: false });
  assert.deepEqual(publicWhatsappConfig({ ...stored, phoneNumberId: "" }, {}, ENV), { active: false }, "without the sender's number it cannot send");
  assert.deepEqual(publicWhatsappConfig(stored, { internal: true }, ENV), { active: true, integrated: true });
  const master = publicWhatsappConfig(stored, { internal: true, master: true }, ENV);
  assert.deepEqual(master, { active: true, integrated: true, phoneNumberId: "123456", wabaId: "654321", tokenVariable: "WHATSAPP_TOKEN_TEST", tokenVariables: VARIABLES });
  assert.deepEqual(publicWhatsappConfig(null, {}, ENV), { active: false });
  assert.deepEqual(publicWhatsappConfig(undefined, { internal: true, master: true }, ENV),
    { active: false, integrated: false, phoneNumberId: "", wabaId: "", tokenVariable: "", tokenVariables: VARIABLES });
  const gone = publicWhatsappConfig({ ...stored, tokenVariable: "WHATSAPP_TOKEN_GONE" }, { internal: true, master: true }, ENV);
  assert.deepEqual([gone.integrated, gone.tokenVariable], [false, "WHATSAPP_TOKEN_GONE"]);
  for (const view of [master, gone]) assert.equal(leaks(view), false);
});

test("the WhatsApp configuration route gives visitors whether it can send, staff whether the key is in the server, and only the master the ids and the key names", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { active: false, phoneNumberId: "123456", wabaId: "654321", tokenVariable: "WHATSAPP_TOKEN_TEST", confirmationTemplate: "old" });
  assert.deepEqual((await request(WHATSAPP_PATH)).body, { active: true });
  assert.deepEqual((await request("/config/whatsapp", { user: TUTOR })).body, { active: true });
  const staff = await request("/config/whatsapp", { user: STAFF });
  assert.deepEqual(staff.body, { active: true, integrated: true });
  const master = await request(WHATSAPP_PATH, { user: MASTER });
  assert.deepEqual([master.body.integrated, master.body.tokenVariable, master.body.tokenVariables], [true, "WHATSAPP_TOKEN_TEST", VARIABLES]);
  for (const body of [staff.body, master.body]) assert.equal(leaks(body), false);
  store.delete(`whatsapp:${MUNICIPALITY_ID}`);
  const fresh = await request(WHATSAPP_PATH, { user: MASTER });
  assert.deepEqual([fresh.body.integrated, fresh.body.tokenVariable, fresh.body.tokenVariables], [false, "", VARIABLES],
    "with nothing saved the master still sees the key names to choose from");
  assert.deepEqual((await request(WHATSAPP_PATH)).body, { active: false });
});

test("the master saves the ids and the key of a municipality; nothing secret is stored, returned or audited", async (t) => {
  const { request, store, audits } = await fixture(t);
  const saved = await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: {
    active: true, phoneNumberId: "123456789", wabaId: "987654321", tokenVariable: "WHATSAPP_TOKEN_TEST", accessToken: "typed-token", confirmationTemplate: "old",
  } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.value, { active: true, integrated: true, phoneNumberId: "123456789", wabaId: "987654321", tokenVariable: "WHATSAPP_TOKEN_TEST", tokenVariables: VARIABLES });
  assert.deepEqual(store.get(`whatsapp:${MUNICIPALITY_ID}`), { provider: "cloud_api", phoneNumberId: "123456789", wabaId: "987654321", tokenVariable: "WHATSAPP_TOKEN_TEST" });
  assert.deepEqual(audits.at(-1), { key: "whatsapp", municipalityId: MUNICIPALITY_ID, tokenVariable: { from: "", to: "WHATSAPP_TOKEN_TEST" } });
  assert.equal((await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { phoneNumberId: "12 34 56" } })).status, 400);
  for (const tokenVariable of ["JWT_SECRET", "DATABASE_URL", "WHATSAPP_TOKEN_MISSING"]) {
    assert.equal((await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { tokenVariable } })).status, 400, tokenVariable);
  }
  await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { wabaId: "111111111" } });
  assert.deepEqual(audits.at(-1), { key: "whatsapp", municipalityId: MUNICIPALITY_ID }, "the ids alone change no key");
  const none = await request(WHATSAPP_PATH, { user: MASTER, method: "PUT", body: { tokenVariable: "" } });
  assert.deepEqual([none.body.value.integrated, none.body.value.tokenVariable, none.body.value.active], [false, "", false]);
  assert.deepEqual(audits.at(-1).tokenVariable, { from: "WHATSAPP_TOKEN_TEST", to: "" });
  const everything = JSON.stringify([...store.values(), ...audits]);
  for (const secret of [TOKEN, "typed-token"]) assert.equal(everything.includes(secret), false, secret);
});

test("the municipal manager, the operators and the support cannot write the WhatsApp connection or test it, and nothing is stored", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { phoneNumberId: "123456" });
  for (const user of [ADMIN, STAFF, { id: "77777777-7777-4777-8777-777777777777", role: "suporte" }]) {
    assert.equal((await request(WHATSAPP_PATH, { user, method: "PUT", body: { tokenVariable: "WHATSAPP_TOKEN_TEST" } })).status, 403, user.role);
    assert.equal((await request("/whatsapp/test", { user, method: "POST", body: { phone: "48999991234", municipalityId: MUNICIPALITY_ID } })).status, 403, user.role);
  }
  assert.deepEqual(store.get(`whatsapp:${MUNICIPALITY_ID}`), { phoneNumberId: "123456" });
  assert.equal((await request(WHATSAPP_PATH, { user: null, method: "PUT", body: { tokenVariable: "WHATSAPP_TOKEN_TEST" } })).status, 401);
});

test("the connection test sends the active confirmation template with the chosen key's token, refuses unusable ones and never exposes provider data", async (t) => {
  const { request, store } = await fixture(t);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { phoneNumberId: "123456", tokenVariable: "WHATSAPP_TOKEN_TEST" });
  const phone = { phone: "48999991234", municipalityId: MUNICIPALITY_ID };
  const sent = [];
  globalThis.fetch = async (url, options) => { sent.push({ url, body: JSON.parse(options.body), authorization: options.headers.Authorization }); return { ok: true }; };
  const none = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(none.body.status, "skipped");
  assert.match(none.body.reason, /Ative o template/);
  assert.equal(sent.length, 0);
  store.set(`${WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY}:${MUNICIPALITY_ID}`, activeConfirmation);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [confirmation()] });
  const ok = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(ok.body.status, "sent");
  assert.equal(sent[0].authorization, `Bearer ${TOKEN}`);
  assert.equal(sent[0].body.template.name, "castracao_confirmacao_agendamento");
  assert.deepEqual(sent[0].body.template.components[0].parameters.map(({ text }) => text), ["Teste", "20/11/2026", "09:00", "Unidade Veterinária Municipal", "123/2026"]);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [confirmation({ status: "PAUSED" })] });
  const blocked = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(blocked.body.status, "skipped");
  assert.equal(sent.length, 1);
  store.set(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`, { syncedAt: "2026-11-15T10:00:00.000Z", templates: [confirmation()] });
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { phoneNumberId: "123456", tokenVariable: "WHATSAPP_TOKEN_GONE" });
  const noToken = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.deepEqual([noToken.body.status, noToken.body.reason], ["skipped", "Escolha a key do token e informe o ID do número antes de testar."]);
  assert.equal(sent.length, 1);
  store.set(`whatsapp:${MUNICIPALITY_ID}`, { phoneNumberId: "123456", tokenVariable: "WHATSAPP_TOKEN_TEST" });
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 132015, message: "private-provider-details" } }) });
  const paused = await request("/whatsapp/test", { user: MASTER, method: "POST", body: phone });
  assert.equal(paused.body.status, "failed");
  assert.equal(JSON.stringify(paused.body).includes("private-provider-details"), false);
  assert.equal(store.get(`${WHATSAPP_CATALOG_CONFIG_KEY}:${MUNICIPALITY_ID}`).templates[0].status, "PAUSED");
});
