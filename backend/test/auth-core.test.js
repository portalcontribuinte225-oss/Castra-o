import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { AuthAudience, AuthPurpose, validateNewPassword } from "../../shared/auth-contract.js";
import { issueSession, verifySession } from "../src/services/auth/auth-session.js";
import { enrollTutorForRequest } from "../src/services/auth/tutor-enrollment.js";
import { createChallenge, consumeChallenge } from "../src/repositories/auth-challenges.js";
import { consumeAuthLimit, allowAuthAttempt } from "../src/repositories/auth-limits.js";
import { authRequestContext } from "../src/services/auth/session-handlers.js";
import { findLoginCandidates } from "../src/repositories/auth-users.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
const CPF = "52998224725";
const CURRENT_PASSWORD = "current password for tests";
const HASH = await bcrypt.hash(CURRENT_PASSWORD, 4);
const userRow = (overrides = {}) => ({ id: randomUUID(), name: "Tutor Test", role: AuthAudience.TUTOR,
  password: HASH, municipality_id: MUNICIPALITY, municipality_active: true, active: true,
  must_change_password: false, session_version: 0, cpf: CPF, profile_version: 0, ...overrides });

function useSecret(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "auth-unit-tests-only";
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
}

test("new password policy permits spaces and rejects bcrypt UTF-8 truncation", () => {
  assert.notEqual(validateNewPassword("x".repeat(14)), "");
  assert.equal(validateNewPassword("long phrase with spaces"), "");
  assert.equal(validateNewPassword("á".repeat(36)), "");
  assert.notEqual(validateNewPassword("á".repeat(37)), "");
  assert.notEqual(validateNewPassword("😀".repeat(8)), "");
  assert.equal(validateNewPassword("😀".repeat(15)), "");
});

test("session requires current password revision, role, municipality and active account", async (t) => {
  useSecret(t);
  const user = userRow();
  const { token } = issueSession(user);
  assert.equal((await verifySession(token, { loadUser: async () => user })).id, user.id);
  for (const changed of [
    { password: "another-hash" }, { session_version: 1 }, { role: "master" },
    { municipality_id: OTHER_MUNICIPALITY }, { active: false }, { municipality_active: false }, { cpf: null },
  ]) {
    await assert.rejects(verifySession(token, { loadUser: async () => ({ ...user, ...changed }) }), { status: 401 });
  }
});

test("first password ticket is restricted server-side and cannot survive completing the change", async (t) => {
  useSecret(t);
  const user = userRow({ must_change_password: true });
  const { token, user: dto } = issueSession(user);
  assert.equal(dto.mustChangePassword, true);
  await assert.rejects(verifySession(token, { loadUser: async () => user }), { status: 403, code: "PASSWORD_CHANGE_REQUIRED" });
  assert.equal((await verifySession(token, { allowRestricted: true, loadUser: async () => user })).id, user.id);
  await assert.rejects(verifySession(token, { allowRestricted: true, loadUser: async () => ({ ...user, must_change_password: false }) }), { status: 401 });
});

test("identifier normalization does not interpret email digits as CPF and malformed municipalities fail before queries", async () => {
  assert.throws(() => authRequestContext({ body: { audience: AuthAudience.TUTOR, municipalityId: "-".repeat(36), identifier: CPF } }), { status: 400 });
  assert.equal(authRequestContext({ body: { audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, identifier: "529.982.247-25" } }).identifier, CPF);
  const queries = [];
  await findLoginCandidates({ audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, identifier: "52998224725@example.test" }, {
    query: async (sql, values) => { queries.push({ sql, values }); return { rows: [] }; },
  });
  assert.deepEqual(queries[0].values, [MUNICIPALITY, "", "52998224725@example.test"]);
});

function enrollmentStore() {
  const profiles = new Map();
  const users = new Map();
  let tail = Promise.resolve();
  const calls = [];
  async function run(input) {
    let unlock;
    const client = { query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("INSERT INTO auth_rate_limits")) return { rows: [{ attempts: 1 }] };
      if (sql.startsWith("DELETE FROM auth_rate_limits")) return { rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) {
        const previous = tail;
        const held = new Promise((resolve) => { unlock = resolve; });
        tail = previous.then(() => held);
        await previous;
        return { rows: [] };
      }
      if (sql.startsWith("SELECT user_id FROM tutor_profiles")) {
        const profile = profiles.get(`${values[0]}:${values[1]}`);
        return { rows: profile ? [{ user_id: profile.user_id }] : [] };
      }
      if (sql.startsWith("SELECT cpf FROM tutor_profiles")) {
        const profile = [...profiles.values()].find((row) => row.user_id === values[0] && row.municipality_id === values[1]);
        return { rows: profile ? [{ cpf: profile.cpf }] : [] };
      }
      if (sql.includes("INSERT INTO users")) {
        const id = randomUUID(); users.set(id, { id, name: values[0], password: values[1], municipality_id: values[2], email: null });
        return { rows: [{ id }] };
      }
      if (sql.includes("INSERT INTO tutor_profiles")) {
        profiles.set(`${values[1]}:${values[2]}`, { user_id: values[0], municipality_id: values[1], cpf: values[2], email: values[3], phone: values[4] });
        return { rows: [] };
      }
      throw new Error("Unexpected enrollment SQL");
    } };
    try { return await enrollTutorForRequest(client, input); }
    finally { unlock?.(); }
  }
  return { run, profiles, users, calls };
}

const enrollmentInput = (overrides = {}) => ({ body: { cpf: CPF, tutor_name: "Tutor Test" },
  workflow: { followUp: { enabled: false } }, municipalityId: MUNICIPALITY, tutorRequired: true, ...overrides });

test("concurrent municipal enrollment shows one password and a repeat never claims the existing account", async (t) => {
  useSecret(t);
  const store = enrollmentStore();
  const results = await Promise.all([store.run(enrollmentInput()), store.run(enrollmentInput())]);
  assert.equal(results.filter((result) => result.enrollment).length, 1);
  assert.equal(results.filter((result) => result.tutorId === null).length, 1);
  assert.equal(store.users.size, 1);
  const created = results.find((result) => result.enrollment);
  assert.equal(await bcrypt.compare(created.enrollment.temporaryPassword, store.users.get(created.tutorId).password), true);
  assert.equal(JSON.stringify([...store.users.values()]).includes(created.enrollment.temporaryPassword), false);
  assert.equal((await store.run(enrollmentInput({ municipalityId: OTHER_MUNICIPALITY }))).enrollment.cpf, CPF);
  assert.equal(store.users.size, 2);
});

test("no-Tutor and internal residual fields create no identity; own authenticated tutor must match profile CPF", async (t) => {
  useSecret(t);
  const store = enrollmentStore();
  assert.deepEqual(await store.run(enrollmentInput({ tutorRequired: false })), { tutorId: null });
  assert.deepEqual(await store.run(enrollmentInput({ user: { id: randomUUID(), role: "analista" } })), { tutorId: null });
  assert.equal(store.calls.length, 0);
  await assert.rejects(store.run(enrollmentInput({ body: { cpf: CPF, tutor_name: "" } })), { status: 400 });
  const created = await store.run(enrollmentInput());
  assert.deepEqual(await store.run(enrollmentInput({ user: { id: created.tutorId, role: AuthAudience.TUTOR } })), { tutorId: created.tutorId });
  await assert.rejects(store.run(enrollmentInput({ body: { cpf: "11111111111" }, user: { id: created.tutorId, role: AuthAudience.TUTOR } })), { status: 403 });
});

test("new enrollment saves unverified contacts without fictitious login email or verification flags", async (t) => {
  useSecret(t);
  const store = enrollmentStore();
  const created = await store.run(enrollmentInput({ workflow: { followUp: { enabled: true, email: "family@example.test", phone: "48999991234" } } }));
  const profile = store.profiles.get(`${MUNICIPALITY}:${CPF}`);
  assert.equal(store.users.get(created.tutorId).email, null);
  assert.equal(profile.email, "family@example.test");
  assert.equal(profile.email_verified_at, undefined);
  assert.equal(profile.phone_verified_at, undefined);
});

function challengeStore() {
  let row;
  const calls = [];
  const database = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("INSERT INTO auth_challenges")) {
      row = { id: values[0], user_id: values[1], municipality_id: values[2], audience: values[3], purpose: values[4],
        destination: values[5], digest: values[6], session_version: values[7], profile_version: values[8], expires_at: values[9], attempts: 0, consumed_at: null };
    }
    if (sql.startsWith("UPDATE auth_challenges SET attempts")) {
      row.attempts += 1;
      if (values[1]) row.consumed_at = values[2];
    }
    return { rows: [] };
  } };
  return { database, calls, row: () => row };
}

test("challenge digest contains no plaintext code and is bound to purpose, account, municipality and password", async (t) => {
  useSecret(t);
  const user = userRow(); const store = challengeStore();
  const now = new Date("2026-11-13T12:00:00Z");
  const { code } = await createChallenge(store.database, { user, purpose: AuthPurpose.VERIFY_EMAIL, destination: "new@example.test", now });
  assert.equal(JSON.stringify(store.calls).includes(`"${code}"`), false);
  const input = { challenge: store.row(), user, code, purpose: AuthPurpose.VERIFY_EMAIL, audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, now };
  assert.equal(await consumeChallenge(store.database, { ...input, purpose: AuthPurpose.PASSWORD_RESET }), false);
  assert.equal(await consumeChallenge(store.database, { ...input, municipalityId: OTHER_MUNICIPALITY }), false);
  assert.equal(await consumeChallenge(store.database, { ...input, user: { ...user, password: "changed-by-bootstrap" } }), false);
  assert.equal(await consumeChallenge(store.database, input), true);
  assert.equal(await consumeChallenge(store.database, input), false);
});

test("challenge expiry and five wrong attempts cannot be bypassed by another confirmation", async (t) => {
  useSecret(t);
  const user = userRow(); const store = challengeStore(); const now = new Date("2026-11-13T12:00:00Z");
  const { code } = await createChallenge(store.database, { user, purpose: AuthPurpose.PASSWORD_RESET, now });
  const input = { challenge: store.row(), user, code, purpose: AuthPurpose.PASSWORD_RESET, audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, now };
  assert.equal(await consumeChallenge(store.database, { ...input, now: new Date(now.getTime() + 600_001) }), false);
  const wrongCode = code === "111111" ? "222222" : "111111";
  for (let count = 0; count < 5; count += 1) assert.equal(await consumeChallenge(store.database, { ...input, code: wrongCode }), false);
  assert.equal(store.row().attempts, 5);
  assert.equal(await consumeChallenge(store.database, input), false);
});

test("persistent limits cover unknown identities and bound new identifier rows after origin lockout", async (t) => {
  useSecret(t);
  const rows = new Map();
  const database = { query: async (sql, values) => {
    if (sql.startsWith("INSERT INTO auth_rate_limits")) {
      const previous = rows.get(values[0]);
      const attempts = previous && previous.expires > values[1] ? previous.attempts + 1 : 1;
      rows.set(values[0], { attempts, expires: values[2] });
      return { rows: [{ attempts }] };
    }
    return { rows: [] };
  } };
  const now = new Date("2026-11-13T12:00:00Z");
  assert.equal(await consumeAuthLimit(["code", "user", CPF], { database, limit: 1, now }), true);
  assert.equal(await consumeAuthLimit(["code", "user", CPF], { database, limit: 1, now }), false);
  for (let count = 0; count < 8; count += 1) await allowAuthAttempt({ purpose: "login", audience: AuthAudience.TUTOR,
    identifier: `unknown-${count}`, municipalityId: MUNICIPALITY, ip: "127.0.0.1" }, { database, limit: 1, now });
  assert.equal(rows.size, 7); // one code key, one origin key, and five admitted identifier keys
  assert.equal([...rows.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)), true);
});
