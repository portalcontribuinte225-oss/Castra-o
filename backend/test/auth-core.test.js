import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { AuthAudience, AuthPurpose, validateNewPassword } from "../../shared/auth-contract.js";
import { issueSession, verifySession } from "../src/services/auth/auth-session.js";
import { resolveRequestTutor } from "../src/services/auth/request-tutor.js";
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
  assert.notEqual(validateNewPassword("x".repeat(5)), "");
  assert.equal(validateNewPassword("123456"), "");
  assert.equal(validateNewPassword("abcdef"), "");
  assert.equal(validateNewPassword("long phrase with spaces"), "");
  assert.equal(validateNewPassword("á".repeat(36)), "");
  assert.notEqual(validateNewPassword("á".repeat(37)), "");
  assert.notEqual(validateNewPassword("😀".repeat(5)), "");
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

function profileClient(profiles) {
  const calls = [];
  return { calls, query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT cpf FROM tutor_profiles")) {
      const profile = profiles.find((row) => row.user_id === values[0] && row.municipality_id === values[1]);
      return { rows: profile ? [{ cpf: profile.cpf }] : [] };
    }
    throw new Error("Unexpected SQL");
  } };
}

test("sending a request creates no account: only a logged tutor links it, with the CPF of their own profile", async () => {
  const tutorId = randomUUID();
  const client = profileClient([{ user_id: tutorId, municipality_id: MUNICIPALITY, cpf: CPF }]);
  for (const user of [undefined, null, { id: randomUUID(), role: "analista" }, { id: randomUUID(), role: "admin_municipal" }]) {
    assert.equal(await resolveRequestTutor(client, { cpf: CPF, municipalityId: MUNICIPALITY, user }), null);
  }
  assert.equal(client.calls.length, 0, "without a logged tutor nothing is read nor written");
  const tutor = { id: tutorId, role: AuthAudience.TUTOR };
  assert.equal(await resolveRequestTutor(client, { cpf: "529.982.247-25", municipalityId: MUNICIPALITY, user: tutor }), tutorId);
  await assert.rejects(resolveRequestTutor(client, { cpf: "16899535009", municipalityId: MUNICIPALITY, user: tutor }), { status: 403 });
  await assert.rejects(resolveRequestTutor(client, { cpf: CPF, municipalityId: OTHER_MUNICIPALITY, user: tutor }), { status: 403 });
  assert.equal(client.calls.every(({ sql }) => sql.startsWith("SELECT cpf FROM tutor_profiles")), true);
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
