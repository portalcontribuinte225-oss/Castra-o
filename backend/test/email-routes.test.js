import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import emailRoutes from "../src/routes/email.js";
import { pool } from "../src/db/index.js";
import { EMAIL_ACTIVE_USES_CONFIG_KEY, EMAIL_SETTINGS_PERMISSION, EMAIL_TEMPLATES_CONFIG_KEY } from "../../shared/email-contract.js";
import { ServerCredential } from "../../shared/server-credential-contract.js";
import { emailUses } from "../../shared/email-uses-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { NotificationEvent } from "../../shared/notification-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { fakeEmailDatabase } from "./fixtures/email-config-db.js";
import { replaceServerCredentials, TEST_EMAIL_CREDENTIALS } from "./fixtures/server-credentials.js";
import { isPermissionRead, permissionConfigs, permissionGroup } from "./fixtures/permission-groups.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";
const ADMIN = { id: "aaaaaaaa-0000-4000-8000-000000000001", role: "admin_municipal", municipalityId: MUNICIPALITY };
const OTHER_ADMIN = { id: "aaaaaaaa-0000-4000-8000-000000000002", role: "admin_municipal", municipalityId: OTHER };
const SUPPORT = { id: "aaaaaaaa-0000-4000-8000-000000000003", role: "suporte" };
const MASTER = { id: "aaaaaaaa-0000-4000-8000-000000000004", role: "master" };
const ANALYST = { id: "aaaaaaaa-0000-4000-8000-000000000005", role: "analista", municipalityId: MUNICIPALITY };
const TUTOR = { id: "aaaaaaaa-0000-4000-8000-000000000006", role: "tutor", municipalityId: MUNICIPALITY };
const PRIVATE_KEY = "private-key-for-route-tests";
// The platform account as the server's variables hold it in these tests.
const CREDENTIALS = { ...TEST_EMAIL_CREDENTIALS, [ServerCredential.EMAILJS_PRIVATE_KEY]: PRIVATE_KEY, [ServerCredential.APP_PUBLIC_URL]: "https://system.example.test" };
const CONFIRMED = NotificationEvent.SCHEDULE_CONFIRMED;
const RESET = AuthPurpose.PASSWORD_RESET;
const clientFetch = globalThis.fetch;
const municipalities = { [MUNICIPALITY]: { name: "Test Town", brasao: "" }, [OTHER]: { name: "Other Town", brasao: "" } };

async function fixture(t, configs = {}, credentials = CREDENTIALS) {
  t.after(replaceServerCredentials(credentials));
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "email-routes-tests-only";
  const database = fakeEmailDatabase({ configs, municipalities });
  const users = new Map();
  pool.query = async (sql, values = []) => resolveTestSession(sql, values, users) || database.query(sql, values);
  pool.connect = database.connect;
  const app = express();
  app.use(express.json());
  app.use("/email", emailRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  const seen = [];
  async function request(path, { user, method = "GET", body } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const parsed = await response.json();
    seen.push(JSON.stringify(parsed));
    return { status: response.status, body: parsed, cacheControl: response.headers.get("cache-control") };
  }
  return { request, database, seen };
}

const ready = () => ({
  [`${EMAIL_TEMPLATES_CONFIG_KEY}:null`]: { templates: { [RESET]: "tpl_reset", [CONFIRMED]: "tpl_confirmed" } },
});

test("every route needs a session and rejects tutors and operational users", async (t) => {
  const { request, database } = await fixture(t);
  const routes = [["GET", "/email/settings"], ["PUT", "/email/templates"], ["PUT", "/email/templates/active"]];
  for (const [method, path] of routes) {
    const body = method === "GET" ? undefined : {};
    assert.equal((await request(path, { method, body })).status, 401, `${method} ${path}`);
    for (const user of [TUTOR, ANALYST]) assert.equal((await request(path, { method, user, body })).status, 403, `${user.role} ${method} ${path}`);
  }
  assert.equal(database.calls.filter((call) => !isPermissionRead(call)).length, 0, "only the permission is read before the refusal");
});

test("a municipal administrator reads only the municipal view: no ids, no variables, and a forged municipality is ignored", async (t) => {
  const { request, database } = await fixture(t, ready());
  const response = await request(`/email/settings?municipalityId=${OTHER}`, { user: ADMIN });
  assert.equal(response.status, 200);
  assert.equal(response.cacheControl, "no-store");
  assert.deepEqual(Object.keys(response.body).sort(), ["identity", "integrated", "municipal", "uses"]);
  assert.equal(response.body.municipal, true);
  assert.equal(response.body.integrated, true);
  assert.deepEqual(response.body.identity, { name: "Test Town", departmentName: "", brasao: "missing", departmentLogo: "missing" });
  assert.deepEqual(response.body.uses.map(({ key }) => key), emailUses.map(({ key }) => key));
  for (const row of response.body.uses) assert.equal(Object.hasOwn(row, "templateId") || Object.hasOwn(row, "variables"), false);
  assert.equal(JSON.stringify(response.body).includes("tpl_"), false);
  assert.equal(database.calls.filter(({ sql }) => sql.includes("SELECT value FROM config")).every(({ values }) => values[1] === MUNICIPALITY || values[1] === null), true);
});

test("the master reads the ids; the support reads only the municipal view and needs a municipality", async (t) => {
  const { request } = await fixture(t, ready());
  const master = await request("/email/settings", { user: MASTER });
  assert.equal(master.status, 200);
  assert.equal(master.body.municipal, false);
  assert.equal(master.body.identity, null);
  assert.equal(master.body.integrated, true);
  assert.equal(master.body.uses.find(({ key }) => key === RESET).templateId, "tpl_reset");
  assert.equal(master.body.uses.some(({ active }) => active), false);
  const withMunicipality = await request(`/email/settings?municipalityId=${MUNICIPALITY}`, { user: MASTER });
  assert.equal(withMunicipality.body.municipal, true);
  assert.equal(withMunicipality.body.uses.find(({ key }) => key === RESET).active, true);
  assert.equal((await request("/email/settings", { user: SUPPORT })).status, 400);
  const support = await request(`/email/settings?municipalityId=${MUNICIPALITY}`, { user: SUPPORT });
  assert.equal(support.status, 200);
  assert.equal(Object.hasOwn(support.body, "account"), false);
  assert.equal(JSON.stringify(support.body).includes("tpl_"), false);
  assert.equal((await request("/email/settings?municipalityId=not-a-uuid", { user: MASTER })).status, 400);
});

test("nobody reads anything of the account: the master learns only that it is integrated, and there is no route to save one", async (t) => {
  const { request, database } = await fixture(t);
  const master = await request("/email/settings", { user: MASTER });
  assert.equal(master.body.integrated, true);
  for (const value of ["test-service", "test-public", PRIVATE_KEY.slice(0, 8), "system.example.test"]) assert.equal(JSON.stringify(master.body).includes(value), false, value);
  assert.equal(emailRoutes.stack.some((layer) => layer.route?.path === "/account"), false, "there is no route to save the account");
  assert.equal(database.store.size, 0);
  assert.equal(database.audits.length, 0);
});

test("a missing or malformed variable leaves the account not integrated, names no variable and counts no message as configured", async (t) => {
  const { request } = await fixture(t, ready(), { [ServerCredential.EMAILJS_SERVICE_ID]: "service id", [ServerCredential.EMAILJS_PUBLIC_KEY]: "test-public" });
  const master = await request("/email/settings", { user: MASTER });
  assert.equal(master.body.integrated, false);
  assert.equal(master.body.uses.some(({ configured }) => configured), false);
  assert.equal(JSON.stringify(master.body).includes("service id"), false);
  assert.equal(JSON.stringify(master.body).includes("EMAILJS_"), false);
});

test("the private key never appears in any response or audit entry", async (t) => {
  const { request, database, seen } = await fixture(t, ready());
  await request("/email/settings", { user: MASTER });
  await request(`/email/settings?municipalityId=${MUNICIPALITY}`, { user: ADMIN });
  await request(`/email/settings?municipalityId=${MUNICIPALITY}`, { user: SUPPORT });
  assert.equal(seen.some((body) => body.includes(PRIVATE_KEY)), false);
  assert.equal(JSON.stringify(database.audits).includes(PRIVATE_KEY), false);
  assert.equal(database.calls.some(({ values }) => values.some((value) => typeof value === "string" && value.includes(PRIVATE_KEY))), false);
});

test("only the master sets the template ids, which are global and visible only to the master", async (t) => {
  const { request, database } = await fixture(t);
  const url = "/email/templates";
  for (const user of [ADMIN, SUPPORT]) assert.equal((await request(url, { user, method: "PUT", body: { templates: { [RESET]: "tpl_reset" } } })).status, 403, user.role);
  assert.equal(database.store.has(`${EMAIL_TEMPLATES_CONFIG_KEY}:null`), false);
  const saved = await request(url, { user: MASTER, method: "PUT", body: { templates: { [RESET]: "tpl_reset", [CONFIRMED]: "tpl_confirmed" }, municipalityId: OTHER } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.uses.find(({ key }) => key === CONFIRMED).templateId, "tpl_confirmed");
  assert.equal(database.store.has(`${EMAIL_TEMPLATES_CONFIG_KEY}:${OTHER}`), false);
  for (const body of [{}, { templates: null }, { templates: { unknown: "tpl" } }, { templates: { [RESET]: "bad id" } }]) {
    assert.equal((await request(url, { user: MASTER, method: "PUT", body })).status, 400, JSON.stringify(body));
  }
  const municipal = await request("/email/settings", { user: ADMIN });
  assert.equal(JSON.stringify(municipal.body).includes("tpl_"), false);
  assert.equal(municipal.body.uses.find(({ key }) => key === CONFIRMED).configured, true);
  assert.equal(database.audits.at(-1).municipalityId, null);
});

test("a municipality turns a use on only when it is configured, and the switch belongs to that municipality alone", async (t) => {
  const { request, database } = await fixture(t);
  const url = "/email/templates/active";
  assert.equal((await request(url, { user: ADMIN, method: "PUT", body: { use: CONFIRMED, active: true } })).status, 400);
  database.store.set(`${EMAIL_TEMPLATES_CONFIG_KEY}:null`, ready()[`${EMAIL_TEMPLATES_CONFIG_KEY}:null`]);
  const on = await request(url, { user: ADMIN, method: "PUT", body: { use: CONFIRMED, active: true, municipalityId: OTHER } });
  assert.equal(on.status, 200);
  assert.equal(on.body.uses.find(({ key }) => key === CONFIRMED).active, true);
  assert.deepEqual(database.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [CONFIRMED]: true } });
  assert.equal(database.store.has(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), false);
  const other = await request("/email/settings", { user: OTHER_ADMIN });
  assert.equal(other.body.uses.find(({ key }) => key === CONFIRMED).active, false);
  const off = await request(url, { user: ADMIN, method: "PUT", body: { use: CONFIRMED, active: false } });
  assert.equal(off.body.uses.find(({ key }) => key === CONFIRMED).active, false);
  assert.deepEqual(database.audits.map(({ action, municipalityId }) => [action, municipalityId]), [["EMAIL_USE_UPDATE", MUNICIPALITY], ["EMAIL_USE_UPDATE", MUNICIPALITY]]);
});

test("global users choose the municipality for a switch, and invalid requests are refused", async (t) => {
  const { request, database } = await fixture(t, ready());
  const url = "/email/templates/active";
  const support = await request(`${url}?municipalityId=${OTHER}`, { user: SUPPORT, method: "PUT", body: { use: CONFIRMED, active: true } });
  assert.equal(support.status, 200);
  assert.deepEqual(database.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), { active: { [CONFIRMED]: true } });
  assert.equal((await request(url, { user: SUPPORT, method: "PUT", body: { use: CONFIRMED, active: true } })).status, 400);
  assert.equal((await request(`${url}?municipalityId=not-a-uuid`, { user: MASTER, method: "PUT", body: { use: CONFIRMED, active: true } })).status, 400);
  assert.equal((await request(`${url}?municipalityId=${UNKNOWN}`, { user: MASTER, method: "PUT", body: { use: CONFIRMED, active: true } })).status, 404);
  for (const body of [{ use: "unknown", active: true }, { use: AuthPurpose.VERIFY_PHONE, active: true }, { use: CONFIRMED, active: "true" }, { use: CONFIRMED }]) {
    assert.equal((await request(url, { user: ADMIN, method: "PUT", body })).status, 400, JSON.stringify(body));
  }
});

test("a database failure answers a generic message, never its detail", async (t) => {
  const { request } = await fixture(t, ready());
  const query = pool.query;
  pool.query = async (sql, values) => { if (sql.includes("SELECT value FROM config")) throw new Error("database secret detail"); return query(sql, values); };
  const response = await request("/email/settings", { user: MASTER });
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(response.body).includes("secret"), false);
});

test("the e-mail keys stay off the generic configuration route", () => {
  const source = readFileSync(new URL("../src/routes/config.js", import.meta.url), "utf8");
  for (const key of [EMAIL_TEMPLATES_CONFIG_KEY, EMAIL_ACTIVE_USES_CONFIG_KEY]) assert.equal(source.includes(`"${key}"`), false, key);
});

// A group of the municipality that gives its items to one team user.
const emailGroup = (items = [EMAIL_SETTINGS_PERMISSION], member = ANALYST, extra = {}) => permissionConfigs(MUNICIPALITY, {
  users: [{ id: member.id, permissionGroupId: "g" }], groups: [permissionGroup("g", items, extra)],
});

test("a staff user with the e-mail permission reads the municipal view and switches the messages, and never reaches the platform's routes", async (t) => {
  const { request, database } = await fixture(t, { ...ready(), ...emailGroup() });
  const read = await request("/email/settings", { user: ANALYST });
  assert.equal(read.status, 200); assert.equal(Object.hasOwn(read.body, "account"), false); assert.equal(read.body.integrated, true); assert.equal(read.body.municipal, true);
  const on = await request("/email/templates/active", { method: "PUT", user: ANALYST, body: { use: CONFIRMED, active: true } });
  assert.equal(on.status, 200);
  assert.equal(database.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`).active[CONFIRMED], true);
  assert.equal((await request("/email/templates", { method: "PUT", user: ANALYST, body: {} })).status, 403);
});

test("the group decides: the item must be in it, the group must be active and of the user's municipality, and the manager with no group still passes", async (t) => {
  const { request, database } = await fixture(t, ready());
  const give = (configs) => {
    for (const key of [`castragestao:teams:${MUNICIPALITY}`, `permission_groups:${MUNICIPALITY}`]) database.store.delete(key);
    for (const [key, value] of Object.entries(configs)) database.store.set(key, value);
  };
  const reads = async (user) => (await request("/email/settings", { user })).status;
  assert.equal(await reads(ANALYST), 403, "no group, no permission");
  assert.equal(await reads(ADMIN), 200, "the manager with no group passes by the role");
  give(emailGroup(["sms_settings"]));
  assert.equal(await reads(ANALYST), 403, "a group without the e-mail item");
  give(emailGroup([EMAIL_SETTINGS_PERMISSION], ANALYST, { active: false }));
  assert.equal(await reads(ANALYST), 403, "an inactive group is no group");
  give(permissionConfigs(OTHER, { users: [{ id: ANALYST.id, permissionGroupId: "g" }], groups: [permissionGroup("g", [EMAIL_SETTINGS_PERMISSION])] }));
  assert.equal(await reads(ANALYST), 403, "a group of another municipality");
  give(emailGroup(["sms_settings"], ADMIN));
  assert.equal(await reads(ADMIN), 403, "the manager is judged by their group too");
  give(emailGroup());
  assert.equal(await reads(ANALYST), 200);
  assert.equal(await reads(TUTOR), 403);
  assert.equal(await reads(OTHER_ADMIN), 200, "another municipality's manager has no group there and passes by the role");
  give({ ...permissionConfigs(MUNICIPALITY, { users: [{ id: "another-id", email: "STAFF@example.test", permissionGroupId: "g" }], groups: [permissionGroup("g", [EMAIL_SETTINGS_PERMISSION])] }) });
  assert.equal(await reads(ANALYST), 403, "an entry with the same e-mail but another id gives nothing");
});

test("turning a message on does not depend on the contract, which decides only the sending", async (t) => {
  const { request } = await fixture(t, { ...ready(), [`email_quota:${MUNICIPALITY}`]: { plan: 10, enabled: false } });
  assert.equal((await request("/email/templates/active", { method: "PUT", user: ADMIN, body: { use: CONFIRMED, active: true } })).status, 200);
  assert.equal((await request("/email/templates/active", { method: "PUT", user: ADMIN, body: { use: CONFIRMED, active: false } })).status, 200);
});
