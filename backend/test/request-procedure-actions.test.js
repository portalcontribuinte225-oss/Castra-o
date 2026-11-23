import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import requestsRouter from "../src/routes/requests.js";
import { pool } from "../src/db/index.js";
import { ProcedureAction, ProcedureStatus, deriveRequestStatus, resolveRequestProcedures } from "../../shared/request-procedure-contract.js";
import { DocumentSequence, documentNumberYear } from "../../shared/document-number-contract.js";
import { allocateScheduleAvailability, buildScheduleOccurrences, requestScheduleBookings } from "../../shared/schedule-contract.js";
import { NO_SHOW_CANCEL_REASON, REJECTED_CANCEL_REASON } from "../../shared/notification-contract.js";
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

async function fixture(t, existing, { requiredDocument = false, vacancies = 10 } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = "procedure-route-tests-only";
  const sessions = new Map();
  const counters = { prescription: 0 };
  let row = clone(existing);
  const types = requiredDocument ? REQUEST_TYPES.map((type) => ({ ...type, documents: [{ id: "identity", name: "Documento de identidade", required: true, active: true }] })) : REQUEST_TYPES;
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
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${registerTestSession(sessions, user)}` }, body: JSON.stringify(body),
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
  assert.deepEqual(deriveRequestStatus(animals("NAO_COMPARECEU", "INDEFERIDO")), { status: "CANCELADA", cancelReason: REJECTED_CANCEL_REASON });
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

test("an action changes only its procedure and the request status follows", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest());
  const confirmed = await call({ action: ProcedureAction.CONFIRM_SCHEDULE, animalIndex: 1, requestTypeId: "castration", data: { edits: { doencas: "Displasia" } } });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(statusesOf(row()), [["AGUARDANDO", "AGUARDANDO"], ["AGENDADO", "AGUARDANDO"]]);
  assert.equal(row().status, "AGENDADA");
  assert.equal(row().animals[1].doencas, "Displasia");
  assert.equal(row().animals[0].doencas, undefined);
  assert.equal(row().animals[0].procedures[0].name, undefined, "names are never stored");
  assert.match(row().history.at(-1).notes, /Castração de Mel: agenda confirmada/);
  assert.equal((await call({ action: ProcedureAction.SAVE, animalIndex: 1, requestTypeId: "castration", data: { edits: { microchip: "ABC1234" } } })).status, 400);

  assert.equal((await call({ action: ProcedureAction.ATTEND, animalIndex: 0, requestTypeId: "castration" })).status, 409);
  await call({ action: ProcedureAction.CONFIRM_SCHEDULE, animalIndex: 1, requestTypeId: "microchip" });
  assert.equal((await call({ action: ProcedureAction.ATTEND, animalIndex: 1, requestTypeId: "microchip" })).status, 400);
  const attended = await call({ action: ProcedureAction.ATTEND, animalIndex: 1, requestTypeId: "microchip", data: { edits: { microchip: "abc1234" } } });
  assert.equal(attended.status, 200);
  assert.equal(row().animals[1].confirmedMicrochip, "ABC1234");
  assert.deepEqual(statusesOf(row()), [["AGUARDANDO", "AGUARDANDO"], ["AGENDADO", "REALIZADO"]]);

  assert.equal((await call({ action: ProcedureAction.REJECT, animalIndex: 0, requestTypeId: "castration", data: { reason: "Animal inelegível" } })).status, 400);
  for (const [animalIndex, requestTypeId] of [[0, "castration"], [0, "microchip"]]) {
    await call({ action: ProcedureAction.REJECT, animalIndex, requestTypeId, data: { reason: "Animal inelegível", note: "Animal idoso." } });
  }
  await call({ action: ProcedureAction.NO_SHOW, animalIndex: 1, requestTypeId: "castration" });
  assert.equal(row().status, "REALIZADA");
  assert.equal(row().workflow_data.performedProcedures, "Microchipagem");
});

test("rejecting every procedure cancels the request with the reason of the last rejection", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ animals: [{ name: "Bidu", requestTypeIds: ["castration"] }] }));
  await call({ action: ProcedureAction.REJECT, animalIndex: 0, requestTypeId: "castration", data: { reason: "Animal inelegível", note: "Animal idoso." } });
  assert.equal(row().status, "CANCELADA");
  assert.equal(row().workflow_data.cancelReason, REJECTED_CANCEL_REASON);
  assert.equal(row().workflow_data.rejectionReason, "Animal inelegível");
});

test("scheduling waits for the required documents", async (t) => {
  const documents = await fixture(t, twoAnimalRequest(), { requiredDocument: true });
  const blocked = await documents.call({ action: ProcedureAction.CONFIRM_SCHEDULE, animalIndex: 0, requestTypeId: "castration" });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /Documento de identidade/);
  assert.equal(documents.row().animals[0].procedures, undefined);
});

test("a document adjustment requires a note, and the schedule is unblocked when the document is approved", async (t) => {
  const dataUrl = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\ntest document\n").toString("base64")}`;
  const { call, row, documentRows } = await fixture(t, twoAnimalRequest(), { requiredDocument: true });
  // Signed after the fixture sets the secret, as the server signs what it receives.
  row().documents = [createReceivedDocument({ documentId: "identity", fileName: "identidade.pdf", dataUrl },
    canonicalDocumentDefinition({ id: "identity", name: "Documento de identidade", required: true }),
    { requestId: REQUEST_ID, ownerUserId: null, municipalityId: MUNICIPALITY_ID, animalIds: [] })];
  const [{ attachmentId }] = documentRows();
  const action = { action: ProcedureAction.CONFIRM_SCHEDULE, animalIndex: 0, requestTypeId: "castration" };
  const patch = { method: "PATCH", path: `/requests/${REQUEST_ID}` };
  assert.equal((await call(action)).status, 409);
  assert.equal((await call({ documentReviews: [{ attachmentId, decision: "rejected" }] }, patch)).status, 400);
  assert.equal((await call({ documentReviews: [{ attachmentId, decision: "rejected", note: "  Envie uma foto legível. " }] }, patch)).status, 200);
  assert.equal(row().documents[0].review.note, "Envie uma foto legível.");
  assert.equal((await call(action)).status, 409);
  assert.equal((await call({ documentReviews: [{ attachmentId, decision: "approved" }] }, patch)).status, 200);
  assert.equal((await call(action)).status, 200);
});

test("a public request needs an assignment before confirming", async (t) => {
  const { call } = await fixture(t, twoAnimalRequest({ origin: "PUBLICA" }));
  assert.equal((await call({ action: ProcedureAction.CONFIRM_SCHEDULE, animalIndex: 0, requestTypeId: "castration" })).status, 409);
  assert.equal((await call({ action: ProcedureAction.SAVE, animalIndex: 0, requestTypeId: "castration", data: { edits: { alergias: "Penicilina" } } })).status, 200);
});

test("another municipality, a tutor and an invalid action cannot change a procedure", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest());
  const body = { action: ProcedureAction.CONFIRM_SCHEDULE, animalIndex: 0, requestTypeId: "castration" };
  assert.equal((await call(body, { user: { ...STAFF, id: "55555555-5555-4555-8555-555555555555", municipalityId: OTHER_MUNICIPALITY_ID } })).status, 404);
  assert.equal((await call(body, { user: { id: "66666666-6666-4666-8666-666666666666", role: "tutor", municipalityId: MUNICIPALITY_ID } })).status, 403);
  assert.equal((await call({ ...body, action: "delete" })).status, 400);
  assert.equal((await call({ ...body, requestTypeId: "unknown" })).status, 404);
  assert.equal(row().status, "NOVA");
});

test("rescheduling moves only its procedure to a place with vacancy", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest(), { vacancies: 1 });
  const moved = await call({ action: ProcedureAction.RESCHEDULE, animalIndex: 0, requestTypeId: "microchip",
    data: { schedule: { date: LATER_DATE, occurrenceKey: "day:88888888-8888-4888-8888-888888888888", time: "09:00" }, reason: "Pedido do tutor" } });
  assert.equal(moved.status, 200);
  assert.deepEqual(row().animals[0].procedures.map((item) => item.schedule.date), [FUTURE_DATE, LATER_DATE]);
  assert.deepEqual(row().animals[1].procedures.map((item) => item.schedule.date), [FUTURE_DATE, FUTURE_DATE]);
  assert.deepEqual(row().workflow_data.procedureScheduleDates, [FUTURE_DATE, LATER_DATE]);
  assert.deepEqual(row().tags, ["REAGENDADA"]);
  const full = await call({ action: ProcedureAction.RESCHEDULE, animalIndex: 1, requestTypeId: "microchip",
    data: { schedule: { date: LATER_DATE, occurrenceKey: "day:88888888-8888-4888-8888-888888888888", time: "09:00" } } });
  assert.equal(full.status, 409);
  const shared = await call({ action: ProcedureAction.RESCHEDULE, animalIndex: 0, requestTypeId: "castration",
    data: { schedule: { date: LATER_DATE, occurrenceKey: "day:88888888-8888-4888-8888-888888888888", time: "09:00" } } });
  assert.equal(shared.status, 200);
  assert.equal(requestScheduleBookings(row()).find((booking) => booking.date === LATER_DATE).count, 1);
});

test("once stored, the generic PATCH keeps the procedures and cannot change the status or the agenda", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest());
  await call({ action: ProcedureAction.SAVE, animalIndex: 0, requestTypeId: "castration" });
  const forged = row().animals.map((animal) => ({ ...animal, procedures: animal.procedures.map((item) => ({ ...item, status: "REALIZADO" })) }));
  const patched = await call({ animals: forged }, { method: "PATCH", path: `/requests/${REQUEST_ID}` });
  assert.equal(patched.status, 200);
  assert.deepEqual(statusesOf(row()), [["AGUARDANDO", "AGUARDANDO"], ["AGUARDANDO", "AGUARDANDO"]]);
  assert.equal((await call({ status: "CANCELADA" }, { method: "PATCH", path: `/requests/${REQUEST_ID}` })).status, 409);
  for (const body of [{ scheduleLocationName: "Outro local" }, { workflow_data: { procedureScheduleDates: [LATER_DATE] } },
    { animals: [...row().animals].reverse() }, { animals: row().animals.map((animal) => ({ ...animal, requestTypeIds: ["microchip"] })) }]) {
    assert.equal((await call(body, { method: "PATCH", path: `/requests/${REQUEST_ID}` })).status, 409);
  }
  assert.equal(row().status, "NOVA");
});

test("a procedure action keeps the contact CPF in storage and omits it from the response", async (t) => {
  const request = twoAnimalRequest();
  request.workflow_data[REQUEST_CONTACT_CPF_KEY] = "52998224725";
  const { call, row } = await fixture(t, request);
  const response = await call({ action: ProcedureAction.SAVE, animalIndex: 0, requestTypeId: "castration" });
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.body.workflow_data, REQUEST_CONTACT_CPF_KEY), false);
  assert.equal(row().workflow_data[REQUEST_CONTACT_CPF_KEY], request.workflow_data[REQUEST_CONTACT_CPF_KEY]);
});

test("cancelling releases only the places no procedure uses and a new slot is required before confirming", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA", animals: [{ name: "Bidu", requestTypeIds: ["castration", "microchip"] }] }), { vacancies: 1 });
  const schedule = { date: FUTURE_DATE, occurrenceKey: `day:${DAY_ID}`, time: "08:00" };
  const cancel = (requestTypeId, selection = schedule) => call({
    action: ProcedureAction.CANCEL_SCHEDULE, animalIndex: 0, requestTypeId, data: { schedule: selection },
  });
  const castration = { animalIndex: 0, requestTypeId: "castration" };
  assert.equal((await cancel("castration", { ...schedule, time: "09:00" })).status, 409);
  assert.equal(requestScheduleBookings(row())[0].count, 1);
  assert.equal((await cancel("castration")).status, 200);
  assert.equal((await cancel("castration")).status, 409);
  assert.deepEqual(statusesOf(row()), [[ProcedureStatus.WAITING, ProcedureStatus.SCHEDULED]]);
  assert.equal(row().animals[0].procedures[0].schedule, null);
  assert.equal(row().history.at(-1).cancelledSchedule.slotTime, "08:00");
  assert.match(row().history.at(-1).notes, /08:00.*Local A.*cancelado/);
  assert.equal(requestScheduleBookings(row())[0].count, 1);
  assert.equal(row().status, "AGENDADA");
  assert.equal((await cancel("microchip")).status, 200);
  assert.deepEqual(requestScheduleBookings(row()), []);
  assert.equal(row().schedule_date, null);
  assert.equal(row().status, "NOVA");
  assert.equal((await call({ ...castration, action: ProcedureAction.CONFIRM_SCHEDULE })).status, 409);
  assert.equal((await call({ ...castration, action: ProcedureAction.RESCHEDULE, data: { schedule } })).status, 200);
  assert.equal((await call({ ...castration, action: ProcedureAction.CONFIRM_SCHEDULE })).status, 200);
  assert.equal((await cancel("castration")).status, 409, "the former confirmation cannot cancel a new reservation of the same slot");
  assert.equal(requestScheduleBookings(row())[0].count, 1);
});

test("an old scheduled visit without an occurrence or time can be cancelled with the matching date", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({
    status: "AGENDADA", request_type: "Castração", animals: [{ name: "Bidu", requestTypeIds: ["castration"] }], workflow_data: { followUp: { enabled: false } },
  }));
  const action = { action: ProcedureAction.CANCEL_SCHEDULE, animalIndex: 0, requestTypeId: "castration" };
  const cancel = (schedule) => call({ ...action, data: { schedule } });
  assert.equal((await cancel({ date: FUTURE_DATE, occurrenceKey: "", time: "08:00" })).status, 409);
  assert.equal((await cancel({ date: LATER_DATE, occurrenceKey: "", time: "" })).status, 409);
  assert.equal((await cancel({ date: FUTURE_DATE, occurrenceKey: "", time: "" })).status, 200);
  assert.deepEqual(requestScheduleBookings(row()), []);
  assert.equal(row().history.at(-1).cancelledSchedule.date, FUTURE_DATE);
  assert.equal(row().status, "NOVA");
});

test("a cancellation confirmation from before a reschedule cannot remove the new reservation", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA" }));
  const target = { animalIndex: 0, requestTypeId: "castration" };
  const schedule = { date: LATER_DATE, occurrenceKey: "day:88888888-8888-4888-8888-888888888888", time: "09:00" };
  const cancellation = { ...target, action: ProcedureAction.CANCEL_SCHEDULE, data: { schedule: { date: FUTURE_DATE, occurrenceKey: `day:${DAY_ID}`, time: "08:00" } } };
  assert.equal((await call({ ...target, action: ProcedureAction.RESCHEDULE, data: { schedule } })).status, 200);
  assert.equal((await call(cancellation)).status, 409);
  assert.equal(row().animals[0].procedures[0].schedule.slotTime, "09:00");
  assert.equal(row().history.length, 1);
});

test("a process without a municipality requires a municipal link before a global procedure action", async (t) => {
  const { call } = await fixture(t, twoAnimalRequest({ municipality_id: null }));
  const response = await call({ action: ProcedureAction.SAVE, animalIndex: 0, requestTypeId: "castration" }, { user: { ...STAFF, role: "master" } });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /prefeitura/);
});

test("a prescription stays on its procedure and is read-only after the attendance", async (t) => {
  const { call, row } = await fixture(t, twoAnimalRequest({ status: "AGENDADA" }));
  const selection = { animalIndex: 1, requestTypeId: "castration" };
  const payload = { ...selection, action: ProcedureAction.PRESCRIPTION,
    data: { prescription: { text: "Repouso conforme orientação.", professionalName: "Veterinária", professionalRegistry: "CRMV 1234" } } };
  const saved = await call(payload);
  assert.equal(saved.status, 200);
  assert.equal(row().animals[1].procedures[0].prescription.professionalRegistry, "CRMV 1234");
  assert.equal(row().animals[1].procedures[0].prescription.number, `000001/${documentNumberYear()}`);
  assert.equal(saved.body.animals[1].procedures[0].prescription.number, `000001/${documentNumberYear()}`, "the answer carries the number given");
  assert.equal(row().animals[1].procedures[1].prescription, null);
  assert.equal(row().status, "AGENDADA");
  assert.equal((await call(payload)).status, 200);
  assert.equal(row().animals[1].procedures[0].prescription.number, `000002/${documentNumberYear()}`, "saving again issues a new prescription");
  assert.equal((await call({ ...selection, action: ProcedureAction.ATTEND })).status, 200);
  assert.equal((await call(payload)).status, 409);
});
