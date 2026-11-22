import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import animalRoutes from "../src/routes/animals.js";
import { pool } from "../src/db/index.js";
import { COMPLAINT_PHOTO_IDS } from "../../shared/complaint-photo-contract.js";
import { DocumentSequence } from "../../shared/document-number-contract.js";
import { RequestKind } from "../../shared/request-contract.js";
import { StaffNotificationType } from "../../shared/staff-notifications-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { assertInsertShape } from "./fixtures/insert-shape.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const ANIMAL_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "44444444-4444-4444-8444-444444444444";
const TUTOR = { id: OWNER_ID, role: "tutor", municipalityId: MUNICIPALITY };
const NON_OWNER = { ...TUTOR, id: "55555555-5555-4555-8555-555555555555" };
const STAFF = { id: "66666666-6666-4666-8666-666666666666", role: "analista", municipalityId: MUNICIPALITY };
const CPF = "52998224725";
const FORGED_CPF = "11111111111";
const TARGET_CPF = "11144477735";
const clientFetch = globalThis.fetch;
// The columns that mark the query reading the animal's requests for its history.
const REQUEST_HISTORY_COLUMNS = "signed_at, created_at, updated_at";

async function fixture(t, { existingAnimal = true, globalCollision = false, chipless = false, requestHistory = [] } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "animal-access-tests-only";
  const calls = [];
  const users = new Map();
  const animal = { id: ANIMAL_ID, microchip: chipless ? null : "CHIP123", name: "Animal", species: "Cão" };
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("SELECT a.* FROM animals")) {
      const knownKey = sql.includes("a.id = $1") ? values[0] === ANIMAL_ID : values[0] === animal.microchip;
      return { rows: existingAnimal && knownKey && values[1] === MUNICIPALITY ? [structuredClone(animal)] : [] };
    }
    if (sql.includes("FROM users u") || sql.includes("JOIN users u")) return { rows: values[1] === OWNER_ID && values[2] === MUNICIPALITY ? [{ ok: true }] : [] };
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
      return { rows: structuredClone(requestHistory) };
    }
    if (sql.includes("INSERT INTO document_counters")) {
      assert.deepEqual(values.slice(0, 2), [MUNICIPALITY, DocumentSequence.PROTOCOL]);
      return { rows: [{ seq: 1 }] };
    }
    if (sql.includes("INSERT INTO animals")) {
      assert.match(sql, /ON CONFLICT \(microchip\) DO NOTHING/);
      return { rows: globalCollision ? [] : [structuredClone(animal)] };
    }
    if (sql.includes("INSERT INTO requests")) {
      assertInsertShape(sql, values);
      return { rows: [{ id: "new-request", tutor_id: values[0], protocol: values[1], cpf: values[4], municipality_id: values.at(-1) }] };
    }
    if (sql.includes("INSERT INTO staff_notifications")) return { rows: [] };
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
    return { status: response.status, body: await response.json().catch(() => null) };
  }
  return { request, calls };
}

test("animal lookup, consultation and tutor actions require a logged-in user", async (t) => {
  const { request, calls } = await fixture(t);
  for (const path of ["/lookup", "/consult", `/${ANIMAL_ID}/death`, `/${ANIMAL_ID}/transfer`]) {
    assert.equal((await request(path, { microchip: "CHIP123", municipalityId: MUNICIPALITY })).status, 401, path);
    assert.equal((await request(path, { animalId: ANIMAL_ID, municipalityId: MUNICIPALITY })).status, 401, path);
    // A CPF plus a former validation key is no credential any more.
    assert.equal((await request(path, { microchip: "CHIP123", municipalityId: MUNICIPALITY, cpf: CPF, validationKey: "former-key" })).status, 401, path);
  }
  assert.equal(calls.length, 0);
});

test("authenticated animal owner and history are scoped by persisted municipality and user", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request("/consult", { microchip: "CHIP123", municipalityId: OTHER_MUNICIPALITY }, TUTOR);
  assert.equal(response.status, 200);
  assert.equal(response.body.animal.id, ANIMAL_ID);
  const historyQueries = calls.filter(({ sql }) => sql.includes("ORDER BY occurred_at") || sql.includes(REQUEST_HISTORY_COLUMNS));
  assert.ok(historyQueries.length >= 2);
  assert.ok(historyQueries.every(({ values }) => values.includes(MUNICIPALITY) && values.includes(OWNER_ID)));
});

test("animal history hides complaint photos from the owner and retains them for the authorized staff", async (t) => {
  const photo = { documentId: COMPLAINT_PHOTO_IDS[0], dataUrl: "case-photo" };
  const otherDocument = { documentId: "identity" };
  const { request } = await fixture(t, { requestHistory: [{ request_type: RequestKind.COMPLAINT, documents: [photo, otherDocument] }] });
  const consult = (user) => request("/consult", { animalId: ANIMAL_ID }, user);
  const tutor = await consult(TUTOR);
  assert.equal(tutor.status, 200);
  assert.deepEqual(tutor.body.history[0].data.registration.documents, [otherDocument]);
  const staff = await consult(STAFF);
  assert.equal(staff.status, 200);
  assert.deepEqual(staff.body.history[0].data.registration.documents, [photo, otherDocument]);
});

test("the owner consults an animal by id, including an animal without microchip", async (t) => {
  const { request, calls } = await fixture(t, { chipless: true });
  const response = await request("/consult", { animalId: ANIMAL_ID, municipalityId: OTHER_MUNICIPALITY }, TUTOR);
  assert.equal(response.status, 200);
  assert.equal(response.body.animal.id, ANIMAL_ID);
  assert.equal(response.body.animal.microchip, null);
  // A missing microchip is bound as NULL, so it can never match other chipless requests.
  const requestHistory = calls.find(({ sql }) => sql.includes(REQUEST_HISTORY_COLUMNS));
  assert.deepEqual(requestHistory.values, [ANIMAL_ID, null, MUNICIPALITY, OWNER_ID]);
});

test("animal id consultation rejects malformed ids before the database and non-owners after the lookup", async (t) => {
  const { request, calls } = await fixture(t);
  for (const animalId of ["not-a-uuid", "", 12, null, { $ne: "x" }]) {
    assert.equal((await request("/consult", { animalId, municipalityId: MUNICIPALITY }, TUTOR)).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await request("/consult", { animalId: ANIMAL_ID }, NON_OWNER);
  assert.equal(response.status, 403);
  assert.equal(calls.some(({ sql }) => sql.includes("SELECT at.*")), false);
});

test("an authenticated non-owner cannot consult another tutor's animal", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request("/consult", { microchip: "CHIP123" }, NON_OWNER);
  assert.equal(response.status, 403);
  assert.equal(calls.some(({ sql }) => sql.includes("SELECT at.*")), false);
  assert.equal(response.body.tutor, undefined);
});

test("owner death and transfer requests are attributed to the authenticated owner and ignore a CPF in the body", async (t) => {
  const { request, calls } = await fixture(t);
  const death = await request(`/${ANIMAL_ID}/death`, { death_date: "2026-11-13", death_cause: "Illness", cpf: FORGED_CPF }, TUTOR);
  assert.equal(death.status, 201);
  const transfer = await request(`/${ANIMAL_ID}/transfer`, { target_tutor_name: "New Tutor", target_tutor_cpf: TARGET_CPF, cpf: FORGED_CPF }, TUTOR);
  assert.equal(transfer.status, 201);
  const inserts = calls.filter(({ sql }) => sql.includes("INSERT INTO requests"));
  assert.equal(inserts.length, 2);
  for (const { sql, values } of inserts) {
    assert.equal(sql.includes("validation_key"), false);
    assert.equal(values[0], OWNER_ID);
    assert.equal(values[4], CPF);
  }
  const events = calls.filter(({ sql }) => sql.includes("INSERT INTO staff_notifications"));
  assert.deepEqual(events.map(({ values }) => values), [death.body, transfer.body]
    .map((request) => [MUNICIPALITY, request.id, StaffNotificationType.REQUEST_CREATED]));
  for (const event of events) assert.equal(calls[calls.indexOf(event) + 1].sql, "COMMIT");
});

test("non-owners cannot open death or transfer requests for an animal", async (t) => {
  const { request, calls } = await fixture(t);
  assert.equal((await request(`/${ANIMAL_ID}/death`, { death_date: "2026-11-13", death_cause: "Illness" }, NON_OWNER)).status, 403);
  assert.equal((await request(`/${ANIMAL_ID}/transfer`, { target_tutor_name: "New Tutor", target_tutor_cpf: TARGET_CPF }, NON_OWNER)).status, 403);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO requests") || sql.includes("INSERT INTO animal_records")), false);
});

test("internal animal action does not assign staff as tutor and ignores a CPF in the body", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request(`/${ANIMAL_ID}/death`, { deathDate: "2026-11-13", deathCause: "Reported", cpf: FORGED_CPF }, STAFF);
  assert.equal(response.status, 201);
  assert.equal(response.body.tutor_id, OWNER_ID);
  assert.equal(response.body.cpf, CPF);
  assert.equal(calls.find(({ sql }) => sql.includes("INSERT INTO requests")).sql.includes("validation_key"), false);
});

test("external consultation never materializes an animal from a claimed microchip", async (t) => {
  const { request, calls } = await fixture(t, { existingAnimal: false });
  assert.equal((await request("/consult", { microchip: "CHIP123" }, TUTOR)).status, 404);
  assert.equal((await request("/lookup", { microchip: "CHIP123", municipalityId: MUNICIPALITY }, TUTOR)).status, 404);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO animals") || sql.includes("INSERT INTO animal_tutors") || sql.includes("JOIN LATERAL")), false);
});

test("a globally existing microchip cannot be reassigned by scoped staff materialization", async (t) => {
  const { request, calls } = await fixture(t, { existingAnimal: false, globalCollision: true });
  const response = await request("/consult", { microchip: "CHIP123" }, { ...TUTOR, role: "analista" });
  assert.equal(response.status, 404);
  assert.equal(calls.some(({ sql }) => sql.includes("INSERT INTO animal_tutors") || sql.includes("INSERT INTO animal_records")), false);
});
