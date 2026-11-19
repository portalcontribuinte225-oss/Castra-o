import test from "node:test";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import requestsRouter from "../src/routes/requests.js";
import { pool } from "../src/db/index.js";
import { NotificationEvent } from "../../shared/notification-contract.js";
import { AnimalTutorship } from "../../shared/request-tutorship-contract.js";
import { EMAIL_ACTIVE_USES_CONFIG_KEY } from "../../shared/email-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";
import { assertInsertShape } from "./fixtures/insert-shape.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN = { id: "44444444-4444-4444-8444-444444444444", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const SECRET = "request-route-tests-only";
const VALID_CPF = "52998224725";
const FUTURE_DATE = `01/01/${new Date().getFullYear() + 1}`;
const clientFetch = globalThis.fetch;
const clone = (value) => structuredClone(value);

function procedureBody(overrides = {}) {
  return {
    municipalityId: MUNICIPALITY_ID, requestTypeId: "castration", type: "Castração", declarationAccepted: true,
    // The agenda is a fixed step: a public procedure always comes with the date it chose.
    preferredSchedule: FUTURE_DATE,
    animals: [{ species: "Cão", sex: "Macho", size: "Pequeno", breedType: "Indefinida" }],
    workflow_data: { tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false } }, ...overrides,
  };
}

async function fixture(t, { existing, failHistory = false, failChannelLookup = false, failRequestInsert = false, requiredDocument = false, registeredNotice = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = SECRET;
  const stats = { calls: [], channelReads: 0, historyAppends: 0, transports: 0 };
  const sessionUsers = new Map();
  let requestRow = existing ? clone(existing) : null;
  const configuration = new Map([
    ["castragestao:request-types", [{ id: "castration", name: "Castração", active: true, documents: requiredDocument ? [{ id: "identity", name: "Documento de identidade", required: true, active: true }] : [] },
      { id: "microchip", name: "Microchipagem", active: true, documents: [] }]],
    ["castragestao:document-types", requiredDocument ? [{ id: "identity", name: "Documento de identidade", required: true, active: true }] : []],
    // The municipality turned the confirmation e-mail on, but the platform has no account yet: a confirmed notice is reported
    // as not configured, which leaves a result and a history entry without any transport.
    [EMAIL_ACTIVE_USES_CONFIG_KEY, { active: { [NotificationEvent.SCHEDULE_CONFIRMED]: true, ...(registeredNotice ? { [NotificationEvent.REQUEST_REGISTERED]: true } : {}) } }],
    ["whatsapp", { active: false }],
  ]);
  const lockTails = new Map();
  function acquireLock(key = "request-row") {
    let unlock;
    const held = new Promise((resolve) => { unlock = resolve; });
    const previousLock = lockTails.get(key) || Promise.resolve();
    lockTails.set(key, previousLock.then(() => held));
    return previousLock.then(() => unlock);
  }
  function connection(source) {
    const unlocks = [];
    const heldKeys = new Set();
    return {
      async query(sql, values = []) {
        const session = resolveTestSession(sql, values, sessionUsers);
        if (session) return session;
        stats.calls.push({ sql, values, source });
        if (sql === "BEGIN") return { rows: [] };
        if (sql === "COMMIT" || sql === "ROLLBACK") {
          unlocks.reverse().forEach((unlock) => unlock()); unlocks.length = 0; heldKeys.clear();
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO auth_rate_limits")) return { rows: [{ attempts: 1 }] };
        if (sql.includes("DELETE FROM auth_rate_limits")) return { rows: [] };
        if (sql.includes("pg_advisory_xact_lock")) { if (!heldKeys.has(values[0])) { unlocks.push(await acquireLock(values[0])); heldKeys.add(values[0]); } return { rows: [] }; }
        if (sql.startsWith("SELECT cpf FROM tutor_profiles")) {
          const user = sessionUsers.get(values[0]);
          return { rows: user?.municipality_id === values[1] && user.cpf ? [{ cpf: user.cpf }] : [] };
        }
        if (sql.includes("FROM municipalities m LEFT JOIN config")) {
          return { rows: [...configuration].map(([key, value]) => ({ key, value: clone(value), municipality_id: values[0] })) };
        }
        if (sql.includes("SELECT value FROM config")) {
          // The notification channels read their settings through the pool, after the request was committed.
          if (source === "pool") {
            stats.channelReads += 1;
            if (failChannelLookup) throw new Error("Simulated config lookup failure");
          }
          return { rows: [{ value: clone(configuration.get(values[0])) }] };
        }
        if (sql.includes("INSERT INTO animals")) return { rows: [{
          id: crypto.randomUUID(), microchip: null, name: values[0], species: values[1], sex: values[2], size: values[3],
          breed: values[4], color: values[5], birth_date: values[6], metadata: JSON.parse(values[7]), status: "ATIVO",
        }] };
        if (sql.includes("INSERT INTO animal_tutors") || sql.includes("INSERT INTO animal_records")) return { rows: [] };
        if (sql.startsWith("SELECT municipality_id FROM requests")) return { rows: requestRow?.id === values[0] ? [{ municipality_id: requestRow.municipality_id }] : [] };
        if (sql.includes("SELECT * FROM schedule_days")) return { rows: [{ id: "77777777-7777-4777-8777-777777777777", date: FUTURE_DATE, active: true, slots: [{time:"08:00",vacancies:10}] }] };
        if (sql.includes("SELECT id, status, schedule_date, animals, workflow_data FROM requests")) return { rows: requestRow ? [clone(requestRow)] : [] };
        if (sql.includes("INSERT INTO request_protocol_counters")) return { rows: [{ seq: 1 }] };
        if (sql.includes("INSERT INTO requests")) {
          if (failRequestInsert) throw new Error("Simulated request write failure");
          assertInsertShape(sql, values);
          requestRow = {
            id: values[37] || REQUEST_ID, tutor_id: values[0], protocol: values[1],
            tutor_name: values[2], tutor_email: values[3], cpf: values[4], phone: values[5],
            animals: JSON.parse(values[16]), request_type: values[17], municipality_id: values[19],
            schedule_date: values[21], documents: JSON.parse(values[30]), tags: JSON.parse(values[31]),
            workflow_data: JSON.parse(values[32]), origin: values[35], status: "NOVA", history: [],
          };
          return { rows: [clone(requestRow)] };
        }
        if (sql.startsWith("SELECT * FROM requests")) {
          if (sql.includes("WHERE tutor_id = $1")) {
            assert.match(sql, /AND municipality_id = \$2/);
            return { rows: requestRow?.tutor_id === values[0] && requestRow?.municipality_id === values[1] ? [clone(requestRow)] : [] };
          }
          if (sql.includes("FOR UPDATE")) unlocks.push(await acquireLock());
          const match = requestRow?.id === values[0] && (!sql.includes("municipality_id = $2") || requestRow.municipality_id === values[1]);
          const selected = match ? clone(requestRow) : null;
          await new Promise((resolve) => setImmediate(resolve));
          return { rows: selected ? [selected] : [] };
        }
        if (sql.startsWith("UPDATE requests SET history = COALESCE")) {
          stats.historyAppends += 1;
          if (failHistory) throw new Error("Simulated history failure");
          assert.equal(values[1], requestRow.id);
          assert.equal(values[2], requestRow.municipality_id);
          requestRow.history.push(...JSON.parse(values[0]));
          return { rows: [] };
        }
        if (sql.startsWith("UPDATE requests SET")) {
          const idIndex = Number(sql.match(/WHERE id\s*=\s*\$(\d+)/)[1]) - 1;
          const scope = sql.match(/AND municipality_id\s*=\s*\$(\d+)/);
          assert.equal(values[idIndex], requestRow.id);
          if (scope) assert.equal(values[Number(scope[1]) - 1], requestRow.municipality_id);
          for (const [, key, parameter] of sql.split(/\bWHERE\b/)[0].matchAll(/(\w+)\s*=\s*\$(\d+)/g)) {
            const value = values[Number(parameter) - 1];
            requestRow[key] = ["workflow_data", "documents", "animals", "tags"].includes(key) ? JSON.parse(value) : value;
          }
          const history = sql.match(/history = (?:history|COALESCE\(history, '\[\]'::jsonb\)) \|\| \$(\d+)::jsonb/);
          if (history) requestRow.history.push(...JSON.parse(values[Number(history[1]) - 1]));
          return { rows: [clone(requestRow)] };
        }
        throw new Error(`Unexpected test SQL: ${sql}`);
      },
      release() { assert.equal(unlocks.length, 0, "Transaction lock must be released before returning connection"); },
    };
  }
  pool.query = connection("pool").query;
  pool.connect = async () => connection("client");
  globalThis.fetch = async () => { stats.transports += 1; throw new Error("External transport is forbidden in route tests"); };
  const app = express();
  app.use(express.json());
  app.use("/requests", requestsRouter);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect; globalThis.fetch = previous.fetch;
    if (previous.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.secret;
    assert.equal(stats.transports, 0, "No provider network calls are allowed");
  });
  async function request({ method = "POST", body, user, path = "/requests" } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${registerTestSession(sessionUsers, user)}` } : {}) }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null), cacheControl: response.headers.get("cache-control") };
  }
  return { request, stats, row: () => requestRow };
}

// The registered notice goes after the answer; a test that expects it waits for it here.
async function until(condition) {
  for (let attempt = 0; attempt < 200 && !condition(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(condition(), "the background notice did not finish");
}

function pendingRequest(followUp = { enabled: false, email: "", phone: "" }) {
  return { id: REQUEST_ID, municipality_id: MUNICIPALITY_ID, status: "NOVA", tags: [], documents: [], history: [], workflow_data: { followUp } };
}

test("public POST rejects omitted preference and CPF required by configured Tutor step", async (t) => {
  const { request, row } = await fixture(t);
  const missingPreference = await request({ body: procedureBody({ workflow_data: { tutorship: AnimalTutorship.WITHOUT_TUTOR } }) });
  assert.equal(missingPreference.status, 400);
  const missingCpf = await request({ body: procedureBody({ workflow_data: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false } } }) });
  assert.equal(missingCpf.status, 400);
  assert.equal(row(), null);
});

test("configured no-Tutor POST saves without CPF and without any validation key", async (t) => {
  const { request, stats, row } = await fixture(t);
  const response = await request({ body: procedureBody() });
  assert.equal(response.status, 201);
  assert.equal(row().cpf, null);
  assert.equal(stats.calls.some(({ sql }) => sql.includes("validation_key")), false);
  assert.equal(row().origin, "PUBLICA");
  assert.equal(response.body.request.id, row().id);
  assert.deepEqual(Object.keys(response.body), ["request"]);
});

test("legacy validation-key consultation routes no longer exist", async (t) => {
  const { request, stats } = await fixture(t);
  const legacyKey = "ABCD-EFGH-JKLM";
  assert.equal((await request({ method: "GET", path: `/requests/public/${legacyKey}?municipalityId=${MUNICIPALITY_ID}` })).status, 404);
  assert.equal((await request({ method: "POST", path: "/requests/consult", body: { cpf: VALID_CPF, validationKey: legacyKey, municipalityId: MUNICIPALITY_ID } })).status, 404);
  assert.equal(stats.calls.length, 0);
});

test("forged origin, skipTutor and stepTutor flags cannot dispense CPF", async (t) => {
  const { request, row } = await fixture(t);
  const response = await request({ body: procedureBody({
    origin: "INTERNA", skipTutor: true, stepTutor: false,
    workflow_data: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false }, skipTutor: true },
  }) });
  assert.equal(response.status, 400);
  assert.equal(row(), null);
});

test("unknown request types and authenticated tutor identity cannot use no-Tutor CPF exemption", async (t) => {
  const { request, row } = await fixture(t);
  assert.equal((await request({ body: procedureBody({ requestTypeId: undefined, type: "unknown" }) })).status, 400);
  assert.equal((await request({ user: { ...ADMIN, role: "tutor" }, body: procedureBody() })).status, 400);
  assert.equal((await request({ body: procedureBody({ cpf: "invalid" }) })).status, 400);
  assert.equal(row(), null);
});

test("explicit refusal is persisted independently from cadastral contact and strips forged delivery metadata", async (t) => {
  const { request, row } = await fixture(t);
  const response = await request({ body: procedureBody({ tutor_email: "registered@example.test", workflow_data: {
    tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false, email: "stale@example.test", phone: "48999991234" },
    notificationResults: [{ status: "sent" }], notificationDispatches: { fake: true },
  } }) });
  assert.equal(response.status, 201);
  assert.deepEqual(row().workflow_data.followUp, { enabled: false, email: "", phone: "" });
  assert.equal(row().tutor_email, "registered@example.test");
  assert.equal(row().workflow_data.notificationResults, undefined);
  assert.equal(row().workflow_data.notificationDispatches, undefined);
});

test("municipal POST cannot override the authenticated municipality", async (t) => {
  const { request, stats, row } = await fixture(t);
  assert.equal((await request({ user: ADMIN, body: procedureBody({ municipalityId: OTHER_MUNICIPALITY_ID, cpf: VALID_CPF, preferredSchedule: FUTURE_DATE }) })).status, 201);
  assert.equal(row().municipality_id, MUNICIPALITY_ID);
  assert.equal(stats.calls.find(({ sql }) => sql.includes("FROM municipalities m")).values[0], MUNICIPALITY_ID);
  assert.equal(row().tutor_id, null, "An attendant is not the tutor owner");
});

test("a public request with a tutor creates no account nor password, and the answer carries only the request", async (t) => {
  const { request, row, stats } = await fixture(t);
  const response = await request({ body: procedureBody({ cpf: VALID_CPF, phone: "(48) 99999-1234", tutor_name: "Tutor Example", workflow_data: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false } } }) });
  assert.equal(response.status, 201);
  assert.equal(response.cacheControl, "no-store");
  assert.deepEqual(Object.keys(response.body), ["request"]);
  assert.equal(row().cpf, VALID_CPF);
  assert.equal(row().tutor_id, null);
  assert.equal(stats.calls.some(({ sql }) => sql.includes("INSERT INTO users") || sql.includes("tutor_profiles")), false);
  assert.equal(stats.calls.some(({ sql, values }) => sql.includes("pg_advisory_xact_lock") && !String(values[0]).startsWith("schedule:")), false);
});

test("the registered notice goes after the answer to whoever accepted the notices, and is kept in the history", async (t) => {
  const { request, row } = await fixture(t, { registeredNotice: true });
  const response = await request({ body: procedureBody({ workflow_data: { tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: true, email: "tutor@example.test", phone: "" } } }) });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body.request.history, [], "the answer does not wait for the notice");
  await until(() => row().history.length > 0);
  assert.deepEqual(row().history.map(({ notification }) => [notification.event, notification.channel, notification.status, notification.code]),
    [[NotificationEvent.REQUEST_REGISTERED, "email", "skipped", "not_configured"]]);
  assert.match(row().history[0].notes, /^Solicitação registrada — E-mail: não enviado\./);
});

test("without the notices accepted the registered notice reads no channel and leaves no history", async (t) => {
  const { request, row, stats } = await fixture(t, { registeredNotice: true });
  assert.equal((await request({ body: procedureBody() })).status, 201);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(stats.channelReads, 0);
  assert.deepEqual(row().history, []);
});

test("a failed request insert rolls back and answers a generic error", async (t) => {
  const { request, stats } = await fixture(t, { failRequestInsert: true });
  const response = await request({ body: procedureBody({ cpf: VALID_CPF, phone: "(48) 99999-1234", tutor_name: "Tutor Example", workflow_data: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false } } }) });
  assert.equal(response.status, 500);
  assert.equal(response.body.error, "Não foi possível salvar a solicitação.");
  assert.equal(stats.calls.at(-1).sql, "ROLLBACK");
});

test("authenticated tutor cannot submit a different CPF or delete requests", async (t) => {
  const { request } = await fixture(t);
  const user = { ...ADMIN, role: "tutor" };
  const response = await request({ user, body: procedureBody({ cpf: "16899535009", phone: "(48) 99999-4321", tutor_name: "Another Tutor" }) });
  assert.equal(response.status, 403);
  assert.equal((await request({ user, method: "DELETE", path: `/requests/${REQUEST_ID}` })).status, 403);
});

test("tutor request reads require authenticated owner and municipality", async (t) => {
  const existing = { ...pendingRequest(), tutor_id: ADMIN.id };
  const { request } = await fixture(t, { existing });
  const response = await request({ user: { ...ADMIN, role: "tutor" }, method: "GET" });
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
});

test("tutor cannot use operational PATCH to trigger notifications", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest() });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: { ...ADMIN, role: "tutor" }, body: { status: "AGENDADA" } });
  assert.equal(response.status, 403);
  assert.equal(stats.calls.length, 0);
  assert.equal(row().status, "NOVA");
});

test("operational PATCH cannot select a request from a different municipality", async (t) => {
  const { request, row, stats } = await fixture(t, { existing: { ...pendingRequest(), municipality_id: OTHER_MUNICIPALITY_ID } });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA", municipalityId: OTHER_MUNICIPALITY_ID } });
  assert.equal(response.status, 404);
  assert.equal(row().status, "NOVA");
  assert.equal(stats.calls.some(({ sql }) => sql === "ROLLBACK"), true);
});

test("generic PATCH preserves refusal and server delivery metadata while applying operational changes", async (t) => {
  const existing = pendingRequest();
  existing.workflow_data.notificationDispatches = { previous: true };
  const { request, row, stats } = await fixture(t, { existing });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA", workflow_data: {
    followUp: { enabled: true, email: "attacker@example.test" }, notificationDispatches: { forged: true },
    notificationResults: [{ status: "sent" }], assignedUserId: ADMIN.id,
  } } });
  assert.equal(response.status, 200);
  assert.deepEqual(row().workflow_data.followUp, existing.workflow_data.followUp);
  assert.deepEqual(row().workflow_data.notificationDispatches, { previous: true });
  assert.equal(row().workflow_data.notificationResults, undefined);
  assert.equal(row().workflow_data.assignedUserId, ADMIN.id);
  assert.deepEqual(response.body.notificationResults, []);
  assert.equal(stats.channelReads, 0, "A refused follow-up reads no channel setting");
});

test("concurrent identical PATCHes serialize snapshots and produce only one notification transition after commit", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }) });
  const responses = await Promise.all([1, 2].map(() => request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } })));
  assert.equal(responses.every(({ status }) => status === 200), true);
  assert.deepEqual(responses.map(({ body }) => body.notificationResults.length).sort(), [0, 1]);
  assert.equal(stats.historyAppends, 1);
  assert.equal(row().history.length, 1);
  assert.equal(stats.calls.filter(({ sql }) => sql.includes("FOR UPDATE")).length, 2);
  const firstNotificationRead = stats.calls.findIndex(({ source, sql }) => source === "pool" && sql.includes("SELECT value FROM config"));
  assert.equal(stats.calls.slice(0, firstNotificationRead).some(({ sql }) => sql === "COMMIT"), true);
});

test("concurrent evidence uploads append both files to the locked request without replacing existing documents", async (t) => {
  const dataUrl = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\nevidence\n").toString("base64")}`;
  const existing = { ...pendingRequest(), documents: [{ documentId: "identity", fileName: "identidade.pdf", dataUrl }] };
  const { request, row } = await fixture(t, { existing });
  const uploads = await Promise.all([1, 2].map((index) => request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN,
    body: { documentEvidence: { documentId: `evidencia-${index}`, fileName: `evidencia-${index}.pdf`, dataUrl } },
  })));
  assert.deepEqual(uploads.map((upload) => upload.status), [200, 200]);
  assert.deepEqual(row().documents.map((document) => document.documentId).sort(), ["evidencia-1", "evidencia-2", "identity"]);
  assert.equal(row().documents.filter((document) => document.internalEvidence).length, 2);
});

test("confirming a second procedure keeps the same general status and does not repeat the schedule notice", async (t) => {
  const configured = pendingRequest({ enabled: true, email: "own@example.test" });
  const existing = { ...configured, origin: "INTERNA", request_type: "Castração, Microchipagem", schedule_date: FUTURE_DATE,
    animals: [{ name: "Luna", requestTypeIds: ["castration", "microchip"] }], workflow_data: { ...configured.workflow_data, scheduleSlotTime: "08:00" } };
  const { request, row, stats } = await fixture(t, { existing });
  const confirm = (requestTypeId) => request({ method: "POST", path: `/requests/${REQUEST_ID}/procedures/action`, user: ADMIN,
    body: { action: "confirm_schedule", animalIndex: 0, requestTypeId },
  });
  assert.equal((await confirm("castration")).status, 200);
  assert.equal((await confirm("microchip")).status, 200);
  assert.equal(row().status, "AGENDADA");
  assert.equal(stats.historyAppends, 1);
  assert.equal(row().history.filter((item) => item.notification?.event === NotificationEvent.SCHEDULE_CONFIRMED).length, 1);
});

test("post-commit history failure keeps PATCH successful and preserves the saved operation", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }), failHistory: true });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } });
  assert.equal(response.status, 200);
  assert.equal(row().status, "AGENDADA");
  assert.equal(response.body.notificationResults.some(({ reason }) => reason?.includes("histórico")), true);
  assert.equal(stats.calls.some(({ sql }) => sql === "ROLLBACK"), false);
});

test("a channel whose settings cannot be read is recorded as failed in history after a successful PATCH", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }), failChannelLookup: true });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } });
  assert.equal(response.status, 200);
  assert.equal(row().status, "AGENDADA");
  assert.equal(stats.historyAppends, 1);
  assert.equal(row().history.length >= 1 && row().history.every(({ notification }) => notification.status === "failed"), true);
  assert.equal(response.body.notificationResults.every(({ status }) => status === "failed"), true);
  assert.equal(JSON.stringify(response.body.notificationResults).includes("Simulated"), false);
});

test("a confirmed notice for a channel the municipality turned on but the platform has not set up is recorded as not configured", async (t) => {
  const { request, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }) });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.notificationResults.map(({ channel, status, code }) => [channel, status, code]), [["email", "skipped", "not_configured"]]);
  assert.equal(row().history.length, 1);
});

test("a municipality that uses no channel for the notice leaves no result and no history entry", async (t) => {
  const existing = { ...pendingRequest({ enabled: true, email: "tutor@example.test", phone: "48999991234" }), status: "AGENDADA" };
  const { request, row } = await fixture(t, { existing });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "CANCELADA" } });
  assert.equal(response.status, 200);
  assert.equal(row().status, "CANCELADA");
  assert.deepEqual(response.body.notificationResults, []);
  assert.equal(row().history.length, 0);
});

test("HTTP submissions share the last agenda place without leaking another request", async (t) => {
  const { request, stats } = await fixture(t);
  const payload = procedureBody({ animals:Array.from({length:10},()=>({species:"Cão",sex:"Macho",size:"Pequeno",breedType:"Indefinida"})), preferredSchedule:FUTURE_DATE });
  const results = await Promise.all([request({body:payload}),request({body:payload})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const rejected = results.find(r=>r.status===409);
  assert.equal(rejected.body.request,undefined);
  assert.equal(stats.calls.filter(({sql})=>sql.includes("INSERT INTO requests")).length,1);
  const forgedCancellation = await request({body:{...payload,status:"CANCELADA"}});
  assert.equal(forgedCancellation.status,409, "A public status hint must not bypass the reservation of a new NOVA request");
});

test("public requestType alias cannot omit the configured mandatory document", async (t) => {
  const { request, stats } = await fixture(t, { requiredDocument: true });
  const result = await request({ body: procedureBody({ type: undefined, requestTypeId: undefined, requestType: "Castração" }) });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /documento obrigatório/i);
  assert.equal(stats.calls.some(({ sql }) => sql === "COMMIT"), false);
  assert.equal(stats.calls.some(({ sql }) => sql === "ROLLBACK"), true);
});

const dog = { species: "Cão", sex: "Macho", size: "Pequeno", breedType: "Indefinida", neighborhood: "Centro" };

test("public POST with procedures per animal stores the derived type, the animals and the procedures, ignoring the single type sent", async (t) => {
  const { request, row } = await fixture(t);
  const animals = [{ ...dog, requestTypeIds: ["microchip", "castration"], procedures: [{ requestTypeId: "microchip", status: "REALIZADO" }] },
    { ...dog, requestTypeIds: ["microchip", "microchip"] }];
  const response = await request({ body: procedureBody({ animals, type: "Castração", requestTypeId: "castration" }) });
  assert.equal(response.status, 201);
  assert.equal(row().request_type, "Microchipagem, Castração");
  assert.deepEqual(row().animals.map(({ requestTypeIds }) => requestTypeIds), [["microchip", "castration"], ["microchip"]]);
  assert.deepEqual(row().animals.map(({ procedures }) => procedures.map(({ status, schedule }) => [status, schedule.date, schedule.slotTime])),
    [[["AGUARDANDO", FUTURE_DATE, "08:00"], ["AGUARDANDO", FUTURE_DATE, "08:00"]], [["AGUARDANDO", FUTURE_DATE, "08:00"]]]);
  assert.deepEqual(row().workflow_data.requestTypeIds, ["microchip", "castration"]);
  assert.deepEqual(row().workflow_data.requestTypeNames, ["Microchipagem", "Castração"]);
  assert.equal(Object.hasOwn(row().workflow_data, "requestTypeId"), false);
});

test("public POST refuses an unknown procedure, one switched off and an animal left without any, and saves nothing", async (t) => {
  const { request, row } = await fixture(t);
  for (const animals of [[{ ...dog, requestTypeIds: ["unknown"] }], [{ ...dog, requestTypeIds: ["castration"] }, { ...dog, requestTypeIds: [] }],
    [{ ...dog, requestTypeIds: ["castration"] }, { ...dog }], [{ ...dog, requestTypeIds: "castration" }]]) {
    const response = await request({ body: procedureBody({ animals }) });
    assert.equal(response.status, 400, JSON.stringify(animals));
    assert.equal(row(), null);
  }
});

test("a PATCH that changes the procedures of the animals derives the request type again, and one that forges them does not", async (t) => {
  // Registered by the staff, the only kind of request that may have no date.
  const existing = { ...pendingRequest(), origin: "INTERNA", request_type: "Castração", animals: [{ ...dog, requestTypeIds: ["castration"] }],
    workflow_data: { followUp: { enabled: false, email: "", phone: "" }, requestTypeIds: ["castration"], requestTypeNames: ["Castração"] } };
  const { request, row } = await fixture(t, { existing });
  const path = `/requests/${REQUEST_ID}`;
  const forged = await request({ method: "PATCH", path, user: ADMIN, body: { notes: "x", workflow_data: { requestTypeIds: ["microchip"], requestTypeNames: ["Forjado"] } } });
  assert.equal(forged.status, 200);
  assert.deepEqual(row().workflow_data.requestTypeIds, ["castration"]);
  assert.equal(row().request_type, "Castração");
  const changed = await request({ method: "PATCH", path, user: ADMIN, body: { animals: [{ ...dog, requestTypeIds: ["castration", "microchip"] }] } });
  assert.equal(changed.status, 200);
  assert.equal(row().request_type, "Castração, Microchipagem");
  assert.deepEqual(row().animals[0].requestTypeIds, ["castration", "microchip"]);
  assert.deepEqual(row().workflow_data.requestTypeIds, ["castration", "microchip"]);
  assert.deepEqual(row().workflow_data.requestTypeNames, ["Castração", "Microchipagem"]);
  const refused = await request({ method: "PATCH", path, user: ADMIN, body: { animals: [{ ...dog, requestTypeIds: ["unknown"] }] } });
  assert.equal(refused.status, 400);
  assert.equal(row().request_type, "Castração, Microchipagem");
});
