import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import authRouter from "../../src/routes/auth.js";
import { auth } from "../../src/middleware/auth.js";
import { pool } from "../../src/db/index.js";
import { issueSession } from "../../src/services/auth/auth-session.js";
import { AuthPurpose } from "../../../shared/auth-contract.js";
import { createChallenge } from "../../src/repositories/auth-challenges.js";

export const AUTH_TEST_MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
export const AUTH_TEST_OTHER_MUNICIPALITY = "22222222-2222-4222-8222-222222222222";
export const AUTH_TEST_PASSWORD = "current password for tests";
const hash = await bcrypt.hash(AUTH_TEST_PASSWORD, 4);
const clientFetch = globalThis.fetch;

// A configured platform e-mail account, one template per use and an e-mail contract for the test municipality, so the e-mail path of the auth routes can run end to end.
function emailConfigs() {
  const templates = Object.fromEntries(Object.values(AuthPurpose).map((purpose) => [purpose, `test-${purpose}`]));
  return {
    "email_account:null": { serviceId: "test-service", publicKey: "test-public", privateKey: "", privateKeyPreview: "", publicUrl: "" },
    "email_templates:null": { templates },
    [`email_quota:${AUTH_TEST_MUNICIPALITY}`]: { plan: 1000 },
  };
}

export function authUser(overrides = {}) {
  return { id: randomUUID(), name: "Test Tutor", role: "tutor", email: null, password: hash, active: true,
    municipality_id: AUTH_TEST_MUNICIPALITY, municipality_name: "Test City", municipality_active: true,
    session_version: 0, must_change_password: false, cpf: "52998224725", profile_email: "tutor@example.test",
    profile_phone: "", email_verified_at: null, phone_verified_at: null, profile_version: 0, ...overrides };
}

export async function authHttpFixture(t, initialUsers = [authUser()], { failAudit = false, emailEnabled = false, configs = {} } = {}) {
  const original = { query: pool.query, connect: pool.connect, fetch: globalThis.fetch };
  const environment = ["JWT_SECRET", "ADMIN_EMAIL"];
  const originalEnvironment = Object.fromEntries(environment.map((key) => [key, process.env[key]]));
  process.env.JWT_SECRET = "auth-http-tests-only";
  process.env.ADMIN_EMAIL = "staff@example.test";
  const storedConfigs = { ...(emailEnabled ? emailConfigs() : {}), ...configs };
  const users = new Map(initialUsers.map((user) => [user.id, structuredClone(user)]));
  const challenges = new Map(); const limits = new Map(); const calls = []; const followUps = []; const requestRows = []; const animalTutorUpdates = [];
  let tail = Promise.resolve();
  let externalCalls = 0;
  const messages = [];
  function connection(source) {
    let unlock; let snapshot;
    return { release() { if (unlock) throw new Error("Unclosed test transaction"); }, query: async (sql, values = []) => {
      calls.push({ sql, values, source });
      if (sql === "BEGIN") {
        const previous = tail; const held = new Promise((resolve) => { unlock = resolve; }); tail = previous.then(() => held);
        await previous; snapshot = { users: structuredClone([...users]), challenges: structuredClone([...challenges]), followUps: structuredClone(followUps) };
        return { rows: [] };
      }
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        if (sql === "ROLLBACK") {
          users.clear(); snapshot.users.forEach(([id, user]) => users.set(id, user));
          challenges.clear(); snapshot.challenges.forEach(([id, challenge]) => challenges.set(id, challenge));
          followUps.splice(0, followUps.length, ...snapshot.followUps);
        }
        unlock?.(); unlock = undefined; return { rows: [] };
      }
      if (sql.includes("FROM users u LEFT JOIN municipalities m")) {
        let result = [...users.values()];
        if (sql.includes("WHERE u.id = $1")) result = result.filter((user) => user.id === values[0] && (!values[1] || user.municipality_id === values[1]));
        else if (sql.includes("u.role = 'tutor'")) result = result.filter((user) => user.role === "tutor" && user.municipality_id === values[0]
          && (user.cpf === values[1] || user.profile_email?.toLowerCase() === values[2]));
        else result = result.filter((user) => user.role !== "tutor" && user.email?.toLowerCase() === values[0]);
        return { rows: structuredClone(result) };
      }
      if (sql.startsWith("SELECT * FROM users WHERE lower(email)")) return { rows: structuredClone([...users.values()].filter((user) => user.email?.toLowerCase() === values[0])) };
      if (sql.includes("SELECT p.*, u.name FROM tutor_profiles")) {
        const user = users.get(values[0]);
        return { rows: user?.role === "tutor" && user.municipality_id === values[1] ? [{ user_id: user.id, name: user.name,
          municipality_id: user.municipality_id, cpf: user.cpf, email: user.profile_email, phone: user.profile_phone,
          email_verified_at: user.email_verified_at, phone_verified_at: user.phone_verified_at, version: user.profile_version }] : [] };
      }
      if (sql.startsWith("INSERT INTO auth_rate_limits")) {
        const previous = limits.get(values[0]); const attempts = previous && previous.expires > values[1] ? previous.attempts + 1 : 1;
        limits.set(values[0], { attempts, expires: values[2] }); return { rows: [{ attempts }] };
      }
      if (sql.startsWith("DELETE FROM auth_rate_limits") || sql.startsWith("DELETE FROM auth_challenges")) return { rows: [] };
      if (sql.includes("INSERT INTO auth_challenges")) {
        challenges.set(values[0], { id: values[0], user_id: values[1], municipality_id: values[2], audience: values[3], purpose: values[4],
          destination: values[5], digest: values[6], session_version: values[7], profile_version: values[8], expires_at: values[9], attempts: 0, consumed_at: null });
        return { rows: [] };
      }
      if (sql.startsWith("SELECT * FROM auth_challenges")) return { rows: challenges.has(values[0]) ? [structuredClone(challenges.get(values[0]))] : [] };
      if (sql.startsWith("UPDATE auth_challenges SET attempts")) {
        const challenge = challenges.get(values[0]); challenge.attempts += 1; if (values[1]) challenge.consumed_at = values[2]; return { rows: [] };
      }
      if (sql.startsWith("UPDATE auth_challenges SET consumed_at")) {
        const issuing = sql.includes("user_id = $2 AND purpose = $3");
        for (const challenge of challenges.values()) {
          if (challenge.user_id === values[issuing ? 1 : 0] && (!issuing || challenge.purpose === values[2]) && !challenge.consumed_at) challenge.consumed_at = new Date();
        }
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE auth_challenges SET delivery")) { challenges.get(values[0]).delivery = JSON.parse(values[1]); return { rows: [] }; }
      if (sql.startsWith("UPDATE users SET password = $1")) {
        const user = users.get(values[2]); Object.assign(user, { password: values[0], must_change_password: values[1], session_version: user.session_version + 1 });
        return { rows: [structuredClone(user)] };
      }
      if (sql.startsWith("UPDATE users SET last_login = NOW()")) { users.get(values[0]).last_login = new Date(); return { rows: [] }; }
      if (sql.startsWith("UPDATE users SET name=$1")) {
        const user = users.get(values[5]); Object.assign(user, { name: values[0], email: values[1], password: values[2], role: values[3], active: values[4], session_version: user.session_version + 1 });
        const { id, name, email, role, municipality_id, active } = user; return { rows: [{ id, name, email, role, municipality_id, active }] };
      }
      if (sql.startsWith("SELECT id, tutor_id, cpf, tutor_name")) {
        const row = requestRows.find((request) => request.id === values[0] && request.municipality_id === values[1]);
        return { rows: row ? [structuredClone(row)] : [] };
      }
      if (sql.includes("FROM users u JOIN tutor_profiles p")) {
        const user = [...users.values()].find((item) => item.role === "tutor" && (values.length === 1 ? item.id === values[0]
          : item.municipality_id === values[0] && (item.id === values[1] || item.cpf === values[2])));
        return { rows: user ? [{ id: user.id, name: user.name, active: user.active, cpf: user.cpf, email: user.profile_email, phone: user.profile_phone,
          email_verified_at: user.email_verified_at, phone_verified_at: user.phone_verified_at, address: user.address, neighborhood: user.neighborhood,
          city: user.city, state: user.state, cep: user.cep }] : [] };
      }
      if (sql.startsWith("SELECT address, neighborhood, city, state, cep FROM requests")) return { rows: [] };
      if (sql.startsWith("UPDATE users SET name = $2")) { users.get(values[0]).name = values[1]; return { rows: [] }; }
      if (sql.startsWith("UPDATE tutor_profiles SET email = $3, phone = $4")) {
        const user = users.get(values[0]); assertMunicipality(user, values[1]);
        Object.assign(user, { profile_email: values[2], profile_phone: values[3], address: values[4], neighborhood: values[5], city: values[6], state: values[7], cep: values[8] });
        if (values[9]) user.email_verified_at = new Date(); if (values[10]) user.phone_verified_at = new Date(); user.profile_version += 1;
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE requests SET tutor_name") && sql.includes("tutor_id IS NULL")) {
        const request = requestRows.find((row) => row.municipality_id === values[0] && row.id === values[1] && !row.tutor_id && !row.cpf);
        if (!request) return { rows: [] };
        Object.assign(request, {
          tutor_name: values[2], tutor_email: values[3], phone: values[4], address: values[5], neighborhood: values[6],
          city: values[7], state: values[8], cep: values[9], workflow_data: { ...request.workflow_data, ...JSON.parse(values[10]) },
        });
        return { rows: [structuredClone(request)] };
      }
      if (sql.startsWith("UPDATE requests SET tutor_name")) {
        for (const request of requestRows) if (request.municipality_id === values[0] && ((["NOVA", "AGENDADA"].includes(request.status)
          && (request.tutor_id === values[1] || request.cpf === values[10])) || (values[11] && request.id === values[11]))) Object.assign(request, { tutor_name: values[2], tutor_email: values[3], phone: values[4], address: values[5], neighborhood: values[6], city: values[7], state: values[8], cep: values[9] });
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE animal_tutors")) { animalTutorUpdates.push(values); return { rows: [] }; }
      if (sql.startsWith("UPDATE requests SET workflow_data") && sql.includes("cpf = $4")) {
        const kind = sql.includes("{followUp,email}") ? "email" : "phone";
        for (const request of requestRows) if (request.municipality_id === values[0] && (request.tutor_id === values[1] || request.cpf === values[3])
          && ["NOVA", "AGENDADA"].includes(request.status) && request.workflow_data?.followUp?.enabled === true) request.workflow_data.followUp[kind] = values[2];
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE tutor_profiles SET")) {
        const user = users.get(values[0]); const kind = sql.includes("SET email") ? "email" : "phone";
        assertMunicipality(user, values[1]); user[`profile_${kind}`] = values[2]; user[`${kind}_verified_at`] = new Date(); user.profile_version += 1;
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE requests SET workflow_data")) {
        const kind = sql.includes("{followUp,email}") ? "email" : "phone";
        for (const request of followUps) if (request.tutor_id === values[0] && request.municipality_id === values[1]
          && ["NOVA", "AGENDADA"].includes(request.status) && request.workflow_data.followUp.enabled === true) request.workflow_data.followUp[kind] = values[2];
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO audit_logs")) { if (failAudit) throw new Error("Simulated required audit failure"); return { rows: [] }; }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (sql.includes("INSERT INTO config")) { storedConfigs[`${values[0]}:${values[1]}`] = JSON.parse(values[2]); return { rows: [] }; }
      if (sql.startsWith("SELECT value FROM config")) return { rows: storedConfigs[`${values[0]}:${values[1]}`] ? [{ value: storedConfigs[`${values[0]}:${values[1]}`] }] : [] };
      if (sql.includes("FROM municipalities WHERE id = $1")) return { rows: [{ id: values[0], name: "Test City", department_name: "Test Department", contact: "", email: "", address: "", updated_at: new Date(0), has_brasao: false, has_department_logo: false }] };
      throw new Error(`Unhandled auth fixture SQL: ${sql}`);
    } };
  }
  pool.query = connection("pool").query;
  pool.connect = async () => connection("client");
  globalThis.fetch = async (url, options) => {
    if (emailEnabled && url === "https://api.emailjs.com/api/v1.0/email/send") {
      messages.push(JSON.parse(options.body)); return { ok: true };
    }
    externalCalls += 1; throw new Error("External transport forbidden");
  };
  const app = express(); app.use(express.json()); app.use("/auth", authRouter);
  app.get("/protected", auth, (req, res) => res.json({ id: req.user.id, municipalityId: req.user.municipalityId }));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = original.query; pool.connect = original.connect; globalThis.fetch = original.fetch;
    for (const key of environment) { if (originalEnvironment[key] === undefined) delete process.env[key]; else process.env[key] = originalEnvironment[key]; }
    if (externalCalls) throw new Error("Auth test attempted external transport");
  });
  async function request(path, { method = "GET", body, token } = {}) {
    const response = await clientFetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), cacheControl: response.headers.get("cache-control") };
  }
  return { request, users, challenges, limits, calls, followUps, requestRows, animalTutorUpdates, messages, token: (user) => issueSession(users.get(user.id || user)).token,
    challenge: (user, purpose, destination) => createChallenge({ query: pool.query }, { user: users.get(user.id || user), purpose, destination }) };
}

function assertMunicipality(user, municipalityId) {
  if (!user || user.municipality_id !== municipalityId) throw new Error("Fixture detected cross-tenant update");
}
