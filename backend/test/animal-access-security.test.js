import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import animalRoutes from "../src/routes/animals.js";
import { pool } from "../src/db/index.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const ANIMAL_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "44444444-4444-4444-8444-444444444444";
const TUTOR = { id: OWNER_ID, role: "tutor", municipalityId: MUNICIPALITY };
const CPF = "52998224725";
const clientFetch = globalThis.fetch;

async function fixture(t, { existingAnimal = true, globalCollision = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "animal-access-tests-only";
  const calls = [];
  const users = new Map();
  const animal = { id: ANIMAL_ID, microchip: "CHIP123", name: "Animal", species: "Cão" };
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("SELECT a.* FROM animals")) return { rows: existingAnimal && values[1] === MUNICIPALITY ? [structuredClone(animal)] : [] };
    if (sql.includes("FROM users u") || sql.includes("JOIN users u")) return { rows: values[1] === OWNER_ID && values[2] === MUNICIPALITY ? [{ ok: true }] : [] };
    if (sql.includes("FROM request_validation_keys")) return { rows: values[0] === CPF && values[1] === "known-key" ? [{ ok: true }] : [] };
    if (/^SELECT 1\s+FROM animal_tutors/.test(sql)) return { rows: values[1] === CPF && values[2] === MUNICIPALITY ? [{ ok: true }] : [] };
    if (sql.includes("SELECT at.*")) return { rows: [{ user_id: OWNER_ID, cpf: CPF, tutor_name: "Tutor" }] };
    if (sql.includes("SELECT 1 FROM animal_records")) return { rows: values[1] === MUNICIPALITY ? [{ ok: true }] : [] };
    if (sql.includes("FROM animal_records ar")) {
      assert.equal(values[1], MUNICIPALITY);
      assert.match(sql, /municipality_id = \$2/);
      return { rows: [] };
    }
    if (sql.includes("FROM requests r")) {
      if (sql.includes("JOIN LATERAL")) return { rows: [{ id: "source", municipality_id: MUNICIPALITY, cpf: CPF, matched_animal: {} }] };
      assert.equal(values[2], MUNICIPALITY);
      assert.match(sql, /r\.municipality_id = \$3/);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO request_protocol_counters")) return { rows: [{ seq: 1 }] };
    if (sql.includes("INSERT INTO animals")) {
      assert.match(sql, /ON CONFLICT \(microchip\) DO NOTHING/);
      return { rows: globalCollision ? [] : [structuredClone(animal)] };
    }
    if (sql.includes("INSERT INTO requests")) return { rows: [{ id: "new-request", tutor_id: values[0], validation_key: values[2] }] };
    if (sql.includes("INSERT INTO animal_records")) return { rows: [] };
    throw new Error("Unexpected animal-access test query");
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const app = express(); app.use(express.json()); app.use("/animals", animalRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  async function request(path, body, user) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}/animals${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, calls };
}

test("microchip-only lookup and consultation are denied before any animal database operation", async (t) => {
  const { request, calls } = await fixture(t);
  for (const path of ["/lookup", "/consult"]) {
    assert.equal((await request(path, { microchip: "CHIP123", municipalityId: MUNICIPALITY })).status, 403);
    assert.equal((await request(path, { microchip: "CHIP123", cpf: CPF, validationKey: "known-key" })).status, 400);
  }
  assert.equal(calls.length, 0);
});

test("authenticated animal owner and history are scoped by persisted municipality and user", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request("/consult", { microchip: "CHIP123", municipalityId: OTHER_MUNICIPALITY }, TUTOR);
  assert.equal(response.status, 200);
  assert.equal(response.body.animal.id, ANIMAL_ID);
  const historyQueries = calls.filter(({ sql }) => sql.includes("ORDER BY occurred_at") || sql.includes("signature_data_url"));
  assert.ok(historyQueries.length >= 2);
  assert.ok(historyQueries.every(({ values }) => values.includes(MUNICIPALITY) && values.includes(OWNER_ID)));
});

test("an authenticated non-owner cannot bypass consultation by omitting legacy credentials", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request("/consult", { microchip: "CHIP123" }, { ...TUTOR, id: "55555555-5555-4555-8555-555555555555" });
  assert.equal(response.status, 403);
  assert.equal(calls.some(({ sql }) => sql.includes("SELECT at.*")), false);
  assert.equal(response.body.tutor, undefined);
});

test("transitional consultation needs valid CPF, key and municipal relationship", async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request("/consult", { microchip: "CHIP123", municipalityId: MUNICIPALITY, cpf: CPF, validationKey: "bad-key" })).status, 403);
  assert.equal((await request("/consult", { microchip: "CHIP123", municipalityId: MUNICIPALITY, cpf: CPF, validationKey: "known-key" })).status, 200);
});

test("internal animal action does not assign staff as tutor or disclose a CPF-wide key", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request(`/${ANIMAL_ID}/death`, { deathDate: "2026-11-13", deathCause: "Reported", cpf: "11111111111" },
    { id: "66666666-6666-4666-8666-666666666666", role: "analista", municipalityId: MUNICIPALITY });
  assert.equal(response.status, 201);
  assert.equal(response.body.tutor_id, OWNER_ID);
  assert.notEqual(response.body.validation_key, "known-key");
  assert.equal(calls.some(({ sql }) => sql.includes("SELECT validation_key FROM request_validation_keys")), false);
});

test("external consultation never materializes an animal from a claimed microchip", async (t) => {
  const { request, calls } = await fixture(t, { existingAnimal: false });
  assert.equal((await request("/consult", { microchip: "CHIP123" }, TUTOR)).status, 404);
  assert.equal((await request("/lookup", { microchip: "CHIP123", municipalityId: MUNICIPALITY, cpf: CPF, validationKey: "known-key" })).status, 404);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO animals") || sql.includes("INSERT INTO animal_tutors") || sql.includes("JOIN LATERAL")), false);
});

test("a globally existing microchip cannot be reassigned by scoped staff materialization", async (t) => {
  const { request, calls } = await fixture(t, { existingAnimal: false, globalCollision: true });
  const response = await request("/consult", { microchip: "CHIP123" }, { ...TUTOR, role: "analista" });
  assert.equal(response.status, 404);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO animal_tutors") || sql.includes("INSERT INTO animal_records")), false);
});

test("legacy authorization demands a municipal request with the same CPF", async (t) => {
  const { request, calls } = await fixture(t);
  await request("/lookup", { microchip: "CHIP123", municipalityId: MUNICIPALITY, cpf: CPF, validationKey: "known-key" });
  const relation = calls.find(({ sql }) => /^SELECT 1\s+FROM animal_tutors/.test(sql));
  assert.match(relation.sql, /JOIN requests r ON r.id = ar.request_id/);
  assert.match(relation.sql, /ar\.municipality_id = \$3/);
  assert.match(relation.sql, /COALESCE\(r\.cpf/);
  assert.deepEqual(relation.values, [ANIMAL_ID, CPF, MUNICIPALITY]);
});
