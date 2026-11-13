import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import municipalitiesRouter from "../src/routes/municipalities.js";
import { pool } from "../src/db/index.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const municipalityId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";

async function fixture(t, existingAdmin) {
  const prior = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, initial: process.env.DEFAULT_MUNICIPALITY_ADMIN_PASSWORD };
  process.env.JWT_SECRET = "municipality-identity-test-only";
  process.env.DEFAULT_MUNICIPALITY_ADMIN_PASSWORD = "test-only-initial-password";
  const users = new Map();
  const token = registerTestSession(users, { id: adminId, role: "master" });
  const calls = [];
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("INSERT INTO municipalities")) return { rows: [{ id: municipalityId, name: "Test Town", slug: "test-town", state: "SC" }] };
    if (sql.startsWith("SELECT id, name, email, role, municipality_id, is_default_admin FROM users")) return { rows: existingAdmin ? [existingAdmin] : [] };
    if (sql.includes("INSERT INTO users")) return { rows: [{ id: adminId, name: values[0], email: values[1], role: values[3], municipality_id: values[4] }] };
    if (sql.includes("INSERT INTO config") || sql.includes("INSERT INTO sectors") || sql.includes("INSERT INTO user_sectors") || sql.includes("INSERT INTO audit_logs")) return { rows: [] };
    throw new Error("Unexpected test database query");
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const app = express();
  app.use(express.json());
  app.use("/municipalities", municipalitiesRouter);
  const server = await new Promise((resolve) => {
    const running = app.listen(0, "127.0.0.1", () => resolve(running));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = prior.query; pool.connect = prior.connect;
    for (const [key, value] of [["JWT_SECRET", prior.secret], ["DEFAULT_MUNICIPALITY_ADMIN_PASSWORD", prior.initial]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  return { calls, request: async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/municipalities`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Town", state: "SC" }),
    });
    return { status: response.status, body: await response.json(), cacheControl: response.headers.get("cache-control") };
  } };
}

test("municipality administrator creation cannot overwrite a colliding privileged identity", async (t) => {
  const { request, calls } = await fixture(t, { id: adminId, email: "test-town@adm.castragestao", role: "master", municipality_id: null });
  assert.equal((await request()).status, 409);
  assert.ok(calls.some(({ sql }) => sql === "ROLLBACK"));
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO users")), false);
});

test("repeated municipality setup preserves its existing default administrator credential", async (t) => {
  const existing = { id: adminId, name: "Existing Admin", email: "test-town@adm.castragestao", role: "admin_municipal", municipality_id: municipalityId, is_default_admin: true };
  const { request, calls } = await fixture(t, existing);
  const response = await request();
  assert.equal(response.status, 201);
  assert.equal(response.body.defaultUser.temporaryPassword, undefined);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO users")), false);
});

test("only newly created administrator returns one ephemeral initial credential", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request();
  assert.equal(response.status, 201);
  assert.equal(response.cacheControl, "no-store");
  const write = calls.find(({ sql }) => sql.includes("INSERT INTO users"));
  assert.doesNotMatch(write.sql, /ON CONFLICT/);
  assert.match(write.values[2], /^\$2[aby]\$/);
  assert.equal(write.values.includes(response.body.defaultUser.temporaryPassword), false);
});
