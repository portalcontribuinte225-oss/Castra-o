import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import animalRoutes from "../src/routes/animals.js";
import { pool } from "../src/db/index.js";
import { issueSession } from "../src/services/auth/auth-session.js";
import { animalFingerprint } from "../src/services/registered-animals/animal-data.js";
import { registerRequestAnimals } from "../src/services/registered-animals/registered-request.js";
import { sessionUser, registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { registeredAnimalDatabase, ANIMAL_TEST_MUNICIPALITY as MUNICIPALITY, ANIMAL_TEST_OTHER as OTHER,
  ANIMAL_TEST_USER as USER, ANIMAL_TEST_REQUEST as REQUEST } from "./fixtures/registered-animal-db.js";

const clientFetch = globalThis.fetch;
const tutor = { id: USER, role: "tutor", municipalityId: MUNICIPALITY };
const animalData = { name: "Animal próprio", species: "Cão", sex: "Fêmea", size: "Pequeno", breedType: "Indefinida", microchip: "declared123" };

async function fixture(t, { registered = true, inactiveIdentification = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "registered-animal-route-tests-only";
  const db = registeredAnimalDatabase(); const sessions = new Map();
  db.profiles.set(USER, { name: "Tutor atual", cpf: "52998224725", email: "own@example.test", municipality_id: MUNICIPALITY });
  const source = { id: REQUEST, tutor_id: USER, municipality_id: MUNICIPALITY, tutor_name: "Tutor", cpf: "52998224725",
    request_type: "PROCEDIMENTO", animals: [{ ...animalData }], workflow_data: { identificationTypeId: "animal_com_tutor" } };
  db.requests.set(REQUEST, source);
  if (registered) await registerRequestAnimals(db, { body: source, request: source, user: tutor, tutorId: USER, municipalityId: MUNICIPALITY });
  const id = source.animal_id;
  if (id) db.animals.get(id).metadata.privateSecret = "never-return-this";
  db.calls.length = 0;
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, sessions);
    if (session) return session;
    if (sql.includes("FROM municipalities m LEFT JOIN config")) {
      db.calls.push({ sql, values });
      return { rows: [
        { key: "castragestao:request-types", value: [{ id: "procedure", name: "Procedimento", active: true }] },
        { key: "castragestao:identification-types", value: [{ id: "animal_com_tutor", active: !inactiveIdentification }] },
      ] };
    }
    if (sql.includes("a.id::text > $3")) {
      db.calls.push({ sql, values });
      assert.deepEqual(values.slice(0, 2), [USER, MUNICIPALITY]);
      return { rows: [...db.animals.values()].filter((row) => db.owners.some((owner) => owner.animal_id === row.id && owner.user_id === values[0] && owner.active)) };
    }
    if (sql.includes("CROSS JOIN LATERAL")) {
      db.calls.push({ sql, values });
      assert.deepEqual(values.slice(0, 2), [USER, MUNICIPALITY]);
      return { rows: source.animals[0].id ? [] : [{ id: REQUEST, item: source.animals[0], animal_index: 0, cpf: "not-a-public-field" }] };
    }
    return db.query(sql, values);
  };
  // Model the shared municipal transaction lock so two HTTP conversions cannot both create.
  let tail = Promise.resolve();
  pool.query = query;
  pool.connect = async () => {
    let unlock;
    return { async query(sql, values) {
      if (sql.includes("pg_advisory_xact_lock")) {
        const pending = tail; tail = new Promise((resolve) => { unlock = resolve; }); await pending;
      }
      const result = await query(sql, values);
      if (["COMMIT", "ROLLBACK"].includes(sql)) { unlock?.(); unlock = null; }
      return result;
    }, release() { unlock?.(); } };
  };
  const app = express(); app.use(express.json()); app.use("/animals", animalRoutes);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  const request = async (path, { method = "GET", body, user = tutor, restricted = false } = {}) => {
    let token = user ? registerTestSession(sessions, user) : "";
    if (restricted) { const row = { ...sessionUser(user), must_change_password: true }; sessions.set(row.id, row); token = issueSession(row).token; }
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}/animals${path}`, { method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
  };
  return { request, db, id, source };
}

test("all registered-animal endpoints deny anonymous and first-change sessions before animal reads", async (t) => {
  const { request, db, id } = await fixture(t);
  for (const [path, method] of [["/mine", "GET"], ["/from-request", "POST"], [`/${id}/request-context`, "GET"],
    [`/${id}/documents/${REQUEST}/attachment?hash=x`, "GET"], [`/${id}/confirm-microchip`, "POST"]]) {
    assert.equal((await request(path, { method, user: null })).status, 401);
    assert.equal((await request(path, { method, restricted: true })).status, 403);
  }
  assert.equal(db.calls.length, 0);
});

test("mine is tutor-only, server scoped and returns lightweight whitelisted cards", async (t) => {
  const { request, db } = await fixture(t);
  assert.equal((await request("/mine", { user: { ...tutor, role: "analista" } })).status, 403);
  const result = await request(`/mine?municipalityId=${OTHER}&query=animal`);
  assert.equal(result.status, 200); assert.equal(result.cache, "no-store"); assert.equal(result.body.animals.length, 1);
  assert.equal(result.body.animals[0].confirmedMicrochip, ""); assert.equal(result.body.animals[0].declaredMicrochip, "DECLARED123");
  assert.equal(result.body.animals[0].metadata, undefined); assert.equal(JSON.stringify(result.body).includes("never-return-this"), false);
  assert.ok(db.calls.every(({ sql }) => !sql.startsWith("INSERT") && !sql.startsWith("UPDATE")));
});

test("context returns persisted identity and blocks inactive identification without fallback", async (t) => {
  const { request, id } = await fixture(t, { inactiveIdentification: true });
  const result = await request(`/${id}/request-context`);
  assert.equal(result.status, 200); assert.equal(result.body.tutor.cpf, "52998224725"); assert.equal(result.body.tutor.name, "Tutor atual");
  assert.equal(result.body.eligibility.canSubmit, false); assert.deepEqual(result.body.documents, []);
  assert.equal(result.body.animal.identificationTypeId, "animal_com_tutor"); assert.equal(result.body.identificationTypes[0].active, false);
});

test("former owner and another municipality lose context and preview without disclosing content", async (t) => {
  const { request, db, id } = await fixture(t);
  for (const user of [{ ...tutor, municipalityId: OTHER }, { ...tutor, id: "55555555-5555-4555-8555-555555555555" }]) {
    assert.equal((await request(`/${id}/request-context`, { user })).status, 404);
    assert.equal((await request(`/${id}/documents/${REQUEST}/file?hash=x`, { user })).status, 404);
  }
  db.owners[0].active = false;
  assert.equal((await request(`/${id}/request-context`)).status, 404);
  assert.equal(db.calls.some(({ sql }) => sql.includes("jsonb_array_elements") && sql.includes("documents")), false);
});

test("concurrent explicit legacy conversions serialize before source locks and return one UUID", async (t) => {
  const { request, db, source } = await fixture(t, { registered: false });
  const listing = await request("/mine"); assert.equal(listing.body.candidates.length, 1); assert.equal(db.animals.size, 0);
  assert.equal(listing.body.candidates[0].cpf, undefined);
  const body = { sourceRequestId: REQUEST, animalIndex: 0, fingerprint: animalFingerprint(source.animals[0]) };
  const results = await Promise.all([request("/from-request", { method: "POST", body }), request("/from-request", { method: "POST", body })]);
  assert.ok(results.every((result) => result.status === 200)); assert.equal(results[0].body.animal.id, results[1].body.animal.id);
  assert.equal(db.animals.size, 1); assert.equal(db.owners.length, 1);
  assert.ok(db.calls.findIndex(({ sql }) => sql.includes("pg_advisory_xact_lock")) < db.calls.findIndex(({ sql }) => sql.startsWith("SELECT * FROM requests")));
});

test("microchip confirmation rejects tutor and safely rolls back a required audit failure", async (t) => {
  const { request, db, id } = await fixture(t);
  assert.equal((await request(`/${id}/confirm-microchip`, { method: "POST", body: { microchip: "confirmed123" } })).status, 403);
  db.state.failAudit = true;
  const result = await request(`/${id}/confirm-microchip`, { method: "POST", body: { microchip: "confirmed123" }, user: { ...tutor, role: "analista" } });
  assert.equal(result.status, 500); assert.equal(JSON.stringify(result.body).includes("Audit unavailable"), false);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
});
