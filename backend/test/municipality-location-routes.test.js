import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import municipalitiesRouter from "../src/routes/municipalities.js";
import { pool } from "../src/db/index.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const MASTER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const ANALYST = "55555555-5555-4555-8555-555555555555";
const TUTOR = "66666666-6666-4666-8666-666666666666";
const location = { contact: "(48) 99999-0000", cep: "88820-000", address: "Rua das Flores", addressNumber: "100", addressComplement: "Sala 2", neighborhood: "Centro" };

// `config` answers the reads of the team and of the permission groups (key -> value); with none, nobody has a group.
async function fixture(t, { config = {} } = {}) {
  const prior = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, initial: process.env.DEFAULT_MUNICIPALITY_ADMIN_PASSWORD };
  process.env.JWT_SECRET = "municipality-location-test-only";
  process.env.DEFAULT_MUNICIPALITY_ADMIN_PASSWORD = "test-only-initial-password";
  const users = new Map();
  const tokens = {
    master: registerTestSession(users, { id: MASTER, role: "master" }),
    admin: registerTestSession(users, { id: ADMIN, role: "admin_municipal", municipalityId: MUNICIPALITY }),
    analyst: registerTestSession(users, { id: ANALYST, role: "analista", municipalityId: MUNICIPALITY }),
    tutor: registerTestSession(users, { id: TUTOR, role: "tutor", municipalityId: MUNICIPALITY }),
  };
  const calls = [];
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    if (sql.includes("FROM config WHERE key=$1")) return { rows: values[0] in config ? [{ value: config[values[0]] }] : [] };
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("INSERT INTO municipalities")) return { rows: [{ id: MUNICIPALITY, name: "Test Town", slug: "test-town", state: "SC" }] };
    if (sql.startsWith("UPDATE municipalities")) return { rows: values.at(-1) === MUNICIPALITY ? [{ id: MUNICIPALITY }] : [] };
    if (sql.startsWith("SELECT id, name, email, role, municipality_id, is_default_admin FROM users")) return { rows: [] };
    if (sql.includes("INSERT INTO users")) return { rows: [{ id: ADMIN, name: values[0], email: values[1], role: values[3], municipality_id: values[4] }] };
    if (["INSERT INTO config", "INSERT INTO audit_logs"].some((start) => sql.includes(start))) return { rows: [] };
    throw new Error(`Unexpected test database query: ${sql}`);
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/municipalities", municipalitiesRouter);
  const server = await new Promise((resolve) => { const running = app.listen(0, "127.0.0.1", () => resolve(running)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = prior.query; pool.connect = prior.connect;
    for (const [key, value] of [["JWT_SECRET", prior.secret], ["DEFAULT_MUNICIPALITY_ADMIN_PASSWORD", prior.initial]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const send = async (method, path, token, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/municipalities${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { calls, tokens, send };
}

test("creating a municipality saves the contact masked, the CEP as digits and the address in separate columns", async (t) => {
  const { calls, tokens, send } = await fixture(t);
  const response = await send("POST", "", tokens.master, { name: "Test Town", state: "SC", ...location });
  assert.equal(response.status, 201);
  const insert = calls.find(({ sql }) => sql.includes("INSERT INTO municipalities"));
  assert.match(insert.sql, /address_number, address_complement, neighborhood/);
  assert.deepEqual(insert.values.slice(3, 10), ["(48) 99999-0000", "", "Rua das Flores", "100", "Sala 2", "Centro", "88820000"]);
});

test("a contact or a CEP that cannot be saved is refused before anything is written", async (t) => {
  const { calls, tokens, send } = await fixture(t);
  for (const patch of [{ contact: "4899" }, { cep: "8882" }, { neighborhood: "x".repeat(121) }]) {
    const created = await send("POST", "", tokens.master, { name: "Test Town", state: "SC", ...patch });
    assert.equal(created.status, 400, JSON.stringify(patch));
    const updated = await send("PATCH", `/${MUNICIPALITY}`, tokens.master, patch);
    assert.equal(updated.status, 400, JSON.stringify(patch));
  }
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO municipalities") || sql.startsWith("UPDATE municipalities")), false);
});

test("the administrator of a municipality edits its contact and address, and only its own", async (t) => {
  const { calls, tokens, send } = await fixture(t);
  const own = await send("PATCH", `/${MUNICIPALITY}`, tokens.admin, { ...location, name: "Renamed", state: "RS" });
  assert.equal(own.status, 200);
  const update = calls.find(({ sql }) => sql.startsWith("UPDATE municipalities"));
  assert.match(update.sql, /address_number = \$\d, address_complement = \$\d, neighborhood = \$\d/);
  assert.doesNotMatch(update.sql, /\bname =|\bstate =/, "tenant identity stays with the support");
  assert.deepEqual(update.values.slice(0, 6), ["(48) 99999-0000", "Rua das Flores", "100", "Sala 2", "Centro", "88820000"]);
  assert.equal((await send("PATCH", `/${OTHER}`, tokens.admin, location)).status, 403);
  assert.equal((await send("PATCH", `/${OTHER}`, tokens.analyst, location)).status, 403);
});

test("the support also edits the name and the state, and a partial update touches only what it carries", async (t) => {
  const { calls, tokens, send } = await fixture(t);
  assert.equal((await send("PATCH", `/${MUNICIPALITY}`, tokens.master, { name: "Renamed", state: "rs", neighborhood: " Centro " })).status, 200);
  const update = calls.find(({ sql }) => sql.startsWith("UPDATE municipalities"));
  assert.match(update.sql, /name = \$1, state = \$2, neighborhood = \$3/);
  assert.deepEqual(update.values.slice(0, 3), ["Renamed", "RS", "Centro"]);
  assert.doesNotMatch(update.sql, /contact|cep|address =/);
});

test("only staff with the Dados Gerais item edit the data of the municipality: not a tutor, not an analyst without it", async (t) => {
  const { calls, tokens, send } = await fixture(t);
  for (const token of [tokens.tutor, tokens.analyst]) assert.equal((await send("PATCH", `/${MUNICIPALITY}`, token, location)).status, 403);
  assert.equal(calls.some(({ sql }) => sql.startsWith("UPDATE municipalities")), false);
});

test("the permission group decides: the item lets an analyst edit, and its absence stops even the manager", async (t) => {
  const groups = [{ id: "editors", active: true, allowedConfigItems: ["municipalities"] }, { id: "limited", active: true, allowedConfigItems: ["environment"] }];
  const team = { users: [{ id: ANALYST, permissionGroupId: "editors" }, { id: ADMIN, permissionGroupId: "limited" }] };
  const { calls, tokens, send } = await fixture(t, { config: { "castragestao:teams": team, permission_groups: groups } });
  assert.equal((await send("PATCH", `/${MUNICIPALITY}`, tokens.analyst, location)).status, 200);
  assert.equal((await send("PATCH", `/${MUNICIPALITY}`, tokens.admin, location)).status, 403);
  assert.equal(calls.filter(({ sql }) => sql.startsWith("UPDATE municipalities")).length, 1);
  assert.equal((await send("PATCH", `/${OTHER}`, tokens.analyst, location)).status, 403, "the item never reaches another municipality");
});

test("the brasão and the department logo are saved on creation and on edit, and an image its public link could not serve is refused", async (t) => {
  const { calls, tokens, send } = await fixture(t);
  const brasao = `data:image/png;base64,${Buffer.from("fake brasao").toString("base64")}`;
  const logo = `data:image/webp;base64,${Buffer.from("fake logo").toString("base64")}`;
  assert.equal((await send("POST", "", tokens.master, { name: "Test Town", state: "SC", brasao, departmentLogo: logo })).status, 201);
  const insert = calls.find(({ sql }) => sql.includes("INSERT INTO municipalities"));
  assert.match(insert.sql, /department_name, brasao, department_logo, active/);
  assert.match(insert.sql, /brasao = EXCLUDED\.brasao,\s+department_logo = EXCLUDED\.department_logo/);
  assert.deepEqual(insert.values.slice(11, 13), [brasao, logo]);

  assert.equal((await send("PATCH", `/${MUNICIPALITY}`, tokens.admin, { brasao: "", departmentLogo: logo })).status, 200);
  const update = calls.find(({ sql }) => sql.startsWith("UPDATE municipalities"));
  assert.match(update.sql, /brasao = \$1, department_logo = \$2/);
  assert.deepEqual(update.values.slice(0, 2), ["", logo]);

  const svg = `data:image/svg+xml;base64,${Buffer.from("<svg></svg>").toString("base64")}`;
  const refused = await send("PATCH", `/${MUNICIPALITY}`, tokens.master, { departmentLogo: svg });
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error, "Não foi possível usar o logo do órgão. Envie uma imagem PNG, JPG ou WEBP de até 2 MB.");
  assert.equal((await send("POST", "", tokens.master, { name: "Test Town", state: "SC", brasao: "https://example.test/brasao.png" })).status, 400);
  assert.equal(calls.filter(({ sql }) => sql.includes("INSERT INTO municipalities") || sql.startsWith("UPDATE municipalities")).length, 2);
});
