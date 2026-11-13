import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import adoptionsRouter from "../src/routes/adoptions.js";
import scheduleRouter from "../src/routes/schedule.js";
import { pool } from "../src/db/index.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const ANIMAL_ID = "33333333-3333-4333-8333-333333333333";
const CPF = "52998224725";
const clientFetch = globalThis.fetch;

async function fixture(t) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "public-data-route-tests-only";
  const users = new Map(); const calls = [];
  const adoption = {
    id: ANIMAL_ID, animal_name: "Luna", species: "Canino", sex: "Fêmea", status: "disponivel", municipality_id: MUNICIPALITY,
    photo_url: "public-photo", photos: ["public-photo"], created_at: "2026-11-01", health: ["Vacinada"], description: "Animal disponível",
    interests: [{ name: "PRIVATE_PERSON", cpf: CPF, phone: "PRIVATE_PHONE" }, { name: "ANOTHER_PRIVATE_PERSON", cpf: "11144477735" }],
    adoption_tutor: { cpf: "PRIVATE_ADOPTER_CPF", email: "PRIVATE_EMAIL" }, adoption_notes: "PRIVATE_CASE_NOTE",
    animal_microchip: "PRIVATE_LINKED_MICROCHIP", animal_id: "PRIVATE_RECORD_ID", created_by_name: "PRIVATE_CREATOR",
    future_sensitive_column: "PRIVATE_FUTURE_FIELD",
  };
  const query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push({ sql, values });
    if (sql.includes("SELECT cpf FROM request_validation_keys")) return { rows: [{ cpf: CPF }] };
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("SELECT interests, status FROM adoptions")) return { rows: [{ interests: adoption.interests, status: adoption.status }] };
    if (sql.includes("SELECT interests FROM adoptions")) return { rows: [{ interests: adoption.interests }] };
    if (sql.startsWith("UPDATE adoptions SET interests")) {
      adoption.interests = JSON.parse(values[0]); adoption.status = values[1]; return { rows: [structuredClone(adoption)] };
    }
    if (sql.includes("FROM adoptions")) return { rows: [structuredClone(adoption)] };
    if (sql.includes("INSERT INTO adoptions")) return { rows: [structuredClone(adoption)] };
    if (sql.startsWith("SELECT id FROM municipalities")) return { rows: [{id:values[0]}] };
    if (sql.includes("FROM config")) return { rows: [] };
    if (sql.includes("SELECT id, status, schedule_date, animals, workflow_data FROM requests")) return { rows: [] };
    if (sql.includes("INSERT INTO schedule_days")) return { rows: [{ id: ANIMAL_ID, date: values[0], municipality_id: values[4] }] };
    if (sql.includes("SELECT * FROM schedule_days")) return { rows: [{ id: ANIMAL_ID, municipality_id: MUNICIPALITY, date: "2027-01-01" }] };
    throw new Error(`Unexpected access test SQL: ${sql}`);
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const app = express(); app.use(express.json()); app.use("/adoptions", adoptionsRouter); app.use("/schedule", scheduleRouter);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  async function request(path, { method = "GET", role, body } = {}) {
    const user = role ? { id: "44444444-4444-4444-8444-444444444444", role, municipalityId: MUNICIPALITY } : null;
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, calls, adoption };
}

function assertPublicView(row, count) {
  assert.equal(row.animal_name, "Luna"); assert.equal(row.interestCount, count);
  assert.equal(row.interests, undefined); assert.equal(row.adoption_tutor, undefined); assert.equal(row.adoption_notes, undefined);
  assert.equal(row.animal_microchip, undefined); assert.equal(row.created_by_name, undefined);
  assert.equal(JSON.stringify(row).includes("PRIVATE_"), false);
}

test("tutor cannot mutate schedule or adoption data or list/remove other people's interests", async (t) => {
  const { request, calls } = await fixture(t);
  const operations = [
    ["POST", "/schedule", {}], ["POST", "/schedule/bulk", { days: [] }],
    ["PATCH", `/schedule/${ANIMAL_ID}`, { vacancies: 0 }], ["DELETE", `/schedule/${ANIMAL_ID}`],
    ["POST", "/adoptions", { animal_name: "Luna" }], ["PATCH", `/adoptions/${ANIMAL_ID}`, { status: "adotado" }],
    ["DELETE", `/adoptions/${ANIMAL_ID}`], ["GET", `/adoptions/${ANIMAL_ID}/interests`], ["DELETE", `/adoptions/${ANIMAL_ID}/interest/0`],
  ];
  for (const [method, path, body] of operations) assert.equal((await request(path, { method, role: "tutor", body })).status, 403, `${method} ${path}`);
  assert.equal(calls.length, 0);
});

test("anonymous users and tutors get a public adoption whitelist and aggregate count only", async (t) => {
  const { request, calls } = await fixture(t);
  for (const role of [undefined, "tutor"]) {
    const response = await request(`/adoptions?municipalityId=${MUNICIPALITY}`, { role });
    assert.equal(response.status, 200); assertPublicView(response.body[0], 2);
  }
  assert.equal(calls.every(({ values }) => values[0] === MUNICIPALITY), true);
});

test("public interest registration returns no previous interests, adopter contact or private notes", async (t) => {
  const { request } = await fixture(t);
  for (const role of [undefined, "tutor", "analista"]) {
    const response = await request(`/adoptions/${ANIMAL_ID}/interest`, { method: "POST", role,
      body: { name: "Applicant", phone: "48999991234", municipalityId: MUNICIPALITY } });
    assert.equal(response.status, 200); assertPublicView(response.body, role === undefined ? 3 : role === "tutor" ? 4 : 5);
    assert.equal(JSON.stringify(response.body).includes("48999991234"), false);
  }
});

test("legacy adoption credentials require municipality and return public records without other applicants", async (t) => {
  const { request, calls } = await fixture(t);
  assert.equal((await request("/adoptions/consult", { method: "POST", body: { cpf: CPF, validationKey: "legacy-key" } })).status, 400);
  assert.equal((await request(`/adoptions/by-key/legacy-key?cpf=${CPF}`)).status, 400);
  assert.equal(calls.length, 0);
  const consulted = await request("/adoptions/consult", { method: "POST", body: { cpf: CPF, validationKey: "legacy-key", municipalityId: MUNICIPALITY } });
  assert.equal(consulted.status, 200); assertPublicView(consulted.body[0], 2);
  const byKey = await request(`/adoptions/by-key/legacy-key?cpf=${CPF}&municipalityId=${MUNICIPALITY}`);
  assert.equal(byKey.status, 200); assertPublicView(byKey.body[0], 2);
  const adoptionQueries = calls.filter(({ sql }) => sql.includes("FROM adoptions"));
  assert.equal(adoptionQueries.every(({ sql, values }) => sql.includes("AND municipality_id = $2") && values[1] === MUNICIPALITY), true);
});

test("existing internal and accredited adoption operators retain scoped private operational reads", async (t) => {
  const { request, calls } = await fixture(t);
  for (const role of ["admin_municipal", "analista", "servidor_publico", "ong", "protetor"]) {
    const response = await request(`/adoptions?municipalityId=${OTHER_MUNICIPALITY}`, { role });
    assert.equal(response.status, 200); assert.equal(response.body[0].interests[0].name, "PRIVATE_PERSON");
    const interests = await request(`/adoptions/${ANIMAL_ID}/interests`, { role });
    assert.equal(interests.status, 200); assert.equal(interests.body[0].phone, "PRIVATE_PHONE");
  }
  assert.equal(calls.filter(({ sql }) => sql.includes("FROM adoptions a")).every(({ values }) => values[0] === MUNICIPALITY), true);
});

test("public agenda stays readable while internal creation ignores forged municipality", async (t) => {
  const { request, calls } = await fixture(t);
  assert.equal((await request(`/schedule?municipalityId=${MUNICIPALITY}`)).status, 200);
  const created = await request("/schedule", { method: "POST", role: "analista", body: { date: "2027-01-01", vacancies: 10, municipalityId: OTHER_MUNICIPALITY } });
  assert.equal(created.status, 201); assert.equal(created.body.municipality_id, MUNICIPALITY);
  assert.equal(calls.find(({ sql }) => sql.includes("INSERT INTO schedule_days")).values[4], MUNICIPALITY);
});

test("availability HTTP returns aggregates and clamps tutor municipality without private request data", async (t) => {
  const { request, calls } = await fixture(t);
  const response = await request(`/schedule/availability?municipalityId=${OTHER_MUNICIPALITY}&from=2027-01-01&to=2027-01-01`, {role:"tutor"});
  assert.equal(response.status,200); assert.equal(Array.isArray(response.body.days),true);
  assert.equal(JSON.stringify(response.body).includes("PRIVATE_"),false);
  assert.equal(JSON.stringify(response.body).includes("municipality_id"),false);
  const reads = calls.filter(({sql})=>sql.includes("SELECT id, status, schedule_date, animals, workflow_data FROM requests"));
  assert.equal(reads.length,1); assert.equal(reads[0].values[0],MUNICIPALITY);
  assert.equal((await request(`/schedule/availability?municipalityId=${MUNICIPALITY}&from=invalid`)).status,400);
});
