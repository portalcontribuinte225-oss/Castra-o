import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import smsRoutes from "../src/routes/sms.js";
import configRoutes from "../src/routes/config.js";
import { pool } from "../src/db/index.js";
import { SMS_ACTIVE_USES_CONFIG_KEY } from "../../shared/sms-contract.js";
import { smsUses } from "../../shared/sms-uses-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { NotificationEvent } from "../../shared/notification-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { smsSettingsDatabase, SMS_TEST_MUNICIPALITY as MUNICIPALITY, SMS_TEST_OTHER as OTHER } from "./fixtures/sms-settings-db.js";
import { isPermissionRead, permissionConfigs, permissionGroup } from "./fixtures/permission-groups.js";
import { clearServerCredentials, replaceServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();

const clientFetch = globalThis.fetch;
const ADMIN = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY };
const MASTER = { ...ADMIN, role: "master", municipalityId: null };
const SUPPORT = { ...ADMIN, role: "suporte", municipalityId: null };
const TOKEN = "private-production-test-token";
async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect, jwt: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = "sms-route-test-key";
  // The token lives in the server's variables (SMS_TOKEN).
  const restoreCredentials = replaceServerCredentials({ SMS_TOKEN: TOKEN });
  const db = smsSettingsDatabase(); const sessions = new Map(); const remoteCalls = [];
  pool.query = async (sql, values) => resolveTestSession(sql, values, sessions) || db.query(sql, values);
  pool.connect = db.connect;
  globalThis.fetch = async (url, options) => {
    remoteCalls.push({ url, options }); assert.equal(db.state.borrowed, 0);
    assert.equal(url, "https://smsmais.com/send", "sending is the only provider call");
    const [message] = JSON.parse(options.body).messages;
    return new Response(JSON.stringify([{ id: 4321, schedule: "", nome: "", to: message.destinations[0].to, msg: message.msg, externalId: message.id }]), { status: 200 });
  };
  const app = express(); app.use(express.json()); app.use("/config", configRoutes); app.use("/sms", smsRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect; globalThis.fetch = previous.fetch;
    if (previous.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.jwt;
    restoreCredentials();
  });
  const request = async (path, { method = "GET", body, user = ADMIN } = {}) => {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, { method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(sessions, user)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json().catch(() => null) };
  };
  return { request, db, remoteCalls };
}

const OUTSIDERS = [null, { ...ADMIN, role: "tutor" }, { ...ADMIN, role: "analista" }];

test("the test message is the master's and the settings need the SMS permission, denied before any settings or provider access", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  for (const user of [...OUTSIDERS, ADMIN, SUPPORT]) {
    assert.equal((await request("/sms/test-message", { user, method: "POST", body: { phone: "48999991234" } })).status, user ? 403 : 401);
  }
  for (const user of OUTSIDERS) {
    const expected = user ? 403 : 401;
    assert.equal((await request(`/sms/settings?municipalityId=${MUNICIPALITY}`, { user })).status, expected);
    assert.equal((await request(`/sms/uses/active?municipalityId=${MUNICIPALITY}`, { user, method: "PUT", body: { use: AuthPurpose.PASSWORD_RESET, active: false } })).status, expected);
  }
  assert.equal(db.calls.filter((call) => !isPermissionRead(call)).length, 0); assert.equal(remoteCalls.length, 0);
});

test("the platform's switch and the connection test are gone: their routes answer 404 and nothing reaches the provider", async (t) => {
  const { request, db, remoteCalls } = await fixture(t);
  for (const user of [MASTER, ADMIN, null]) {
    assert.equal((await request("/sms/account", { user, method: "PUT", body: { active: true } })).status, 404);
    assert.equal((await request("/sms/test-connection", { user, method: "POST", body: {} })).status, 404);
  }
  assert.equal(remoteCalls.length, 0);
  assert.equal(db.calls.some(({ sql }) => sql.includes("INSERT")), false);
});

test("anyone can read whether SMS can reach a municipality, and nothing else", async (t) => {
  const { request, db } = await fixture(t);
  const path = (id) => `/sms/availability?municipalityId=${id}`;
  assert.deepEqual((await request(path(MUNICIPALITY), { user: null })).body, { active: false }, "the municipality has no contract");
  db.setContract(MUNICIPALITY);
  for (const user of [null, ...OUTSIDERS]) {
    const response = await request(path(MUNICIPALITY), { user });
    assert.equal(response.status, 200); assert.deepEqual(response.body, { active: true }); assert.equal(response.cache, "no-store");
  }
  assert.deepEqual((await request(path(OTHER), { user: null })).body, { active: false });
  delete process.env.SMS_TOKEN;
  assert.deepEqual((await request(path(MUNICIPALITY), { user: null })).body, { active: false }, "not integrated");
  assert.equal((await request("/sms/availability", { user: null })).status, 400);
  assert.equal((await request(path("not-a-municipality"), { user: null })).status, 400);
});

test("every reader gets only whether SMS is integrated, the municipality's name and its messages, and a forged municipality cannot cross tenant", async (t) => {
  const { request, remoteCalls } = await fixture(t);
  const own = await request(`/sms/settings?municipalityId=${OTHER}`);
  assert.equal(own.status, 200); assert.equal(own.cache, "no-store");
  assert.deepEqual(Object.keys(own.body).sort(), ["integrated", "municipalityName", "uses"]);
  assert.deepEqual([own.body.integrated, own.body.municipalityName], [true, "Test Town"]);
  assert.deepEqual(own.body.uses.map(({ key }) => key), smsUses.map(({ key }) => key));
  const master = await request("/sms/settings", { user: MASTER });
  assert.equal(master.status, 200); assert.deepEqual([master.body.integrated, master.body.municipalityName], [true, ""]);
  const support = await request(`/sms/settings?municipalityId=${OTHER}`, { user: SUPPORT });
  assert.equal(support.status, 200); assert.deepEqual([support.body.integrated, support.body.municipalityName], [true, "Other Town"]);
  assert.equal((await request("/sms/settings", { user: SUPPORT })).status, 400, "support must choose a municipality");
  for (const dto of [own.body, master.body, support.body]) assert.equal(JSON.stringify(dto).includes(TOKEN.slice(0, 8)), false);
  delete process.env.SMS_TOKEN;
  assert.equal((await request("/sms/settings", { user: MASTER })).body.integrated, false);
  assert.equal(remoteCalls.length, 0, "reading never calls the provider");
});

test("an administrator switches a message for their own municipality only and gets the whole screen back", async (t) => {
  const { request, db } = await fixture(t);
  const confirmed = NotificationEvent.SCHEDULE_CONFIRMED;
  delete process.env.SMS_TOKEN;
  const early = await request("/sms/uses/active", { method: "PUT", body: { use: confirmed, active: true } });
  assert.equal(early.status, 400); assert.match(early.body.error, /não está integrado/); assert.equal(db.configs.size, 0);
  process.env.SMS_TOKEN = TOKEN;
  const on = await request(`/sms/uses/active?municipalityId=${OTHER}`, { method: "PUT", body: { use: confirmed, active: true, municipalityId: OTHER } });
  assert.equal(on.status, 200); assert.equal(on.cache, "no-store"); assert.equal(on.body.municipalityName, "Test Town");
  assert.equal(on.body.uses.find(({ key }) => key === confirmed).active, true);
  assert.deepEqual(Object.keys(on.body).sort(), ["integrated", "municipalityName", "uses"], "the screen back has nothing of the token");
  assert.deepEqual(db.configs.get(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [confirmed]: true } });
  assert.equal(db.configs.has(`${SMS_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), false);
  const audit = db.audits.find(({ action }) => action === "SMS_USE_UPDATE");
  assert.deepEqual([audit.municipalityId, audit.changes], [MUNICIPALITY, { use: confirmed, active: true }]);
  assert.equal(JSON.stringify(db.audits).includes(TOKEN), false);
  const off = await request("/sms/uses/active", { method: "PUT", body: { use: confirmed, active: false } });
  assert.equal(off.body.uses.find(({ key }) => key === confirmed).active, false);
  assert.equal(off.body.uses.find(({ key }) => key === AuthPurpose.PASSWORD_RESET).active, true);
});

test("a message switch is validated, and a global user must choose an active municipality", async (t) => {
  const { request, db } = await fixture(t);
  for (const body of [{ use: "unknown", active: true }, { use: "initial_password", active: true }, { use: AuthPurpose.PASSWORD_RESET, active: "true" },
    { use: AuthPurpose.PASSWORD_RESET }, {}]) {
    assert.equal((await request("/sms/uses/active", { method: "PUT", body })).status, 400, JSON.stringify(body));
  }
  assert.equal(db.configs.size, 0);
  const body = { use: NotificationEvent.COMPLETED, active: false };
  assert.equal((await request("/sms/uses/active", { method: "PUT", body, user: MASTER })).status, 400);
  assert.equal((await request(`/sms/uses/active?municipalityId=33333333-3333-4333-8333-333333333333`, { method: "PUT", body, user: MASTER })).status, 400);
  const chosen = await request(`/sms/uses/active?municipalityId=${OTHER}`, { method: "PUT", body, user: MASTER });
  assert.equal(chosen.status, 200); assert.equal(chosen.body.municipalityName, "Other Town");
  assert.deepEqual(db.configs.get(`${SMS_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), { active: { [NotificationEvent.COMPLETED]: false } });
});

test("the master sends a test SMS to a typed phone through the platform's account, naming the selected municipality, and only learns whether it went", async (t) => {
  const { request, remoteCalls } = await fixture(t);
  const body = { phone: "(48) 99999-1234" };
  delete process.env.SMS_TOKEN;
  const off = await request(`/sms/test-message?municipalityId=${OTHER}`, { method: "POST", body, user: MASTER });
  assert.equal(off.status, 200); assert.equal(off.cache, "no-store");
  assert.deepEqual(off.body, { status: "skipped", reason: "O SMS não está integrado." });
  assert.equal(remoteCalls.length, 0);
  process.env.SMS_TOKEN = TOKEN;
  const sent = await request(`/sms/test-message?municipalityId=${OTHER}`, { method: "POST", body, user: MASTER });
  assert.equal(sent.status, 200); assert.equal(sent.cache, "no-store");
  assert.deepEqual(sent.body, { status: "sent", providerMessageId: "4321" });
  assert.equal(remoteCalls.length, 1);
  const [call] = remoteCalls;
  assert.equal(call.url, "https://smsmais.com/send"); assert.equal(call.options.headers.Authorization, `Bearer ${TOKEN}`);
  const [message] = JSON.parse(call.options.body).messages;
  assert.equal(message.destinations[0].to, "5548999991234");
  assert.match(message.msg, /^Other Town: teste de envio de SMS/);
  assert.equal(JSON.stringify(sent.body).includes(TOKEN), false); assert.equal(JSON.stringify(sent.body).includes(message.msg), false);
  const neutral = await request("/sms/test-message", { method: "POST", body, user: MASTER });
  assert.equal(neutral.status, 200); assert.match(JSON.parse(remoteCalls.at(-1).options.body).messages[0].msg, /^Prefeitura: teste de envio de SMS/);
});

test("a test SMS needs a phone that can receive it and a valid municipality when one is chosen", async (t) => {
  const { request, remoteCalls } = await fixture(t);
  for (const phone of ["", "123", "abc", "(48) 3333-4444", 48999991234, undefined]) {
    const refused = await request("/sms/test-message", { method: "POST", body: { phone }, user: MASTER });
    assert.equal(refused.status, 400, String(phone)); assert.match(refused.body.error, /^Informe um celular válido com DDD/);
  }
  assert.equal((await request("/sms/test-message", { method: "POST", user: MASTER })).status, 400);
  assert.equal((await request("/sms/test-message?municipalityId=33333333-3333-4333-8333-333333333333", { method: "POST", body: { phone: "48999991234" }, user: MASTER })).status, 400);
  assert.equal(remoteCalls.length, 0);
});

test("when the provider answers with something that is not this message, the test says which field, never the text, the number or the token", async (t) => {
  const { request } = await fixture(t);
  globalThis.fetch = async (_url, options) => {
    const [message] = JSON.parse(options.body).messages;
    return new Response(JSON.stringify([{ id: 4321, schedule: "", nome: "", to: message.destinations[0].to, msg: message.msg, externalId: "cut" }]), { status: 200 });
  };
  const refused = await request(`/sms/test-message?municipalityId=${MUNICIPALITY}`, { method: "POST", body: { phone: "(48) 99999-1234" }, user: MASTER });
  assert.equal(refused.status, 200);
  assert.deepEqual(refused.body, { status: "failed", reason: "Não foi possível confirmar o aceite da mensagem.", detail: "externalId: enviado com 36 caracteres, devolvido com 3 caracteres" });
  assert.doesNotMatch(JSON.stringify(refused.body), /99999|private-production|Test Town/);
});

const ANALYST = { ...ADMIN, id: "44444444-4444-4444-8444-444444444444", role: "analista" };
const smsGroup = (items = ["sms_settings"], member = ANALYST, extra = {}) => permissionConfigs(MUNICIPALITY, {
  users: [{ id: member.id, permissionGroupId: "g" }], groups: [permissionGroup("g", items, extra)],
});
const give = (db, configs) => {
  for (const key of [`castragestao:teams:${MUNICIPALITY}`, `permission_groups:${MUNICIPALITY}`]) db.configs.delete(key);
  for (const [key, value] of Object.entries(configs)) db.configs.set(key, value);
};

test("a staff user with the SMS permission reads the settings and switches the messages, never the test, and the group decides over the role", async (t) => {
  const { request, db } = await fixture(t);
  const confirmed = NotificationEvent.SCHEDULE_CONFIRMED;
  assert.equal((await request("/sms/settings", { user: ANALYST })).status, 403, "no group, no permission");
  give(db, smsGroup());
  const read = await request("/sms/settings", { user: ANALYST });
  assert.equal(read.status, 200);
  assert.deepEqual([read.body.integrated, read.body.municipalityName], [true, "Test Town"]);
  const on = await request("/sms/uses/active", { method: "PUT", user: ANALYST, body: { use: confirmed, active: true } });
  assert.equal(on.status, 200);
  assert.equal(db.configs.get(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`).active[confirmed], true);
  assert.equal((await request("/sms/test-message", { method: "POST", body: { phone: "48999991234" }, user: ANALYST })).status, 403);
  give(db, smsGroup(["email_settings"]));
  assert.equal((await request("/sms/settings", { user: ANALYST })).status, 403, "a group without the SMS item");
  assert.equal((await request("/sms/uses/active", { method: "PUT", user: ANALYST, body: { use: confirmed, active: false } })).status, 403);
  give(db, smsGroup(["email_settings"], ADMIN));
  assert.equal((await request("/sms/settings", { user: ADMIN })).status, 403, "the manager is judged by their group too");
  give(db, smsGroup(["sms_settings"], ANALYST, { active: false }));
  assert.equal((await request("/sms/settings", { user: ANALYST })).status, 403, "an inactive group is no group");
  assert.equal((await request("/sms/settings", { user: ADMIN })).status, 200, "the manager with no group passes by the role");
});

test("a contract switched off closes the channel to tutors, while the message switches stay free", async (t) => {
  const { request, db } = await fixture(t);
  const confirmed = NotificationEvent.SCHEDULE_CONFIRMED;
  db.setContract(MUNICIPALITY, { plan: 10 });
  const availability = async () => (await request(`/sms/availability?municipalityId=${MUNICIPALITY}`, { user: null })).body.active;
  assert.equal(await availability(), true);
  assert.equal((await request("/sms/uses/active", { method: "PUT", body: { use: confirmed, active: true } })).status, 200);
  db.setContract(MUNICIPALITY, { plan: 10, enabled: false });
  assert.equal(await availability(), false);
  assert.equal((await request("/sms/uses/active", { method: "PUT", body: { use: AuthPurpose.PASSWORD_RESET, active: true } })).status, 200);
  assert.equal((await request("/sms/uses/active", { method: "PUT", body: { use: confirmed, active: false } })).status, 200);
});
