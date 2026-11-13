import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import requestsRouter from "../src/routes/requests.js";
import { pool } from "../src/db/index.js";
import { NOTIFICATIONS_CONFIG_KEY, buildDefaultNotificationConfig } from "../../shared/notification-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN = { id: "44444444-4444-4444-8444-444444444444", role: "admin_municipal", municipalityId: MUNICIPALITY_ID };
const SECRET = "request-route-tests-only";
const VALID_CPF = "52998224725";
const clientFetch = globalThis.fetch;
const clone = (value) => structuredClone(value);

function procedureBody(overrides = {}) {
  return {
    municipalityId: MUNICIPALITY_ID, requestTypeId: "castration", type: "Castração",
    animals: [{ species: "Cão", sex: "Macho", size: "Pequeno", breedType: "Indefinida" }],
    workflow_data: { identificationTypeId: "without_tutor", followUp: { enabled: false } }, ...overrides,
  };
}

async function fixture(t, { existing, failHistory = false, failNotificationSettings = false, failRequestInsert = false } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET, fetch: globalThis.fetch };
  process.env.JWT_SECRET = SECRET;
  const stats = { calls: [], settingsReads: 0, historyAppends: 0, transports: 0 };
  const sessionUsers = new Map();
  const tutorProfiles = new Map();
  const createdUsers = new Map();
  let requestRow = existing ? clone(existing) : null;
  const configuration = new Map([
    ["castragestao:request-types", [{ id: "castration", name: "Castração", active: true, stepTutor: true }]],
    ["castragestao:identification-types", [
      { id: "with_tutor", name: "Com tutor", active: true, stepTutor: true },
      { id: "without_tutor", name: "Sem tutor", active: true, stepTutor: false },
    ]],
    [NOTIFICATIONS_CONFIG_KEY, buildDefaultNotificationConfig()], ["whatsapp", { active: false }],
  ]);
  let lockTail = Promise.resolve();
  function acquireLock() {
    let unlock;
    const held = new Promise((resolve) => { unlock = resolve; });
    const previousLock = lockTail;
    lockTail = previousLock.then(() => held);
    return previousLock.then(() => unlock);
  }
  function connection(source) {
    let unlock;
    const created = [];
    return {
      async query(sql, values = []) {
        const session = resolveTestSession(sql, values, sessionUsers);
        if (session) return session;
        stats.calls.push({ sql, values, source });
        if (sql === "BEGIN") return { rows: [] };
        if (sql === "COMMIT" || sql === "ROLLBACK") {
          if (sql === "ROLLBACK") for (const id of created) {
            createdUsers.delete(id);
            for (const [key, profile] of tutorProfiles) if (profile.user_id === id) tutorProfiles.delete(key);
          }
          unlock?.(); unlock = undefined;
          return { rows: [] };
        }
        if (sql.includes("INSERT INTO auth_rate_limits")) return { rows: [{ attempts: 1 }] };
        if (sql.includes("DELETE FROM auth_rate_limits")) return { rows: [] };
        if (sql.includes("pg_advisory_xact_lock")) { unlock = await acquireLock(); return { rows: [] }; }
        if (sql.startsWith("SELECT user_id FROM tutor_profiles")) {
          const profile = tutorProfiles.get(`${values[0]}:${values[1]}`);
          return { rows: profile ? [profile] : [] };
        }
        if (sql.startsWith("SELECT cpf FROM tutor_profiles")) {
          const user = sessionUsers.get(values[0]);
          return { rows: user?.municipality_id === values[1] && user.cpf ? [{ cpf: user.cpf }] : [] };
        }
        if (sql.includes("INSERT INTO users")) {
          const id = "55555555-5555-4555-8555-555555555555";
          createdUsers.set(id, { id, name: values[0], password: values[1], municipality_id: values[2] });
          created.push(id);
          return { rows: [{ id }] };
        }
        if (sql.startsWith("INSERT INTO tutor_profiles")) {
          tutorProfiles.set(`${values[1]}:${values[2]}`, { user_id: values[0], cpf: values[2] });
          return { rows: [] };
        }
        if (sql.includes("FROM municipalities m LEFT JOIN config")) {
          if (source === "pool") {
            stats.settingsReads += 1;
            if (failNotificationSettings) throw new Error("Simulated config lookup failure");
          }
          return { rows: [...configuration].map(([key, value]) => ({ key, value: clone(value), municipality_id: values[0] })) };
        }
        if (sql.includes("SELECT value FROM config")) return { rows: [{ value: clone(configuration.get(values[0])) }] };
        if (sql.includes("INSERT INTO request_protocol_counters")) return { rows: [{ seq: 1 }] };
        if (sql.includes("SELECT validation_key FROM request_validation_keys")) return { rows: [] };
        if (sql.includes("INSERT INTO request_validation_keys")) return { rows: [{ validation_key: values[1] }] };
        if (sql.includes("INSERT INTO requests")) {
          if (failRequestInsert) throw new Error("Simulated request write failure");
          requestRow = {
            id: REQUEST_ID, tutor_id: values[0], protocol: values[1], validation_key: values[2],
            tutor_name: values[3], tutor_email: values[4], cpf: values[5], phone: values[6],
            animals: JSON.parse(values[17]), request_type: values[18], municipality_id: values[20],
            schedule_date: values[22], documents: JSON.parse(values[31]), tags: JSON.parse(values[32]),
            workflow_data: JSON.parse(values[33]), origin: values[36], status: "NOVA", history: [],
          };
          return { rows: [clone(requestRow)] };
        }
        if (sql.startsWith("SELECT * FROM requests")) {
          if (sql.includes("WHERE tutor_id = $1")) {
            assert.match(sql, /AND municipality_id = \$2/);
            return { rows: requestRow?.tutor_id === values[0] && requestRow?.municipality_id === values[1] ? [clone(requestRow)] : [] };
          }
          if (sql.includes("FOR UPDATE")) unlock = await acquireLock();
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
          const idIndex = Number(sql.match(/WHERE id = \$(\d+)/)[1]) - 1;
          const scope = sql.match(/AND municipality_id = \$(\d+)/);
          assert.equal(values[idIndex], requestRow.id);
          if (scope) assert.equal(values[Number(scope[1]) - 1], requestRow.municipality_id);
          for (const [, key, parameter] of sql.split(" WHERE ")[0].matchAll(/(\w+) = \$(\d+)/g)) {
            const value = values[Number(parameter) - 1];
            requestRow[key] = ["workflow_data", "documents", "animals", "tags"].includes(key) ? JSON.parse(value) : value;
          }
          const history = sql.match(/history = history \|\| \$(\d+)::jsonb/);
          if (history) requestRow.history.push(...JSON.parse(values[Number(history[1]) - 1]));
          return { rows: [clone(requestRow)] };
        }
        throw new Error(`Unexpected test SQL: ${sql}`);
      },
      release() { assert.equal(unlock, undefined, "Transaction lock must be released before returning connection"); },
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
    return { status: response.status, body: await response.json(), cacheControl: response.headers.get("cache-control") };
  }
  return { request, stats, row: () => requestRow, profiles: tutorProfiles, users: createdUsers };
}

function pendingRequest(followUp = { enabled: false, email: "", phone: "" }) {
  return { id: REQUEST_ID, municipality_id: MUNICIPALITY_ID, status: "NOVA", tags: [], documents: [], history: [], workflow_data: { followUp } };
}

test("public POST rejects omitted preference and CPF required by configured Tutor step", async (t) => {
  const { request, row } = await fixture(t);
  const missingPreference = await request({ body: procedureBody({ workflow_data: { identificationTypeId: "without_tutor" } }) });
  assert.equal(missingPreference.status, 400);
  const missingCpf = await request({ body: procedureBody({ workflow_data: { identificationTypeId: "with_tutor", followUp: { enabled: false } } }) });
  assert.equal(missingCpf.status, 400);
  assert.equal(row(), null);
});

test("configured no-Tutor POST saves without CPF and never writes an empty CPF validation-key record", async (t) => {
  const { request, stats, row } = await fixture(t);
  const response = await request({ body: procedureBody() });
  assert.equal(response.status, 201);
  assert.equal(row().cpf, null);
  assert.match(row().validation_key, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(stats.calls.some(({ sql }) => sql.includes("request_validation_keys")), false);
  assert.equal(row().origin, "PUBLICA");
  assert.equal(response.body.request.id, row().id);
  assert.equal(response.body.request.validation_key, undefined);
  assert.equal(response.body.enrollment, undefined);
});

test("forged origin, skipTutor and stepTutor flags cannot dispense CPF", async (t) => {
  const { request, row } = await fixture(t);
  const response = await request({ body: procedureBody({
    origin: "INTERNA", skipTutor: true, stepTutor: false,
    workflow_data: { identificationTypeId: "with_tutor", followUp: { enabled: false }, skipTutor: true },
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
    identificationTypeId: "without_tutor", followUp: { enabled: false, email: "stale@example.test", phone: "48999991234" },
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
  assert.equal((await request({ user: ADMIN, body: procedureBody({ municipalityId: OTHER_MUNICIPALITY_ID, cpf: VALID_CPF }) })).status, 201);
  assert.equal(row().municipality_id, MUNICIPALITY_ID);
  assert.equal(stats.calls.find(({ sql }) => sql.includes("FROM municipalities m")).values[0], MUNICIPALITY_ID);
  assert.equal(row().tutor_id, null, "An attendant is not the tutor owner");
});

test("new public tutor enrollment returns one ephemeral credential outside the persisted request", async (t) => {
  const { request, row, users, profiles } = await fixture(t);
  const response = await request({ body: procedureBody({ cpf: VALID_CPF, tutor_name: "Tutor Example", workflow_data: { identificationTypeId: "with_tutor", followUp: { enabled: false } } }) });
  assert.equal(response.status, 201);
  const password = response.body.enrollment.temporaryPassword;
  assert.equal(response.cacheControl, "no-store");
  assert.ok(password.length >= 15);
  assert.equal(response.body.enrollment.cpf, VALID_CPF);
  assert.equal(response.body.request.validation_key, undefined);
  assert.equal(JSON.stringify(row()).includes(password), false);
  assert.equal(JSON.stringify(response.body.request).includes(password), false);
  assert.equal(users.size, 1);
  assert.equal(profiles.size, 1);
  assert.match([...users.values()][0].password, /^\$2[aby]\$/);
});

test("repeated anonymous CPF never resets an existing account or returns its credential or key", async (t) => {
  const { request, row, users } = await fixture(t);
  const body = procedureBody({ cpf: VALID_CPF, tutor_name: "Tutor Example", workflow_data: { identificationTypeId: "with_tutor", followUp: { enabled: false } } });
  const first = await request({ body });
  const storedHash = [...users.values()][0].password;
  const second = await request({ body });
  assert.equal(second.status, 201);
  assert.equal(second.body.enrollment, undefined);
  assert.equal(second.body.request.validation_key, undefined);
  assert.equal(second.body.request.tutor_id, null);
  assert.equal(row().tutor_id, null);
  assert.equal([...users.values()][0].password, storedHash);
  assert.equal(JSON.stringify(second.body).includes(first.body.enrollment.temporaryPassword), false);
});

test("concurrent initial submissions create one municipal account and reveal only the newly created credential", async (t) => {
  const { request, users, profiles, stats } = await fixture(t);
  const body = procedureBody({ cpf: VALID_CPF, tutor_name: "Tutor Example", workflow_data: { identificationTypeId: "with_tutor", followUp: { enabled: false } } });
  const results = await Promise.all([request({ body }), request({ body })]);
  assert.ok(results.every((result) => result.status === 201));
  assert.equal(results.filter((result) => result.body.enrollment?.temporaryPassword).length, 1);
  assert.equal(users.size, 1);
  assert.equal(profiles.size, 1);
  assert.equal(stats.calls.filter(({ sql }) => sql.includes("INSERT INTO users")).length, 1);
  assert.equal(stats.calls.filter(({ sql }) => sql.includes("pg_advisory_xact_lock")).length, 2);
});

test("failed request insert rolls back both new account and profile", async (t) => {
  const { request, users, profiles, stats } = await fixture(t, { failRequestInsert: true });
  const response = await request({ body: procedureBody({ cpf: VALID_CPF, tutor_name: "Tutor Example", workflow_data: { identificationTypeId: "with_tutor", followUp: { enabled: false } } }) });
  assert.equal(response.status, 500);
  assert.equal(users.size, 0);
  assert.equal(profiles.size, 0);
  assert.equal(stats.calls.at(-1).sql, "ROLLBACK");
});

test("authenticated tutor cannot submit a different CPF or delete requests", async (t) => {
  const { request } = await fixture(t);
  const user = { ...ADMIN, role: "tutor" };
  const response = await request({ user, body: procedureBody({ cpf: "16899535009", tutor_name: "Another Tutor" }) });
  assert.equal(response.status, 403);
  assert.equal((await request({ user, method: "DELETE", path: `/requests/${REQUEST_ID}` })).status, 403);
});

test("tutor request reads require authenticated owner and municipality and omit validation secrets", async (t) => {
  const existing = { ...pendingRequest(), tutor_id: ADMIN.id, validation_key: "private-existing-key" };
  const { request } = await fixture(t, { existing });
  const response = await request({ user: { ...ADMIN, role: "tutor" }, method: "GET" });
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].validation_key, undefined);
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
  assert.equal(stats.settingsReads, 0);
});

test("concurrent identical PATCHes serialize snapshots and produce only one notification transition after commit", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }) });
  const responses = await Promise.all([1, 2].map(() => request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } })));
  assert.equal(responses.every(({ status }) => status === 200), true);
  assert.deepEqual(responses.map(({ body }) => body.notificationResults.length).sort(), [0, 2]);
  assert.equal(stats.settingsReads, 1);
  assert.equal(stats.historyAppends, 1);
  assert.equal(row().history.length, 2);
  assert.equal(stats.calls.filter(({ sql }) => sql.includes("FOR UPDATE")).length, 2);
  const firstNotificationRead = stats.calls.findIndex(({ source, sql }) => source === "pool" && sql.includes("FROM municipalities m"));
  assert.equal(stats.calls.slice(0, firstNotificationRead).some(({ sql }) => sql === "COMMIT"), true);
});

test("post-commit history failure keeps PATCH successful and preserves the saved operation", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }), failHistory: true });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } });
  assert.equal(response.status, 200);
  assert.equal(row().status, "AGENDADA");
  assert.equal(response.body.notificationResults.some(({ reason }) => reason?.includes("histórico")), true);
  assert.equal(stats.calls.some(({ sql }) => sql === "ROLLBACK"), false);
});

test("notification-settings failure is recorded in history after successful PATCH", async (t) => {
  const { request, stats, row } = await fixture(t, { existing: pendingRequest({ enabled: true, email: "tutor@example.test", phone: "" }), failNotificationSettings: true });
  const response = await request({ method: "PATCH", path: `/requests/${REQUEST_ID}`, user: ADMIN, body: { status: "AGENDADA" } });
  assert.equal(response.status, 200);
  assert.equal(row().status, "AGENDADA");
  assert.equal(stats.historyAppends, 1);
  assert.equal(row().history[0].notification.status, "failed");
});
