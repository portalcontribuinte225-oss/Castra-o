import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import { pool } from "../src/db/index.js";
import { trackingChallengeDigest } from "../src/repositories/request-tracking.js";
import { createRequestAccessRouter } from "../src/routes/request-access.js";
import { accessContactDigest, accessCpfDigest, readAccessStartInput } from "../src/services/request-access/access-input.js";
import { createAccessToken, readAccessToken } from "../src/services/request-access/access-token.js";
import { AuthPurpose, AUTH_CHALLENGE_SECONDS, AUTH_RETRY_SECONDS } from "../../shared/auth-contract.js";
import { NotificationChannel } from "../../shared/notification-contract.js";
import { REQUEST_ACCESS_TOKEN_SECONDS } from "../../shared/request-access-contract.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const LATER_ID = "44444444-4444-4444-8444-444444444444";
const PROTOCOL = "000123/2026";
const CPF = "52998224725";
const OTHER_CPF = "16899535009";
const EMAIL = "citizen@example.com";
const PHONE = "48999991234";
const ALL_CHANNELS = [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP, NotificationChannel.SMS];
const START = { municipalityId: MUNICIPALITY, cpf: "529.982.247-25", channel: NotificationChannel.EMAIL };
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const clientFetch = globalThis.fetch;

function accessRow(overrides = {}) {
  return {
    id: REQUEST_ID, municipality_id: MUNICIPALITY, municipality_active: true, tutor_id: null, protocol: PROTOCOL,
    request_type: "Castração", status: "NOVA", origin: "PUBLICA", created_at: new Date("2026-11-01T10:00:00Z"), updated_at: new Date("2026-11-02T10:00:00Z"),
    signed_at: new Date("2026-11-01T10:00:00Z"),
    schedule_date: "20/11/2026", schedule_location_name: "Unidade Municipal", schedule_address: "Rua das Flores, 10", schedule_address_url: "",
    schedule_municipality: "Test Town", municipality: "Test Town", responsible_unit: "", veterinarian: "",
    tutor_name: "Tutor Example", cpf: CPF, phone: PHONE, tutor_email: EMAIL, cep: "88000000", address: "Rua A, 1", neighborhood: "Centro", city: "Test Town", state: "SC",
    animals: [{ id: "animal-1", name: "Rex", species: "Cão", sex: "Macho", size: "Pequeno", breedType: "Indefinida", photo: "data:PRIVATE_PHOTO", requestTypeIds: ["castration"] }],
    workflow_data: { scheduleSlotTime: "09:00", requestTypeIds: ["castration"], requestTypeNames: ["Castração"], followUp: { enabled: true, email: EMAIL, phone: PHONE },
      internalNote: "PRIVATE_NOTE", assignedUserId: "PRIVATE_ASSIGNEE" },
    documents: [{ documentId: "identity", status: "attached", dataUrl: "data:PRIVATE_DOCUMENT", fileName: "PRIVATE_FILE.pdf", review: { note: "PRIVATE_REVIEW" } }],
    // Columns that must never reach the access view.
    notes: "PRIVATE_NOTES", history: [{ notes: "PRIVATE_HISTORY" }],
    ...overrides,
  };
}

// A later request of the same CPF, with the same contacts and reviewed documents.
const laterRow = (overrides = {}) => accessRow({ id: LATER_ID, protocol: "000140/2026", status: "AGENDADA", created_at: new Date("2026-11-05T10:00:00Z"),
  documents: [{ documentId: "identity", status: "approved" }, { documentId: "address", status: "rejected" }, { documentId: "other", status: "attached" }],
  ...overrides });

async function fixture(t, { rows = [accessRow()], profiles = [], channels = ALL_CHANNELS } = {}) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "request-access-tests-only";
  const requests = new Map(rows.map((row) => [row.id, row]));
  const challenges = new Map();
  const limits = new Map();
  const users = new Map();
  const calls = [];
  const deliveries = [];
  const scheduled = [];
  const audits = [];
  const animalLinks = [];
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
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("INSERT INTO animal_tutors")) {
      animalLinks.push(values);
      return { rows: [], rowCount: (requests.get(values[1])?.animals || []).length };
    }
    if (sql.includes("regexp_replace(COALESCE(r.cpf, '')")) {
      const [municipalityId, cpf, limit, offset] = values;
      const found = [...requests.values()]
        .filter((item) => item.municipality_id === municipalityId && String(item.cpf || "").replace(/\D/g, "") === cpf && item.municipality_active)
        .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)).slice(offset, offset + limit);
      return { rows: found.map((row) => project(row, sql)) };
    }
    if (sql.includes("WHERE r.id = $1 AND r.municipality_id = $2")) {
      const row = requests.get(values[0]);
      return { rows: row && row.municipality_id === values[1] && row.municipality_active ? [project(row, sql)] : [] };
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
    if (sql.includes("FROM tutor_profiles p JOIN users u")) {
      return { rows: profiles.some((profile) => profile.municipality_id === values[0] && profile.cpf === values[1]) ? [{ "?column?": 1 }] : [] };
    }
    if (sql.includes("INSERT INTO audit_logs")) { audits.push({ action: values[2], entityType: values[5], entityId: values[3], changes: JSON.parse(values[4]) }); return { rows: [] }; }
    if (sql.includes("INSERT INTO users")) {
      const id = randomUUID();
      users.set(id, { id, name: values[0], password: values[1], municipality_id: values[2], role: "tutor", email: null, must_change_password: sql.includes("FALSE") ? false : null, session_version: 0, active: true });
      return { rows: [{ id }] };
    }
    if (sql.includes("INSERT INTO tutor_profiles")) {
      const [user_id, municipality_id, cpf, email, phone, emailVerified, phoneVerified, address, neighborhood, city, state, cep] = values;
      profiles.push({ user_id, municipality_id, cpf, email, phone, emailVerified, phoneVerified, address, neighborhood, city, state, cep });
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE requests SET tutor_id")) {
      const row = requests.get(values[1]);
      if (row && row.municipality_id === values[2] && !row.tutor_id) row.tutor_id = values[0];
      return { rows: [] };
    }
    if (sql.includes("FROM users u LEFT JOIN municipalities m")) {
      const user = users.get(values[0]);
      const profile = profiles.find((item) => item.user_id === values[0]);
      return { rows: user ? [{ ...user, municipality_active: true, municipality_name: "Test Town", cpf: profile?.cpf, profile_email: profile?.email, profile_phone: profile?.phone, profile_version: 0 }] : [] };
    }
    throw new Error(`Unexpected access test SQL: ${sql}`);
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const channelReads = [];
  const router = createRequestAccessRouter({
    deliver: async (input) => { deliveries.push(input); return [{ purpose: input.purpose, channel: input.channel, status: "sent" }]; },
    schedule: (task) => { scheduled.push(task); },
    listChannels: async (municipalityId) => { channelReads.push(municipalityId); return channels; },
  });
  const app = express();
  app.use(express.json());
  app.use("/access", router);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query;
    pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.secret;
  });
  async function request(path, { method = "GET", body, token } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}/access${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
  }
  return {
    request, calls, challenges, deliveries, audits, users, profiles, animalLinks, requests, channelReads,
    channels: (municipalityId) => request(`/channels?municipalityId=${encodeURIComponent(municipalityId)}`),
    start: (body) => request("/challenges", { method: "POST", body }),
    confirm: (id, body) => request(`/challenges/${id}/confirm`, { method: "POST", body }),
    view: (token) => request("/request", { token }),
    createPassword: (token, password) => request("/password", { method: "POST", token, body: { password } }),
    flush: async () => { while (scheduled.length) await scheduled.shift()(); },
  };
}

const accessToken = (overrides = {}) => createAccessToken({ requestId: REQUEST_ID, municipalityId: MUNICIPALITY, channel: NotificationChannel.EMAIL,
  contact: accessContactDigest(NotificationChannel.EMAIL, EMAIL), cpfDigest: accessCpfDigest(CPF), ...overrides });

// A code sent for the request, with a known value.
function accessChallenge(f, code = "123456") {
  const challenge = { id: randomUUID(), request_id: REQUEST_ID, municipality_id: MUNICIPALITY, channel: NotificationChannel.EMAIL,
    expires_at: new Date(Date.now() + 600_000), attempts: 0, consumed_at: null, delivery: null };
  challenge.digest = trackingChallengeDigest(challenge, code, CPF, accessContactDigest(NotificationChannel.EMAIL, EMAIL));
  f.challenges.set(challenge.id, challenge);
  return challenge;
}

test("the channels offered depend only on the municipality, and a malformed municipality is refused", async (t) => {
  const f = await fixture(t, { channels: [NotificationChannel.SMS] });
  const response = await f.channels(MUNICIPALITY);
  assert.deepEqual([response.status, response.body], [200, { channels: [NotificationChannel.SMS] }]);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await f.channels("not-a-uuid")).status, 400);
  assert.deepEqual(f.channelReads, [MUNICIPALITY]);
  assert.equal(f.calls.length, 0);
});

test("only a CPF with a procedure request that has a contact of the chosen kind gets a code, and every other case answers alike", async (t) => {
  const rows = [
    accessRow(),
    accessRow({ id: randomUUID(), protocol: "000124/2026", cpf: OTHER_CPF, tutor_email: "" }),
    accessRow({ id: randomUUID(), protocol: "000126/2026", municipality_id: OTHER_MUNICIPALITY, municipality_active: false }),
    accessRow({ id: randomUUID(), protocol: "000128/2026", cpf: "111.444.777-35", request_type: "DENUNCIA" }),
  ];
  const f = await fixture(t, { rows });
  const bodies = [START, { ...START, cpf: OTHER_CPF }, { ...START, cpf: "11144477735" }, { ...START, cpf: "39053344705" }, { ...START, municipalityId: OTHER_MUNICIPALITY }];
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
  assert.deepEqual([...f.challenges.keys()], [responses[0].body.challengeId]);
  await f.flush();
  assert.equal(f.deliveries.length, 1);
  const [delivery] = f.deliveries;
  assert.equal(delivery.purpose, AuthPurpose.REQUEST_TRACKING, "the code is the message \"Acesso à solicitação\"");
  assert.deepEqual([delivery.municipalityId, delivery.channel, delivery.email, delivery.phone], [MUNICIPALITY, NotificationChannel.EMAIL, EMAIL, ""]);
  assert.match(delivery.code, /^\d{6}$/);
  for (const response of responses) assert.doesNotMatch(JSON.stringify(response.body), new RegExp(`${delivery.code}|${CPF}`));
});

test("the code goes to the most recent request of the CPF with a contact of the chosen kind, only by the chosen channel", async (t) => {
  const f = await fixture(t, { rows: [accessRow({ phone: "" }), laterRow({ tutor_email: "" })] });
  assert.equal((await f.start(START)).status, 200);
  assert.equal((await f.start({ ...START, channel: NotificationChannel.SMS })).status, 200);
  await f.flush();
  const [byEmail, bySms] = [...f.challenges.values()];
  assert.deepEqual([byEmail.request_id, byEmail.channel], [REQUEST_ID, NotificationChannel.EMAIL]);
  assert.deepEqual([bySms.request_id, bySms.channel], [LATER_ID, NotificationChannel.WHATSAPP], "the phone is kept as the kind of contact");
  assert.deepEqual(f.deliveries.map(({ channel, email, phone, challengeId }) => [channel, email, phone, challengeId]),
    [[NotificationChannel.EMAIL, EMAIL, "", byEmail.id], [NotificationChannel.SMS, "", PHONE, bySms.id]]);
});

test("a channel the municipality does not offer is refused and sends nothing", async (t) => {
  const f = await fixture(t, { channels: [NotificationChannel.EMAIL] });
  for (const channel of [NotificationChannel.WHATSAPP, NotificationChannel.SMS]) {
    const response = await f.start({ ...START, channel });
    assert.deepEqual([response.status, response.body.error], [400, "Escolha um canal disponível para receber o código."]);
  }
  assert.equal(f.challenges.size, 0);
  assert.equal((await f.start(START)).status, 200);
});

test("malformed start input is refused before any database operation", async (t) => {
  const f = await fixture(t);
  const invalid = [
    {}, { ...START, municipalityId: "not-a-uuid" }, { ...START, cpf: "11111111111" }, { ...START, cpf: "123" },
    { ...START, cpf: 52998224725 }, { ...START, cpf: `${CPF}${"0".repeat(20)}` }, { ...START, channel: "phone" }, { ...START, channel: undefined },
  ];
  for (const body of invalid) assert.equal((await f.start(body)).status, 400, JSON.stringify(body));
  assert.equal(f.calls.length, 0);
  assert.throws(() => readAccessStartInput({ ...START, channel: "__proto__" }), { status: 400 });
  assert.deepEqual(readAccessStartInput({ ...START, protocol: PROTOCOL }), { municipalityId: MUNICIPALITY, cpf: CPF, channel: NotificationChannel.EMAIL });
});

test("the resend cooldown answers a known and an unknown CPF alike", async (t) => {
  const f = await fixture(t);
  const unknown = { ...START, cpf: OTHER_CPF };
  assert.equal((await f.start(START)).status, 200);
  const known = await f.start(START);
  assert.equal((await f.start(unknown)).status, 200);
  const invented = await f.start(unknown);
  assert.equal(known.status, 429);
  assert.deepEqual(known.body, { error: "Aguarde para tentar novamente.", retryAfter: AUTH_RETRY_SECONDS });
  assert.deepEqual([invented.status, invented.body], [429, known.body]);
});

test("the code opens the requests only with the CPF again, and a wrong CPF spends an attempt", async (t) => {
  const f = await fixture(t);
  const challenge = accessChallenge(f);
  for (const cpf of [undefined, "", "123"]) assert.equal((await f.confirm(challenge.id, { code: "123456", cpf })).status, 400, String(cpf));
  assert.equal(f.challenges.get(challenge.id).attempts, 0, "a malformed CPF is refused before the code is looked at");
  const wrong = await f.confirm(challenge.id, { code: "123456", cpf: OTHER_CPF });
  assert.deepEqual([wrong.status, wrong.body.error], [400, "Código inválido ou expirado. Solicite um novo código."]);
  assert.equal(f.challenges.get(challenge.id).attempts, 1);
  assert.equal(f.challenges.get(challenge.id).consumed_at, null);
  const opened = await f.confirm(challenge.id, { code: "123456", cpf: CPF });
  assert.equal(opened.status, 200);
  assert.equal(opened.headers.get("cache-control"), "no-store");
  assert.equal(opened.body.expiresIn, REQUEST_ACCESS_TOKEN_SECONDS);
  assert.deepEqual(readAccessToken(opened.body.token), { requestId: REQUEST_ID, municipalityId: MUNICIPALITY, channel: NotificationChannel.EMAIL,
    contact: accessContactDigest(NotificationChannel.EMAIL, EMAIL), cpfDigest: accessCpfDigest(CPF), expiresAt: readAccessToken(opened.body.token).expiresAt });
  assert.equal(opened.body.token.includes(EMAIL), false);
  assert.equal((await f.confirm(challenge.id, { code: "123456", cpf: CPF })).status, 400, "a code is used once");
  assert.deepEqual(f.audits.map(({ action, entityType, entityId }) => [action, entityType, entityId]), [["REQUEST_ACCESS_GRANTED", "request", REQUEST_ID]]);
});

test("a wrong code and five failed attempts lock the challenge, even for the right CPF", async (t) => {
  const f = await fixture(t);
  const challenge = accessChallenge(f);
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await f.confirm(challenge.id, { code: "000000", cpf: CPF })).status, 400);
  assert.equal((await f.confirm(challenge.id, { code: "123456", cpf: CPF })).status, 400);
  assert.equal((await f.confirm(randomUUID(), { code: "123456", cpf: CPF })).status, 400);
});

test("an expired or forged access token is refused", async (t) => {
  const f = await fixture(t);
  const access = accessToken();
  const old = createAccessToken({ requestId: REQUEST_ID, municipalityId: MUNICIPALITY, channel: NotificationChannel.EMAIL, contact: "",
    cpfDigest: accessCpfDigest(CPF) }, Date.now() - (REQUEST_ACCESS_TOKEN_SECONDS + 1) * 1000);
  const sms = accessToken({ channel: NotificationChannel.SMS });
  const legacy = accessToken({ cpfDigest: undefined });
  for (const token of [old, sms, legacy, `${access}x`, access.replace(/^./, "A"), "", undefined]) {
    const response = await f.view(token);
    assert.deepEqual([response.status, response.body.error], [401, "Acesso expirado. Solicite um novo código."]);
  }
  assert.equal((await f.view(access)).status, 200);
});

test("the view lists the requests of the CPF that share the contact of the code, the most recent first, with where each stands", async (t) => {
  const rows = [
    accessRow(), laterRow(),
    accessRow({ id: randomUUID(), protocol: "000150/2026", tutor_email: "someone@example.com", created_at: new Date("2026-11-07T10:00:00Z") }),
    accessRow({ id: randomUUID(), protocol: "000151/2026", cpf: OTHER_CPF }),
    accessRow({ id: randomUUID(), protocol: "000152/2026", request_type: "DENUNCIA" }),
    accessRow({ id: randomUUID(), protocol: "000153/2026", municipality_id: OTHER_MUNICIPALITY }),
  ];
  const f = await fixture(t, { rows });
  const response = await f.view(accessToken());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(response.body.account, { exists: false });
  assert.deepEqual(response.body.requests.map(({ protocol }) => protocol), ["000140/2026", PROTOCOL]);
  const [later, first] = response.body.requests;
  assert.deepEqual([later.status, later.documents], ["AGENDADA", { total: 3, approved: 1, needsCorrection: 1, pending: 1 }]);
  assert.deepEqual(first.documents, { total: 1, approved: 0, needsCorrection: 0, pending: 1 });
  assert.equal(first.updated_at, "2026-11-02T10:00:00.000Z");
  assert.deepEqual([first.cpf, first.tutor_name, first.tutor_email, first.phone, first.origin], [CPF, "Tutor Example", EMAIL, PHONE, "PUBLICA"]);
  assert.equal(first.signed_at, "2026-11-01T10:00:00.000Z");
  assert.deepEqual(first.animals, [{ name: "Rex", species: "Cão", sex: "Macho", size: "Pequeno", breedType: "Indefinida", breedDescription: "", coat: "", birthDate: "",
    age: "", weight: "", dewormed: "", vaccinated: "", illnessHistory: "", food: "", hasChip: "", microchip: "", requestTypeIds: ["castration"] }]);
  assert.deepEqual(first.workflow_data, { scheduleSlotTime: "09:00", requestTypeIds: ["castration"], requestTypeNames: ["Castração"] });
  assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE|followUp|animal-1|history|notes|dataUrl|someone@/);
});

test("the view says when the CPF already has an account, or the request of the code already has its tutor", async (t) => {
  const f = await fixture(t, { rows: [accessRow(), accessRow({ id: "55555555-5555-4555-8555-555555555555", protocol: "000127/2026", cpf: OTHER_CPF, tutor_id: randomUUID() })],
    profiles: [{ user_id: randomUUID(), municipality_id: MUNICIPALITY, cpf: CPF }] });
  assert.deepEqual((await f.view(accessToken())).body.account, { exists: true });
  assert.deepEqual((await f.view(accessToken({ requestId: "55555555-5555-4555-8555-555555555555", cpfDigest: accessCpfDigest(OTHER_CPF) }))).body.account, { exists: true });
});

test("the latest 20 matching requests are returned even when more recent requests have a different contact", async (t) => {
  const rows = [accessRow(), ...Array.from({ length: 72 }, (_, index) => accessRow({
    id: randomUUID(), protocol: String(index), created_at: new Date(Date.UTC(2026, 10, index + 3)),
    tutor_email: index < 21 ? EMAIL : "other@example.com",
  }))];
  const f = await fixture(t, { rows });
  const response = await f.view(accessToken());
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.requests.map(({ protocol }) => protocol), Array.from({ length: 20 }, (_, index) => String(20 - index)));
});

test("the password creates the account from the request of the code, confirms only its contact, links the requests shown and signs in", async (t) => {
  const otherContact = accessRow({ id: randomUUID(), protocol: "000150/2026", tutor_email: "someone@example.com" });
  const f = await fixture(t, { rows: [accessRow(), laterRow(), otherContact] });
  assert.equal((await f.createPassword(accessToken(), "curta")).status, 400);
  assert.equal(f.users.size, 0);
  const response = await f.createPassword(accessToken(), "senha do tutor");
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(response.body.token);
  assert.deepEqual([response.body.user.role, response.body.user.cpf, response.body.user.email, response.body.user.mustChangePassword], ["tutor", CPF, EMAIL, false]);
  const [user] = [...f.users.values()];
  assert.equal(user.name, "Tutor Example");
  assert.equal(user.must_change_password, false);
  assert.equal(await bcrypt.compare("senha do tutor", user.password), true);
  const [profile] = f.profiles;
  assert.deepEqual([profile.cpf, profile.email, profile.phone, profile.emailVerified, profile.phoneVerified], [CPF, EMAIL, PHONE, true, false]);
  assert.deepEqual([profile.address, profile.neighborhood, profile.city, profile.state, profile.cep], ["Rua A, 1", "Centro", "Test Town", "SC", "88000000"]);
  assert.deepEqual([f.requests.get(REQUEST_ID).tutor_id, f.requests.get(LATER_ID).tutor_id, otherContact.tutor_id], [user.id, user.id, null]);
  assert.deepEqual(f.animalLinks.map((values) => values.slice(0, 3)), [[user.id, LATER_ID, MUNICIPALITY], [user.id, REQUEST_ID, MUNICIPALITY]]);
  assert.deepEqual(f.audits.at(-1), { action: "TUTOR_ACCOUNT_CREATED", entityType: "user", entityId: user.id,
    changes: { requestId: REQUEST_ID, linkedRequests: [LATER_ID, REQUEST_ID], confirmedChannel: NotificationChannel.EMAIL, linkedAnimals: 2 } });
  assert.doesNotMatch(JSON.stringify(f.audits), /senha|citizen@|52998224725/);
  const again = await f.createPassword(accessToken(), "outra senha");
  assert.deepEqual([again.status, again.body.error], [409, "Este CPF já tem acesso. Entre com seu CPF e sua senha."]);
  assert.equal(f.users.size, 1);
});

test("a changed contact or CPF invalidates the pending code and blocks an open access token", async (t) => {
  const f = await fixture(t);
  const request = f.requests.get(REQUEST_ID);
  const token = accessToken();
  for (const change of [{ tutor_email: "new@example.com" }, { cpf: OTHER_CPF }]) {
    const challenge = accessChallenge(f);
    Object.assign(request, { tutor_email: EMAIL, cpf: CPF }, change);
    assert.equal((await f.confirm(challenge.id, { code: "123456", cpf: request.cpf })).status, 400);
    assert.equal((await f.view(token)).status, 404);
    assert.equal((await f.createPassword(token, "senha do tutor")).status, 404);
  }
  assert.equal(f.users.size, 0);
  assert.equal(request.tutor_id, null);
});

test("a code sent to the phone confirms only the phone", async (t) => {
  const f = await fixture(t);
  const token = accessToken({ channel: NotificationChannel.WHATSAPP, contact: accessContactDigest(NotificationChannel.WHATSAPP, PHONE) });
  assert.equal((await f.createPassword(token, "senha do tutor")).status, 201);
  assert.deepEqual([f.profiles[0].emailVerified, f.profiles[0].phoneVerified], [false, true]);
});

test("a CPF that already has an account creates nothing and links nothing", async (t) => {
  const f = await fixture(t, { profiles: [{ user_id: randomUUID(), municipality_id: MUNICIPALITY, cpf: CPF }] });
  assert.equal((await f.createPassword(accessToken(), "senha do tutor")).status, 409);
  assert.equal(f.users.size, 0);
  assert.equal(f.calls.some(({ sql }) => sql.includes("INSERT INTO users") || sql.startsWith("UPDATE requests SET tutor_id") || sql.includes("INSERT INTO animal_tutors")), false);
});

test("a request that already has its tutor is never taken over by a new account", async (t) => {
  const f = await fixture(t, { rows: [accessRow({ tutor_id: randomUUID() })] });
  assert.equal((await f.createPassword(accessToken(), "senha do tutor")).status, 409);
  assert.equal(f.users.size, 0);
});

test("the whole first access: code by SMS, CPF and code, the requests, then the password", async (t) => {
  const f = await fixture(t);
  const started = await f.start({ ...START, channel: NotificationChannel.SMS });
  await f.flush();
  assert.deepEqual([f.deliveries[0].channel, f.deliveries[0].phone], [NotificationChannel.SMS, PHONE]);
  const confirmed = await f.confirm(started.body.challengeId, { code: f.deliveries[0].code, cpf: START.cpf });
  assert.equal(confirmed.status, 200);
  const opened = await f.view(confirmed.body.token);
  assert.deepEqual([opened.body.requests.map(({ protocol }) => protocol), opened.body.account.exists], [[PROTOCOL], false]);
  assert.equal((await f.createPassword(confirmed.body.token, "senha do tutor")).status, 201);
  assert.deepEqual([f.profiles[0].emailVerified, f.profiles[0].phoneVerified], [false, true]);
  assert.equal((await f.view(confirmed.body.token)).body.account.exists, true);
});
