import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import requestsRouter from "../src/routes/requests.js";
import { pool } from "../src/db/index.js";
import { CLOSED_WITHOUT_ATTENDANCE, ProcedureAction, ProcedureStatus, deriveRequestStatus, resolveRequestProcedures } from "../../shared/request-procedure-contract.js";
import { DocumentSequence, documentNumberYear } from "../../shared/document-number-contract.js";
import { allocateScheduleAvailability, buildScheduleOccurrences, requestScheduleBookings } from "../../shared/schedule-contract.js";
import { NO_SHOW_CANCEL_REASON } from "../../shared/notification-contract.js";
import { REQUEST_CONTACT_CPF_KEY } from "../../shared/request-contract.js";
import { decorateRequestDocuments } from "../src/services/documents/document-reviews.js";
import { canonicalDocumentDefinition } from "../src/services/documents/document-policy.js";
import { createReceivedDocument } from "../src/services/documents/request-documents.js";
import { deriveProcedureRequestState } from "../src/services/procedure-actions/procedure-request-state.js";
import { bookingChanged } from "../src/services/schedule/schedule-booking.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const DAY_ID = "77777777-7777-4777-8777-777777777777";
const STAFF = { id: "44444444-4444-4444-8444-444444444444", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const FUTURE_DATE = `01/01/${new Date().getFullYear() + 1}`;
const LATER_DATE = `02/01/${new Date().getFullYear() + 1}`;
const REQUEST_TYPES = [{ id: "castration", name: "Castração", active: true, documents: [] }, { id: "microchip", name: "Microchipagem", active: true, documents: [] }];
const clone = (value) => structuredClone(value);
const clientFetch = globalThis.fetch;

function twoAnimalRequest(overrides = {}) {
  return {
    id: REQUEST_ID, municipality_id: MUNICIPALITY_ID, status: "NOVA", origin: "INTERNA", request_type: "Castração, Microchipagem",
    schedule_date: FUTURE_DATE, schedule_location_name: "Local A", tags: [], documents: [], history: [], created_at: "2026-11-01T00:00:00Z",
    animals: [{ name: "Bidu", requestTypeIds: ["castration", "microchip"] }, { name: "Mel", requestTypeIds: ["castration", "microchip"] }],
    workflow_data: { followUp: { enabled: false }, scheduleOccurrenceKey: `day:${DAY_ID}`, scheduleSlotTime: "08:00" }, ...overrides,
  };
}

async function fixture(t, existing, { requiredDocument = false, requiredDocumentFor, vacancies = 10 } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = "procedure-route-tests-only";
  const sessions = new Map();
  const counters = { prescription: 0 };
  let row = clone(existing);
  const types = REQUEST_TYPES.map((type) => requiredDocument && (!requiredDocumentFor || requiredDocumentFor === type.id)
    ? { ...type, documents: [{ id: "identity", name: "Documento de identidade", required: true, active: true }] } : type);
  const configuration = new Map([["castragestao:request-types", types], ["castragestao:document-types", []]]);
  async function query(sql, values = []) {
    const session = resolveTestSession(sql, values, sessions);
    if (session) return session;
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("FROM municipalities m LEFT JOIN config")) return { rows: [...configuration].map(([key, value]) => ({ key, value: clone(value), municipality_id: values[0] })) };
    if (sql.includes("SELECT value FROM config")) return { rows: [{ value: clone(configuration.get(values[0])) }] };
    if (sql.startsWith("SELECT municipality_id FROM requests")) return { rows: row.id === values[0] ? [{ municipality_id: row.municipality_id }] : [] };
    if (sql.includes("SELECT * FROM schedule_days")) return { rows: [{ id: DAY_ID, date: FUTURE_DATE, active: true, slots: [{ time: "08:00", vacancies }] },
      { id: "88888888-8888-4888-8888-888888888888", date: LATER_DATE, active: true, slots: [{ time: "09:00", vacancies }] }] };
    if (sql.includes("SELECT id, status, schedule_date, animals, workflow_data FROM requests")) return { rows: [] };
    if (sql.includes("INSERT INTO document_counters")) {
      assert.deepEqual(values.slice(0, 2), [row.municipality_id, DocumentSequence.PRESCRIPTION]);
      counters.prescription += 1;
      return { rows: [{ seq: counters.prescription }] };
    }
    if (sql.startsWith("SELECT * FROM requests")) {
      const match = row.id === values[0] && (!sql.includes("municipality_id = $2") || row.municipality_id === values[1]);
      return { rows: match ? [clone(row)] : [] };
    }
    if (sql.startsWith("UPDATE requests SET")) {
      assert.equal(values[values.length - 1], row.municipality_id);
      for (const [, key, parameter] of sql.split(/\bWHERE\b/)[0].matchAll(/(\w+)\s*=\s*\$(\d+)/g)) {
        const value = values[Number(parameter) - 1];
        row[key] = ["workflow_data", "documents", "animals", "tags"].includes(key) ? JSON.parse(value) : value;
      }
      const history = sql.match(/history = (?:history|COALESCE\(history, '\[\]'::jsonb\)) \|\| \$(\d+)::jsonb/);
      if (history) row.history.push(...JSON.parse(values[Number(history[1]) - 1]));
      row.updated_at = new Date(Math.max(Date.now(), row.updated_at ? Date.parse(row.updated_at) + 1 : 0)).toISOString();
      return { rows: [clone(row)] };
    }
    throw new Error(`Unexpected test SQL: ${sql}`);
  }
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  globalThis.fetch = async () => { throw new Error("External transport is forbidden in route tests"); };
  const app = express();
  app.use(express.json());
  app.use("/requests", requestsRouter);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect; globalThis.fetch = previous.fetch;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  async function call(body, { user = STAFF, method = "POST", path = `/requests/${REQUEST_ID}/procedures/action` } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${registerTestSession(sessions, user)}` },
      body: JSON.stringify(method === "POST" ? { expectedUpdatedAt: row.updated_at || "", ...body } : body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }
  return { call, row: () => row, documentRows: () => decorateRequestDocuments(row, { requestTypes: types }).documents };
}

const statusesOf = (row) => row.animals.map((animal) => animal.procedures.map((procedure) => procedure.status));

test("a request is read as the procedures of its animals, with its own status and agenda; requests that are not procedures have none", () => {
  const scheduled = resolveRequestProcedures(twoAnimalRequest({ status: "AGENDADA" }), REQUEST_TYPES);
  assert.deepEqual(scheduled.map((animal) => animal.procedures.map((item) => [item.name, item.status, item.schedule.date])),
    [[["Castração", "AGENDADO", FUTURE_DATE], ["Microchipagem", "AGENDADO", FUTURE_DATE]], [["Castração", "AGENDADO", FUTURE_DATE], ["Microchipagem", "AGENDADO", FUTURE_DATE]]]);
  const noShow = resolveRequestProcedures(twoAnimalRequest({ status: "CANCELADA", workflow_data: { cancelReason: NO_SHOW_CANCEL_REASON } }), REQUEST_TYPES);
  assert.equal(noShow[0].procedures[0].status, ProcedureStatus.NO_SHOW);
  const single = resolveRequestProcedures({ status: "NOVA", request_type: "Castração", animals: [{ name: "Rex" }], workflow_data: { requestTypeId: "castration" } }, REQUEST_TYPES);
  assert.deepEqual(single[0].procedures, [], "a single type of the request is no procedure of the animal");
  assert.deepEqual(resolveRequestProcedures({ request_type: "Castração", animals: [] }, REQUEST_TYPES), []);
  assert.deepEqual(resolveRequestProcedures({ request_type: "ANIMAL_OBITO", animals: [{ name: "Rex" }] })[0].procedures, []);
});

test("the request status follows its procedures", () => {
  const animals = (...statuses) => [{ procedures: statuses.map((status) => ({ status })) }];
  assert.equal(deriveRequestStatus(animals("AGUARDANDO", "AGENDADO")).status, "AGENDADA");
  assert.equal(deriveRequestStatus(animals("AGUARDANDO", "REALIZADO")).status, "NOVA");
  assert.equal(deriveRequestStatus(animals("REALIZADO", "NAO_COMPARECEU")).status, "REALIZADA");
  assert.deepEqual(deriveRequestStatus(animals("NAO_COMPARECEU", "NAO_COMPARECEU")), { status: "CANCELADA", cancelReason: NO_SHOW_CANCEL_REASON });
  assert.deepEqual(deriveRequestStatus(animals("NAO_COMPARECEU", "INDEFERIDO")), { status: "CANCELADA", cancelReason: CLOSED_WITHOUT_ATTENDANCE });
  assert.equal(deriveRequestStatus([{ procedures: [] }]), null);
});

test("stored open procedures hold one place per animal at each date and time", () => {
  const schedule = (date, slotTime = "08:00") => ({ date, occurrenceKey: `day:${DAY_ID}`, slotTime });
  const request = { animals: [
    { procedures: [{ status: "AGENDADO", schedule: schedule(FUTURE_DATE) }, { status: "AGUARDANDO", schedule: schedule(FUTURE_DATE) }] },
    { procedures: [{ status: "AGENDADO", schedule: schedule(LATER_DATE) }, { status: "NAO_COMPARECEU", schedule: schedule(FUTURE_DATE) }] },
    { procedures: [{ status: "INDEFERIDO", schedule: schedule(FUTURE_DATE) }, { status: "REALIZADO", schedule: schedule(FUTURE_DATE) }] },
  ] };
  assert.deepEqual(requestScheduleBookings(request).map(({ date, count }) => [date, count]), [[FUTURE_DATE, 1], [LATER_DATE, 1]]);
  const days = buildScheduleOccurrences([{ id: DAY_ID, date: FUTURE_DATE, active: true, slots: [{ time: "08:00", vacancies: 3 }] }], [], "2000-01-01", "2200-01-01");
  assert.deepEqual(allocateScheduleAvailability(days, [request]).map((day) => day.remaining), [2]);
  assert.deepEqual(allocateScheduleAvailability(days, [twoAnimalRequest()]).map((day) => day.remaining), [1]);
  assert.deepEqual(allocateScheduleAvailability(days, [twoAnimalRequest({ status: "REALIZADA" })]).map((day) => day.remaining), [1]);
});

test("the nearest open procedure supplies the date, location, and time even while a later procedure is confirmed", () => {
  const procedure = (status, date, slotTime, locationName) => ({ status, schedule: { date, slotTime, locationName } });
  const animals = [{ procedures: [
    procedure(ProcedureStatus.DONE, FUTURE_DATE, "07:00", "Realizado"),
    procedure(ProcedureStatus.SCHEDULED, LATER_DATE, "08:00", "Dia seguinte"),
    procedure(ProcedureStatus.SCHEDULED, FUTURE_DATE, "10:00", "Confirmado"),
    procedure(ProcedureStatus.WAITING, FUTURE_DATE, "09:00", "Aguardando"),
  ] }];
  const state = deriveProcedureRequestState(twoAnimalRequest(), animals);
  assert.equal(state.status, "AGENDADA");
  assert.equal(state.schedule_date, FUTURE_DATE);
  assert.equal(state.schedule_location_name, "Aguardando");
  assert.equal(state.workflow.scheduleSlotTime, "09:00");
  assert.equal(bookingChanged({ animals, schedule_date: FUTURE_DATE }, {
    animals: [{ procedures: animals[0].procedures.slice(0, -1) }], schedule_date: FUTURE_DATE,
  }), true);
});

const target = (animalIndex, requestTypeId) => ({ animalIndex, requestTypeId });
const atFirst = { date: FUTURE_DATE, occurrenceKey: `day:${DAY_ID}`, time: "08:00" };
const atLater = { date: LATER_DATE, occurrenceKey: "day:88888888-8888-4888-8888-888888888888", time: "09:00" };
const confirm = { action: ProcedureAction.CONFIRM_SCHEDULE, data: { schedule: atFirst } };
const patch = { method: "PATCH", path: `/requests/${REQUEST_ID}` };
const close = { action: ProcedureAction.CLOSE };

test("all open procedures share one appointment, then results and closure are independently recorded", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest(), { vacancies: 2 });
  assert.equal((await call(confirm)).status, 200);
  assert.deepEqual(statusesOf(row()), [[ProcedureStatus.SCHEDULED, ProcedureStatus.SCHEDULED], [ProcedureStatus.SCHEDULED, ProcedureStatus.SCHEDULED]]);
  assert.equal(requestScheduleBookings(row())[0].count, 2);
  assert.equal((await call(confirm)).status, 409);
  const outcomes = await call({ action: ProcedureAction.SAVE, data: {
    results: [target(0, "castration"), target(0, "microchip"), target(1, "castration"), target(1, "microchip")],
    health: [{ animalIndex: 0, microchip: "abc1234", doencas: "Displasia" }, { animalIndex: 1, microchip: "xyz7890" }],
  } });
  assert.equal(outcomes.status, 200);
  assert.deepEqual(statusesOf(row()), [[ProcedureStatus.DONE, ProcedureStatus.DONE], [ProcedureStatus.DONE, ProcedureStatus.DONE]]);
  assert.equal(row().animals[0].confirmedMicrochip, "ABC1234");
  assert.equal(row().animals[1].confirmedMicrochip, "XYZ7890");
  assert.equal(row().status, "AGENDADA");
  assert.deepEqual(requestScheduleBookings(row()), []);
  assert.equal((await call(close)).status, 200);
  assert.equal(row().status, "REALIZADA");
  assert.equal(row().history.at(-1).title, "Conclusão positiva");
  assert.equal(row().history.at(-1).previousStatus, "AGENDADA");
  assert.equal((await call(close)).status, 409);
});

test("finishing can save the marked procedures in the same operation", async (t) => {
  const existing = twoAnimalRequest({ status: "AGENDADA", animals: [{ name: "Bidu", requestTypeIds: ["castration"] }] });
  const { call, row } = await fixture(t, existing);
  assert.equal((await call(close)).status, 409);
  assert.equal((await call({ ...close, data: { results: [target(0, "castration")] } })).status, 200);
  assert.equal(row().status, "REALIZADA");
  assert.equal(row().history.at(-1).title, "Conclusão positiva");
});

test("absence and removal conserve the booking until the animal has no open procedure", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA", animals: [{ name: "Bidu", requestTypeIds: ["castration", "microchip"] }] }));
  const absence = { action: ProcedureAction.NO_SHOW, data: { results: [target(0, "castration")] } };
  assert.equal((await call(absence)).status, 200);
  assert.equal(requestScheduleBookings(row())[0].count, 1);
  assert.equal((await call(absence)).status, 409);
  const remove = { action: ProcedureAction.REMOVE, data: { target: target(0, "microchip"), reason: "Tutor solicitou a retirada" } };
  assert.equal((await call({ ...remove, data: { ...remove.data, reason: "" } })).status, 400);
  assert.equal((await call(remove)).status, 200);
  assert.deepEqual(statusesOf(row()), [[ProcedureStatus.NO_SHOW, ProcedureStatus.REMOVED]]);
  assert.match(row().history.at(-1).notes, /Tutor solicitou a retirada/);
  assert.deepEqual(requestScheduleBookings(row()), []);
  assert.equal((await call(close)).status, 200);
  assert.equal(row().status, "CANCELADA");
  assert.equal(row().workflow_data.cancelReason, CLOSED_WITHOUT_ATTENDANCE);
  assert.equal(row().history.at(-1).title, CLOSED_WITHOUT_ATTENDANCE);
});

test("an invalid batch and a stale screen leave the saved operation intact", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ updated_at: "2026-11-01T00:00:00.000Z" }));
  const originalVersion = row().updated_at;
  assert.equal((await call(confirm)).status, 200);
  const saved = structuredClone(row());
  const batch = { action: ProcedureAction.SAVE, data: {
    results: [target(0, "castration"), target(1, "microchip")],
    health: [{ animalIndex: 0, doencas: "Displasia" }],
  } };
  assert.equal((await call(batch)).status, 400, "microchip is required for a completed microchip procedure");
  assert.deepEqual(row(), saved);
  assert.equal((await call({ ...batch, expectedUpdatedAt: originalVersion })).status, 409);
  assert.deepEqual(row(), saved);
  assert.equal((await call({ ...batch, data: { results: [target(0, "unknown")] } })).status, 404);
});

test("a group reschedule moves every open procedure and leaves the original request date", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA" }), { vacancies: 2 });
  const reschedule = { action: ProcedureAction.RESCHEDULE, data: { schedule: atLater, reason: "Pedido do tutor" } };
  assert.equal((await call(reschedule)).status, 200);
  assert.deepEqual(row().animals.flatMap((animal) => animal.procedures.map((item) => item.schedule.date)), Array(4).fill(LATER_DATE));
  assert.deepEqual(row().workflow_data.procedureScheduleDates, [LATER_DATE]);
  assert.equal(row().workflow_data.requestedSchedule.date, FUTURE_DATE);
  assert.equal(requestScheduleBookings(row())[0].count, 2);
  assert.match(row().history.at(-1).notes, /Pedido do tutor/);
  assert.equal((await call(reschedule)).status, 409);
});

test("too few places at the new time conserve the entire group appointment", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA" }), { vacancies: 1 });
  const saved = structuredClone(row());
  assert.equal((await call({ action: ProcedureAction.RESCHEDULE, data: { schedule: atLater } })).status, 409);
  assert.deepEqual(row(), saved);
});

test("document confirmation waits for the new approved version and requires a reason to reject", async (t) => {
  const { call, row, documentRows } = await fixture(t, twoAnimalRequest(), { requiredDocument: true });
  const dataUrl = (text) => `data:application/pdf;base64,${Buffer.from(`%PDF-1.4\n${text}\n`).toString("base64")}`;
  row().documents = [createReceivedDocument({ documentId: "identity", fileName: "identidade.pdf", dataUrl: dataUrl("old") },
    canonicalDocumentDefinition({ id: "identity", name: "Documento de identidade", required: true }),
    { requestId: REQUEST_ID, ownerUserId: null, municipalityId: MUNICIPALITY_ID, animalIds: [] })];
  const [{ attachmentId }] = documentRows();
  assert.equal((await call(confirm)).status, 409);
  assert.equal((await call({ documentReviews: [{ attachmentId, decision: "rejected" }] }, patch)).status, 400);
  assert.equal((await call({ documentReviews: [{ attachmentId, decision: "rejected", note: "  Envie uma foto legível. " }] }, patch)).status, 200);
  assert.equal(row().documents[0].review.note, "Envie uma foto legível.");
  assert.equal((await call(confirm)).status, 409);
  assert.equal((await call({ documentReviews: [{ attachmentId, decision: "approved" }] }, patch)).status, 409);
  assert.equal((await call({ documents: [{ documentId: "identity", fileName: "nova.pdf", dataUrl: dataUrl("new") }] }, patch)).status, 200);
  const [replacement] = documentRows();
  assert.notEqual(replacement.attachmentId, attachmentId);
  assert.equal((await call({ documentReviews: [{ attachmentId: replacement.attachmentId, decision: "approved" }] }, patch)).status, 200);
  assert.equal((await call(confirm)).status, 200);
});

test("a removed procedure no longer imposes its document requirements on the schedule", async (t) => {
  const existing = twoAnimalRequest({ animals: [{ name: "Bidu", requestTypeIds: ["castration", "microchip"] }] });
  const { call, row } = await fixture(t, existing, { requiredDocument: true, requiredDocumentFor: "castration" });
  assert.equal((await call(confirm)).status, 409);
  assert.equal((await call({ action: ProcedureAction.REMOVE, data: { target: target(0, "castration"), reason: "Tutor solicitou a retirada" } })).status, 200);
  assert.equal((await call(confirm)).status, 200);
  assert.deepEqual(statusesOf(row()), [[ProcedureStatus.REMOVED, ProcedureStatus.SCHEDULED]]);
});

test("a public request in a sector queue needs a named responsible person to confirm", async (t) => {
  const existing = twoAnimalRequest({ origin: "PUBLICA" });
  existing.workflow_data.assignedSectorId = "clinic";
  const { call } = await fixture(t, existing);
  assert.equal((await call(confirm)).status, 409);
  assert.equal((await call({ action: ProcedureAction.SAVE, data: { health: [{ animalIndex: 0, alergias: "Penicilina" }] } })).status, 200);
});

test("actions are restricted to staff of the municipality and supported operations", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest());
  assert.equal((await call(confirm, { user: { ...STAFF, id: "55555555-5555-4555-8555-555555555555", municipalityId: OTHER_MUNICIPALITY_ID } })).status, 404);
  assert.equal((await call(confirm, { user: { id: "66666666-6666-4666-8666-666666666666", role: "tutor", municipalityId: MUNICIPALITY_ID } })).status, 403);
  for (const action of ["delete", "reject", "cancel_schedule"]) assert.equal((await call({ ...confirm, action })).status, 400);
  assert.equal(row().status, "NOVA");
});

test("generic updates preserve saved clinical data and the original requested slot", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest());
  assert.equal((await call({ action: ProcedureAction.SAVE, data: { health: [{ animalIndex: 0, alergias: "Penicilina" }] } })).status, 200);
  const forged = row().animals.map((animal) => ({ ...animal, prescriptions: [{ text: "Forjada" }],
    procedures: animal.procedures.map((item) => ({ ...item, status: "REALIZADO" })) }));
  assert.equal((await call({ animals: forged, workflow_data: { requestedSchedule: atLater } }, patch)).status, 200);
  assert.deepEqual(statusesOf(row()), [[ProcedureStatus.WAITING, ProcedureStatus.WAITING], [ProcedureStatus.WAITING, ProcedureStatus.WAITING]]);
  assert.equal(row().workflow_data.requestedSchedule.date, FUTURE_DATE);
  assert.equal(row().animals[0].prescriptions, undefined);
  assert.equal((await call({ status: "CANCELADA" }, patch)).status, 409);
  for (const update of [{ scheduleLocationName: "Outro local" }, { workflow_data: { procedureScheduleDates: [LATER_DATE] } },
    { animals: [...row().animals].reverse() }, { animals: row().animals.map((animal) => ({ ...animal, requestTypeIds: ["microchip"] })) }]) {
    assert.equal((await call(update, patch)).status, 409);
  }
});

test("a procedure action keeps the contact CPF private", async (t) => {
  const request = twoAnimalRequest();
  request.workflow_data[REQUEST_CONTACT_CPF_KEY] = "52998224725";
  const { call, row } = await fixture(t, request);
  const response = await call({ action: ProcedureAction.SAVE, data: { health: [{ animalIndex: 0, alergias: "Penicilina" }] } });
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.body.workflow_data, REQUEST_CONTACT_CPF_KEY), false);
  assert.equal(row().workflow_data[REQUEST_CONTACT_CPF_KEY], request.workflow_data[REQUEST_CONTACT_CPF_KEY]);
});

test("a process without a municipality requires a municipal link before a global procedure action", async (t) => {
  const { call } = await fixture(t, twoAnimalRequest({ municipality_id: null }));
  const response = await call(confirm, { user: { ...STAFF, role: "master" } });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /prefeitura/);
});

test("unified recipes support general prescriptions, archive revisions and block repeated issuance", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA" }));
  const draft = { animalIndex: 1, requestTypeId: "", text: "Repouso conforme orientação.",
    professionalName: "Veterinária", professionalRegistry: "CRMV 1234" };
  const save = (values) => call({ action: ProcedureAction.PRESCRIPTION, data: { prescriptions: [values] } });
  const issued = await save(draft);
  assert.equal(issued.status, 200);
  assert.equal(issued.body.animals[1].prescriptions[0].number, `000001/${documentNumberYear()}`);
  assert.equal(issued.body.animals[1].prescriptions[0].requestTypeId, "");
  assert.equal((await save(draft)).status, 409);
  assert.equal((await save({ ...draft, text: "Revisão do repouso", requestTypeId: "castration" })).status, 200);
  assert.deepEqual(row().animals[1].prescriptions.map(({ number, archived, requestTypeId }) => [number, Boolean(archived), requestTypeId]), [
    [`000001/${documentNumberYear()}`, true, ""], [`000002/${documentNumberYear()}`, false, "castration"],
  ]);
  assert.equal((await save({ animalIndex: 1, text: "" })).status, 200);
  assert.equal(row().animals[1].prescriptions.every(({ archived }) => archived), true);
});
