import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "../src/db/index.js";
import { trackingChallengeDigest } from "../src/repositories/request-tracking.js";
import { createRequestTrackingRouter } from "../src/routes/request-tracking.js";
import { followUpDestination, readStartInput, sameContact } from "../src/services/request-tracking/tracking-input.js";
import { createTrackingToken, readTrackingToken } from "../src/services/request-tracking/tracking-token.js";
import { buildTrackingView } from "../src/services/request-tracking/tracking-view.js";
import { AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS } from "../../shared/auth-contract.js";
import { NotificationChannel } from "../../shared/notification-contract.js";
import { TRACKING_TOKEN_SECONDS, normalizeTrackingProtocol } from "../../shared/request-tracking-contract.js";
import { registerTestSession } from "./fixtures/session-user.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const PROTOCOL = "000123/2026";
const EMAIL = "citizen@example.com";
const PHONE = "48999991234";
const START = { municipalityId: MUNICIPALITY, protocol: PROTOCOL, contact: EMAIL };
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const clientFetch = globalThis.fetch;

function trackedRow(overrides = {}) {
  return {
    id: REQUEST_ID, municipality_id: MUNICIPALITY, municipality_active: true, protocol: PROTOCOL,
    workflow_data: { followUp: { enabled: true, email: EMAIL, phone: PHONE } },
    request_type: "Castração", status: "AGENDADA", created_at: new Date("2026-11-01T10:00:00Z"), updated_at: new Date("2026-11-05T10:00:00Z"),
    schedule_date: "20/11/2026 09:00", schedule_location_name: "Unidade Municipal", schedule_address: "Rua das Flores, 10",
    documents: [
      { documentId: "identity", documentName: "Identidade", fileName: "PRIVATE_FILE_1.pdf", dataUrl: "data:PRIVATE_CONTENT", status: "approved" },
      { documentId: "address", documentName: "Comprovante", fileName: "PRIVATE_FILE_2.pdf", status: "approved" },
      { documentId: "photo", documentName: "Foto", fileName: "PRIVATE_FILE_3.jpg", status: "rejected", review: { reason: "PRIVATE_REASON" } },
      { documentId: "other", documentName: "Outro", fileName: "PRIVATE_FILE_4.pdf", status: "attached" },
      { documentId: "evidencia-1", documentName: "Evidência da apuração", internalEvidence: true, status: "approved" },
    ],
    // Columns that must never reach a tracking response.
    cpf: "PRIVATE_CPF", tutor_name: "PRIVATE_TUTOR", tutor_email: "PRIVATE_EMAIL", phone: "PRIVATE_PHONE", address: "PRIVATE_ADDRESS",
    notes: "PRIVATE_NOTES", history: [{ notes: "PRIVATE_HISTORY" }], animals: [{ name: "PRIVATE_ANIMAL" }],
    ...overrides,
  };
}

async function fixture(t, { rows = [trackedRow()] } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "request-tracking-tests-only";
  const requests = new Map(rows.map((row) => [row.id, row]));
  const challenges = new Map();
  const limits = new Map();
  const calls = [];
  const deliveries = [];
  const scheduled = [];
  // Like a real SELECT, only the columns named in the statement come back.
  const project = (row, sql) => {
    const listed = [...sql.slice(sql.indexOf("SELECT"), sql.indexOf("FROM requests")).matchAll(/r\.(\w+)/g)].map((match) => match[1]);
    return Object.fromEntries(listed.map((column) => [column, structuredClone(row[column])]));
  };
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("INSERT INTO auth_rate_limits")) {
      const [key, now, expires] = values;
      const current = limits.get(key);
      if (!current || current.expires <= now) limits.set(key, { attempts: 1, expires });
      else current.attempts += 1;
      return { rows: [{ attempts: limits.get(key).attempts }] };
    }
    if (sql.includes("DELETE FROM auth_rate_limits") || sql.includes("DELETE FROM request_tracking_challenges")) return { rows: [] };
    if (sql.includes("AS follow_up")) {
      const row = [...requests.values()].find((item) => item.municipality_id === values[0] && item.protocol === values[1] && item.municipality_active);
      return { rows: row ? [{ id: row.id, municipality_id: row.municipality_id, follow_up: structuredClone(row.workflow_data?.followUp) }] : [] };
    }
    if (sql.startsWith("UPDATE request_tracking_challenges SET consumed_at = $1 WHERE request_id")) {
      for (const challenge of challenges.values()) if (challenge.request_id === values[1] && !challenge.consumed_at) challenge.consumed_at = values[0];
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO request_tracking_challenges")) {
      const [id, requestId, municipalityId, channel, digest, expiresAt] = values;
      challenges.set(id, { id, request_id: requestId, municipality_id: municipalityId, channel, digest, expires_at: expiresAt, attempts: 0, consumed_at: null, delivery: null });
      return { rows: [] };
    }
    if (sql.includes("SELECT * FROM request_tracking_challenges")) {
      const row = challenges.get(values[0]);
      return { rows: row ? [structuredClone(row)] : [] };
    }
    if (sql.startsWith("UPDATE request_tracking_challenges SET attempts")) {
      const row = challenges.get(values[0]);
      row.attempts += 1;
      if (values[1]) row.consumed_at = values[2];
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE request_tracking_challenges SET delivery")) {
      challenges.get(values[0]).delivery = JSON.parse(values[1]);
      return { rows: [] };
    }
    if (sql.includes("WHERE r.id = $1 AND r.municipality_id = $2")) {
      const row = requests.get(values[0]);
      return { rows: row && row.municipality_id === values[1] && row.municipality_active ? [project(row, sql)] : [] };
    }
    throw new Error(`Unexpected tracking test SQL: ${sql}`);
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const router = createRequestTrackingRouter({
    deliver: async (input) => { deliveries.push(input); return [{ purpose: input.purpose, channel: NotificationChannel.EMAIL, status: "sent" }]; },
    schedule: (task) => { scheduled.push(task); },
  });
  const app = express();
  app.use(express.json());
  app.use("/tracking", router);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.secret;
  });
  async function request(path, { method = "GET", body, token, authorization } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}/tracking${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
  }
  return {
    request, calls, challenges, deliveries,
    start: (body) => request("/challenges", { method: "POST", body }),
    confirm: (id, code) => request(`/challenges/${id}/confirm`, { method: "POST", body: { code } }),
    flush: async () => { while (scheduled.length) await scheduled.shift()(); },
  };
}

test("a request with the matching e-mail gets a code and every other case answers exactly alike", async (t) => {
  const rows = [
    trackedRow(),
    trackedRow({ id: OTHER_REQUEST_ID, protocol: "000124/2026", workflow_data: { followUp: { enabled: false, email: "", phone: "" } } }),
    trackedRow({ id: "55555555-5555-4555-8555-555555555555", protocol: "000125/2026", municipality_id: OTHER_MUNICIPALITY, municipality_active: false }),
    trackedRow({ id: "66666666-6666-4666-8666-666666666666", protocol: "000126/2026", workflow_data: { followUp: { enabled: true, email: EMAIL, phone: "" } } }),
  ];
  const f = await fixture(t, { rows });
  const bodies = [
    START,
    { ...START, protocol: "999999/2026" },
    { ...START, contact: "other@example.com" },
    { ...START, municipalityId: OTHER_MUNICIPALITY },
    { ...START, protocol: "000124/2026" },
    { municipalityId: OTHER_MUNICIPALITY, protocol: "000125/2026", contact: EMAIL },
    { ...START, protocol: "000126/2026", contact: PHONE },
  ];
  const responses = [];
  for (const body of bodies) responses.push(await f.start(body));
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(Object.keys(response.body).sort(), ["challengeId", "expiresIn", "ok", "retryAfter"]);
    assert.match(response.body.challengeId, UUID_V4);
    assert.equal(response.body.expiresIn, AUTH_CHALLENGE_SECONDS);
    assert.equal(response.body.retryAfter, AUTH_RETRY_SECONDS);
  }
  assert.equal(new Set(responses.map((response) => response.body.challengeId)).size, responses.length);
  assert.deepEqual([...f.challenges.keys()], [responses[0].body.challengeId]);
  await f.flush();
  assert.equal(f.deliveries.length, 1);
  const [delivery] = f.deliveries;
  assert.equal(delivery.purpose, AuthPurpose.REQUEST_TRACKING);
  assert.equal(delivery.municipalityId, MUNICIPALITY);
  assert.equal(delivery.email, EMAIL);
  assert.equal(delivery.phone, "");
  assert.match(delivery.code, /^\d{6}$/);
  for (const response of responses) assert.equal(JSON.stringify(response.body).includes(delivery.code), false);
  assert.deepEqual([...f.challenges.values()][0].delivery, [{ purpose: AuthPurpose.REQUEST_TRACKING, channel: NotificationChannel.EMAIL, status: "sent" }]);
});

test("a matching phone number is answered on WhatsApp only", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.start({ ...START, contact: "(48) 99999-1234" })).status, 200);
  await f.flush();
  assert.equal(f.deliveries.length, 1);
  assert.equal(f.deliveries[0].phone, PHONE);
  assert.equal(f.deliveries[0].email, "");
  assert.equal([...f.challenges.values()][0].channel, NotificationChannel.WHATSAPP);
});

test("malformed start input is refused before any database operation", async (t) => {
  const f = await fixture(t);
  const invalid = [
    {}, { ...START, municipalityId: "not-a-uuid" }, { ...START, municipalityId: undefined }, { ...START, protocol: "123" }, { ...START, protocol: undefined },
    { ...START, contact: "not a contact" }, { ...START, contact: 12345 }, { ...START, contact: `${"a".repeat(250)}@example.com` },
  ];
  for (const body of invalid) assert.equal((await f.start(body)).status, 400, JSON.stringify(body));
  assert.equal(f.calls.length, 0);
});

test("the resend cooldown answers known and unknown requests alike", async (t) => {
  const f = await fixture(t);
  const unknown = { ...START, protocol: "999999/2026" };
  assert.equal((await f.start(START)).status, 200);
  const known = await f.start(START);
  assert.equal((await f.start(unknown)).status, 200);
  const invented = await f.start(unknown);
  assert.equal(known.status, 429);
  assert.deepEqual(known.body, { error: "Aguarde para tentar novamente.", retryAfter: AUTH_RETRY_SECONDS });
  assert.equal(invented.status, 429);
  assert.deepEqual(invented.body, known.body);
  // The two limited calls never looked the request up.
  assert.equal(f.calls.filter(({ sql }) => sql.includes("AS follow_up")).length, 2);
});

test("the per-protocol limit answers known and unknown protocols with the same sequence", async (t) => {
  const f = await fixture(t);
  const sequence = async (protocol) => {
    const statuses = [];
    for (let index = 0; index < 7; index += 1) statuses.push((await f.start({ ...START, protocol, contact: `person${index}@example.com` })).status);
    return statuses;
  };
  const known = await sequence(PROTOCOL);
  const unknown = await sequence("999999/2026");
  assert.deepEqual(known, unknown);
  assert.deepEqual(known, [200, 200, 200, 200, 200, 429, 429]);
});

test("the per-contact limit stops probing many protocols with one address", async (t) => {
  const f = await fixture(t);
  const statuses = [];
  for (let index = 0; index < 7; index += 1) statuses.push((await f.start({ ...START, protocol: `00020${index}/2026`, contact: "victim@example.com" })).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
  assert.equal(f.deliveries.length, 0);
});

test("a new code retires the previous one and codes are stored only as keyed digests", async (t) => {
  const f = await fixture(t);
  const first = await f.start(START);
  const second = await f.start({ ...START, contact: PHONE });
  await f.flush();
  const [emailCode, phoneCode] = f.deliveries.map((delivery) => delivery.code);
  assert.ok(f.challenges.get(first.body.challengeId).consumed_at);
  assert.equal(f.challenges.get(second.body.challengeId).consumed_at, null);
  for (const [row, code] of [[f.challenges.get(first.body.challengeId), emailCode], [f.challenges.get(second.body.challengeId), phoneCode]]) {
    assert.match(row.digest, /^[a-f0-9]{64}$/);
    assert.equal(row.digest, trackingChallengeDigest(row, code));
    assert.notEqual(row.digest, code);
  }
  assert.equal((await f.confirm(first.body.challengeId, emailCode)).status, 400);
  assert.equal((await f.confirm(second.body.challengeId, phoneCode)).status, 200);
});

test("the right code opens a short token for that request only, and only once", async (t) => {
  const f = await fixture(t);
  const { body: { challengeId } } = await f.start(START);
  await f.flush();
  const code = f.deliveries[0].code;
  const opened = await f.confirm(challengeId, code);
  assert.equal(opened.status, 200);
  assert.equal(opened.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(opened.body).sort(), ["expiresIn", "token"]);
  assert.equal(opened.body.expiresIn, TRACKING_TOKEN_SECONDS);
  const claims = readTrackingToken(opened.body.token);
  assert.equal(claims.requestId, REQUEST_ID);
  assert.equal(claims.municipalityId, MUNICIPALITY);
  assert.ok(claims.expiresAt > Date.now() && claims.expiresAt <= Date.now() + TRACKING_TOKEN_SECONDS * 1000);
  assert.equal((await f.confirm(challengeId, code)).status, 400);
});

test("every failed confirmation answers with the same message, for real and invented challenges", async (t) => {
  const f = await fixture(t);
  const real = (await f.start(START)).body.challengeId;
  const invented = (await f.start({ ...START, protocol: "999999/2026" })).body.challengeId;
  await f.flush();
  const code = f.deliveries[0].code;
  const outcomes = [
    await f.confirm(real, "000000"), await f.confirm(invented, code), await f.confirm(invented, "000000"),
    await f.confirm("not-a-uuid", code), await f.confirm(real, "12ab56"), await f.confirm(real, undefined),
  ];
  assert.deepEqual(new Set(outcomes.map((outcome) => outcome.status)), new Set([400]));
  assert.equal(new Set(outcomes.map((outcome) => JSON.stringify(outcome.body))).size, 1);
  assert.equal(outcomes[0].body.error, "Código inválido ou expirado. Solicite um novo código.");
});

test("five wrong guesses lock the challenge even for the right code, and an expired one is refused", async (t) => {
  const f = await fixture(t);
  const { body: { challengeId } } = await f.start(START);
  await f.flush();
  const code = f.deliveries[0].code;
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await f.confirm(challengeId, "000000")).status, 400);
  assert.equal(f.challenges.get(challengeId).attempts, 5);
  assert.equal((await f.confirm(challengeId, code)).status, 400);
  assert.equal(f.challenges.get(challengeId).consumed_at, null);

  const other = await fixture(t);
  const second = await other.start(START);
  await other.flush();
  other.challenges.get(second.body.challengeId).expires_at = new Date(Date.now() - 1000);
  assert.equal((await other.confirm(second.body.challengeId, other.deliveries[0].code)).status, 400);
});

test("guessing is rate limited the same way for real and invented challenge ids", async (t) => {
  const f = await fixture(t);
  const real = (await f.start(START)).body.challengeId;
  const invented = randomUUID();
  const sequence = async (id) => {
    const statuses = [];
    for (let attempt = 0; attempt < 12; attempt += 1) statuses.push((await f.confirm(id, "000000")).status);
    return statuses;
  };
  const guessedReal = await sequence(real);
  const guessedInvented = await sequence(invented);
  assert.deepEqual(guessedReal, guessedInvented);
  assert.deepEqual(guessedReal, [...Array(10).fill(400), 429, 429]);
});

test("the tracking view exposes only the allowed fields and counts documents without naming them", async (t) => {
  const f = await fixture(t);
  const token = createTrackingToken({ requestId: REQUEST_ID, municipalityId: MUNICIPALITY });
  const response = await f.request("/request", { token });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(response.body, { request: {
    protocol: PROTOCOL, requestType: "Castração", status: "AGENDADA",
    createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-05T10:00:00.000Z",
    schedule: { date: "20/11/2026 09:00", locationName: "Unidade Municipal", address: "Rua das Flores, 10" },
    documents: { total: 4, approved: 2, needsCorrection: 1, pending: 1 },
  } });
  assert.equal(JSON.stringify(response.body).includes("PRIVATE_"), false);
  const { sql } = f.calls.find(({ sql: text }) => text.includes("WHERE r.id = $1"));
  for (const column of ["cpf", "tutor_name", "tutor_email", "phone", "address", "notes", "history", "animals", "workflow_data"]) {
    assert.equal(new RegExp(`r\\.${column}\\b`).test(sql), false, `the view must not select ${column}`);
  }
});

test("the tracking view needs a valid tracking token and stays inside its own request and tenant", async (t) => {
  const f = await fixture(t);
  const valid = createTrackingToken({ requestId: REQUEST_ID, municipalityId: MUNICIPALITY });
  const forged = `${Buffer.from(JSON.stringify({ requestId: OTHER_REQUEST_ID, municipalityId: MUNICIPALITY, expiresAt: Date.now() + 600000 })).toString("base64url")}.${valid.split(".")[1]}`;
  const expired = createTrackingToken({ requestId: REQUEST_ID, municipalityId: MUNICIPALITY }, Date.now() - (TRACKING_TOKEN_SECONDS + 5) * 1000);
  const session = registerTestSession(new Map(), { id: "77777777-7777-4777-8777-777777777777", role: "admin_municipal", municipalityId: MUNICIPALITY });
  for (const token of [undefined, "", "garbage", `${valid}.extra`, forged, expired, session]) {
    assert.equal((await f.request("/request", { token })).status, 401, String(token).slice(0, 20));
  }
  assert.equal((await f.request("/request", { authorization: `Basic ${valid}` })).status, 401);
  assert.equal((await f.request("/request", { token: createTrackingToken({ requestId: REQUEST_ID, municipalityId: OTHER_MUNICIPALITY }) })).status, 404);
  assert.equal((await f.request("/request", { token: createTrackingToken({ requestId: OTHER_REQUEST_ID, municipalityId: MUNICIPALITY }) })).status, 404);
  assert.equal(f.calls.some(({ sql }) => sql.includes("WHERE r.id = $1") && sql.includes("m.active = TRUE")), true);

  const inactive = await fixture(t, { rows: [trackedRow({ municipality_active: false })] });
  assert.equal((await inactive.request("/request", { token: valid })).status, 404);
});

test("tracking tokens are signed, bound to one request and expire", () => {
  process.env.JWT_SECRET ||= "request-tracking-tests-only";
  const token = createTrackingToken({ requestId: REQUEST_ID, municipalityId: MUNICIPALITY }, 1_000);
  assert.deepEqual(readTrackingToken(token, 2_000), { requestId: REQUEST_ID, municipalityId: MUNICIPALITY, expiresAt: 1_000 + TRACKING_TOKEN_SECONDS * 1000 });
  assert.equal(readTrackingToken(token, 1_000 + TRACKING_TOKEN_SECONDS * 1000), null);
  const [payload, signature] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const withClaims = (changed) => `${Buffer.from(JSON.stringify({ ...claims, ...changed })).toString("base64url")}.${signature}`;
  assert.equal(readTrackingToken(withClaims({ requestId: OTHER_REQUEST_ID }), 2_000), null);
  assert.equal(readTrackingToken(`${payload}.${"0".repeat(64)}`, 2_000), null);
  assert.equal(readTrackingToken(`${payload}.${signature}.x`, 2_000), null);
  assert.equal(readTrackingToken("a".repeat(2000), 2_000), null);
  assert.equal(readTrackingToken(undefined, 2_000), null);
  assert.equal(readTrackingToken(createTrackingToken({ requestId: "not-a-uuid", municipalityId: MUNICIPALITY }, 1_000), 2_000), null);
});

test("the public projection keeps only whitelisted fields and tolerates missing data", () => {
  const view = buildTrackingView(trackedRow({ schedule_date: null, documents: null, created_at: "not a date" }));
  assert.deepEqual(view, { protocol: PROTOCOL, requestType: "Castração", status: "AGENDADA", createdAt: null, updatedAt: "2026-11-05T10:00:00.000Z",
    schedule: null, documents: { total: 0, approved: 0, needsCorrection: 0, pending: 0 } });
  assert.deepEqual(Object.keys(buildTrackingView(trackedRow())).sort(),
    ["createdAt", "documents", "protocol", "requestType", "schedule", "status", "updatedAt"]);
  const unknownStatus = buildTrackingView(trackedRow({ documents: [{ documentId: "identity", status: "something-new" }, null, "text"] }));
  assert.deepEqual(unknownStatus.documents, { total: 1, approved: 0, needsCorrection: 0, pending: 1 });
});

test("start input accepts common formats and rejects anything else", () => {
  assert.deepEqual(readStartInput({ municipalityId: MUNICIPALITY, protocol: " #123/2026 ", contact: "Citizen@Example.COM " }),
    { municipalityId: MUNICIPALITY, protocol: "000123/2026", channel: NotificationChannel.EMAIL, value: EMAIL });
  for (const contact of ["+55 (48) 99999-1234", "48999991234", "(48) 9999-1234"]) {
    const input = readStartInput({ municipalityId: MUNICIPALITY, protocol: PROTOCOL, contact });
    assert.equal(input.channel, NotificationChannel.WHATSAPP);
    assert.match(input.value, /^48\d{8,9}$/);
  }
  for (const contact of ["", "123", "a@b", "@example.com", "48 1234"]) {
    assert.throws(() => readStartInput({ municipalityId: MUNICIPALITY, protocol: PROTOCOL, contact }), { status: 400 });
  }
  for (const body of [null, undefined, "text", 42, []]) assert.throws(() => readStartInput(body), { status: 400 });
});

test("a follow-up contact matches only when enabled, present and equal", () => {
  const followUp = { enabled: true, email: "Citizen@Example.com", phone: "5548999991234" };
  assert.equal(followUpDestination(followUp, NotificationChannel.EMAIL), EMAIL);
  assert.equal(followUpDestination(followUp, NotificationChannel.WHATSAPP), PHONE);
  assert.equal(followUpDestination({ ...followUp, enabled: false }, NotificationChannel.EMAIL), "");
  assert.equal(followUpDestination({ ...followUp, enabled: "true" }, NotificationChannel.EMAIL), "");
  assert.equal(followUpDestination(undefined, NotificationChannel.EMAIL), "");
  assert.equal(followUpDestination({ enabled: true, email: 12 }, NotificationChannel.EMAIL), "");
  process.env.JWT_SECRET ||= "request-tracking-tests-only";
  assert.equal(sameContact(EMAIL, EMAIL), true);
  assert.equal(sameContact(EMAIL, "other@example.com"), false);
  assert.equal(sameContact("", ""), false);
});

test("protocols are normalized to the printed format", () => {
  assert.equal(normalizeTrackingProtocol("000123/2026"), "000123/2026");
  assert.equal(normalizeTrackingProtocol(" #123/2026 "), "000123/2026");
  assert.equal(normalizeTrackingProtocol("0000123/2026"), "000123/2026");
  assert.equal(normalizeTrackingProtocol("1234567/2026"), "1234567/2026");
  for (const value of ["", "123", "123/26", "abc/2026", "1/2/2026", "1234567890/2026", undefined, null, 123, {}]) assert.equal(normalizeTrackingProtocol(value), null);
});
