import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import accessRequestRoutes from "../src/routes/accessRequests.js";
import { pool } from "../src/db/index.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const ADMIN = { id: USER_ID, role: "admin_municipal", municipalityId: MUNICIPALITY };
const clientFetch = globalThis.fetch;

async function fixture(t, { collision = false, approved = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "access-request-tests-only";
  const calls = [];
  const users = new Map();
  let row = { id: ID, requester_type: "ONG", responsible_name: "Association", email: "association@example.test",
    municipality_id: MUNICIPALITY, status: approved ? "APROVADO" : "PENDENTE", created_user_id: approved ? USER_ID : null,
    temporary_password: approved ? "legacy-plaintext-never-return" : null, history: [] };
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("SELECT * FROM access_requests")) return { rows: [structuredClone(row)] };
    if (sql.includes("SELECT id FROM users")) return { rows: collision ? [{ id: USER_ID }] : [] };
    if (sql.includes("INSERT INTO users")) return { rows: [{ id: USER_ID }] };
    if (sql.includes("UPDATE access_requests")) {
      assert.equal(sql.includes("temporary_password ="), false);
      row = { ...row, status: values[0], created_user_id: values[3] };
      return { rows: [structuredClone(row)] };
    }
    if (sql.includes("INSERT INTO audit_logs")) return { rows: [] };
    throw new Error("Unexpected access-request test query");
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const app = express();
  app.use(express.json());
  app.use("/access", accessRequestRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.secret;
  });
  async function request(path = "/access", { user = ADMIN, method = "GET", body } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  }
  return { request, calls };
}

test("tutor, ONG and protector cannot list or approve credentials", async (t) => {
  const { request, calls } = await fixture(t);
  for (const role of ["tutor", "ong", "protetor"]) {
    const user = { ...ADMIN, role };
    assert.equal((await request("/access", { user })).status, 403);
    assert.equal((await request(`/access/${ID}/review`, { user, method: "PATCH", body: { status: "APROVADO" } })).status, 403);
  }
  assert.equal(calls.length, 0);
});

test("authorized lists never expose old temporary passwords", async (t) => {
  const { request } = await fixture(t, { approved: true });
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.body[0].temporary_password, undefined);
  assert.equal(response.body[0].credential, undefined);
  assert.doesNotMatch(JSON.stringify(response.body), /legacy-plaintext/);
});

test("credential approval cannot overwrite an existing identity by e-mail", async (t) => {
  const { request, calls } = await fixture(t, { collision: true });
  const response = await request(`/access/${ID}/review`, { method: "PATCH", body: { status: "APROVADO" } });
  assert.equal(response.status, 409);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO users") || sql.includes("UPDATE access_requests")), false);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
});

test("only actual account creation returns an ephemeral credential outside persisted fields", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request(`/access/${ID}/review`, { method: "PATCH", body: { status: "APROVADO", municipalityId: OTHER_MUNICIPALITY } });
  assert.equal(response.status, 200);
  assert.equal(response.cache, "no-store");
  const password = response.body.credential.temporaryPassword;
  assert.ok(password.length >= 15);
  assert.equal(response.body.temporary_password, undefined);
  assert.equal(calls.some(({ values }) => JSON.stringify(values).includes(password)), false);
  assert.match(calls.find(({ sql }) => sql.includes("INSERT INTO users")).values[2], /^\$2[aby]\$/);
  assert.deepEqual(calls.find(({ sql }) => sql.includes("FOR UPDATE") && sql.includes("access_requests")).values, [ID, MUNICIPALITY]);
  const repeated = await request(`/access/${ID}/review`, { method: "PATCH", body: { status: "APROVADO" } });
  assert.equal(repeated.body.credential, undefined);
  assert.equal(calls.filter(({ sql }) => sql.includes("INSERT INTO users")).length, 1);
});
