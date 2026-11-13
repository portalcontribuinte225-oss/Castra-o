import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { AuthAudience, AuthPurpose } from "../../shared/auth-contract.js";
import { authHttpFixture, authUser, AUTH_TEST_MUNICIPALITY as MUNICIPALITY, AUTH_TEST_OTHER_MUNICIPALITY as OTHER,
  AUTH_TEST_PASSWORD as PASSWORD } from "./fixtures/auth-http.js";

test("tutor CPF login is municipal and profile email never promotes an institutional role", async (t) => {
  const tutor = authUser({ profile_email: "staff@example.test" });
  const staff = authUser({ role: "analista", email: "staff@example.test", cpf: null, profile_email: null });
  const { request } = await authHttpFixture(t, [tutor, staff]);
  const result = await request("/auth/login", { method: "POST", body: { audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, identifier: tutor.cpf, password: PASSWORD } });
  assert.equal(result.status, 200); assert.equal(result.body.user.role, "tutor"); assert.equal(result.cacheControl, "no-store");
  assert.equal(JSON.stringify(result.body).includes(tutor.password), false);
  const wrongMunicipality = await request("/auth/login", { method: "POST", body: { audience: AuthAudience.TUTOR, municipalityId: OTHER, identifier: tutor.cpf, password: PASSWORD } });
  assert.equal(wrongMunicipality.status, 401);
  const staffLogin = await request("/auth/login", { method: "POST", body: { audience: AuthAudience.STAFF, identifier: staff.email, password: PASSWORD } });
  assert.equal(staffLogin.status, 200); assert.equal(staffLogin.body.user.role, "analista");
});

test("shared, absent and wrong-password tutor email attempts return indistinguishable failures", async (t) => {
  const users = [authUser({ profile_email: "family@example.test" }), authUser({ profile_email: "family@example.test", cpf: "11144477735" }), authUser({ profile_email: "single@example.test" })];
  const { request } = await authHttpFixture(t, users);
  const results = [];
  for (const email of ["family@example.test", "absent@example.test", "single@example.test"]) results.push(await request("/auth/login", {
    method: "POST", body: { audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, identifier: email, password: "incorrect password" },
  }));
  assert.equal(results.every(({ status }) => status === 401), true);
  assert.deepEqual(results[0].body, results[1].body); assert.deepEqual(results[1].body, results[2].body);
});

test("first-change ticket can bootstrap and change password but cannot enter protected routes", async (t) => {
  const user = authUser({ must_change_password: true }); const { request, token } = await authHttpFixture(t, [user]);
  const oldToken = token(user);
  assert.equal((await request("/auth/me", { token: oldToken })).body.user.mustChangePassword, true);
  assert.equal((await request("/protected", { token: oldToken })).status, 403);
  const changed = await request("/auth/change-password", { method: "POST", token: oldToken, body: { currentPassword: PASSWORD, password: "new long password for tutor" } });
  assert.equal(changed.status, 200); assert.equal(changed.body.user.mustChangePassword, false);
  assert.equal((await request("/protected", { token: oldToken })).status, 401);
  assert.equal((await request("/protected", { token: changed.body.token })).status, 200);
});

test("only one concurrent reset consumes a code and previous sessions are revoked", async (t) => {
  const user = authUser(); const fixture = await authHttpFixture(t, [user]); const oldToken = fixture.token(user);
  const pending = await fixture.challenge(user, AuthPurpose.PASSWORD_RESET);
  const results = await Promise.all([1, 2].map(() => fixture.request("/auth/reset-password", { method: "POST", body: {
    audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, challengeId: pending.challenge.id, code: pending.code, password: "new reset password phrase",
  } })));
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 400]);
  assert.equal(fixture.users.get(user.id).session_version, 1);
  assert.equal((await fixture.request("/protected", { token: oldToken })).status, 401);
});

test("contact confirmation updates only opted-in active requests owned by this municipal tutor", async (t) => {
  const user = authUser({ email_verified_at: new Date() }); const fixture = await authHttpFixture(t, [user]); const token = fixture.token(user);
  fixture.followUps.push(...[
    { tutor_id: user.id, municipality_id: MUNICIPALITY, status: "NOVA", workflow_data: { followUp: { enabled: true, email: "old@example.test" } } },
    { tutor_id: user.id, municipality_id: MUNICIPALITY, status: "NOVA", workflow_data: { followUp: { enabled: false, email: "refused@example.test" } } },
    { tutor_id: user.id, municipality_id: OTHER, status: "NOVA", workflow_data: { followUp: { enabled: true, email: "other-city@example.test" } } },
    { tutor_id: "another-user", municipality_id: MUNICIPALITY, status: "AGENDADA", workflow_data: { followUp: { enabled: true, email: "other-user@example.test" } } },
    { tutor_id: user.id, municipality_id: MUNICIPALITY, status: "REALIZADA", workflow_data: { followUp: { enabled: true, email: "history@example.test" } } },
  ]);
  const issued = await fixture.request("/auth/tutor/contact-challenges", { method: "POST", token, body: { kind: "email", value: "new@example.test", currentPassword: PASSWORD } });
  assert.equal(issued.status, 200); assert.equal(issued.body.code, undefined);
  assert.equal(fixture.users.get(user.id).profile_email, "tutor@example.test");
  const pending = await fixture.challenge(user, AuthPurpose.VERIFY_EMAIL, "new@example.test");
  const confirmed = await fixture.request(`/auth/tutor/contact-challenges/${pending.challenge.id}/confirm`, { method: "POST", token, body: { code: pending.code } });
  assert.equal(confirmed.status, 200); assert.equal(confirmed.body.profile.emailVerified, true);
  assert.deepEqual(fixture.followUps.map((row) => row.workflow_data.followUp.email), ["new@example.test", "refused@example.test", "other-city@example.test", "other-user@example.test", "history@example.test"]);
  const poolConfig = fixture.calls.findIndex(({ source, sql }) => source === "pool" && sql.startsWith("SELECT value FROM config"));
  assert.equal(fixture.calls.slice(0, poolConfig).some(({ sql }) => sql === "COMMIT"), true);
});

test("assisted recovery excludes public/partner roles and rolls back when mandatory audit fails", async (t) => {
  const tutor = authUser(); const partner = authUser({ role: "ong", email: "partner@example.test", cpf: null });
  const analyst = authUser({ role: "analista", email: "staff@example.test", cpf: null });
  const fixture = await authHttpFixture(t, [tutor, partner, analyst], { failAudit: true });
  const path = `/auth/tutors/${tutor.id}/assisted-recovery`; const body = { municipalityId: MUNICIPALITY, identityConfirmed: true, reason: "Identidade presencial conferida" };
  assert.equal((await fixture.request(path, { method: "POST", token: fixture.token(tutor), body })).status, 403);
  assert.equal((await fixture.request(path, { method: "POST", token: fixture.token(partner), body })).status, 403);
  const result = await fixture.request(path, { method: "POST", token: fixture.token(analyst), body });
  assert.equal(result.status, 500); assert.equal(result.body.temporaryPassword, undefined);
  assert.equal(fixture.users.get(tutor.id).password, tutor.password); assert.equal(fixture.users.get(tutor.id).session_version, 0);
  assert.equal(fixture.calls.some(({ sql }) => sql === "ROLLBACK"), true);
});

test("existing staff identity cannot be reset by email collision without an explicit authorized ID", async (t) => {
  const admin = authUser({ role: "admin_municipal", email: "admin@example.test", cpf: null });
  const staff = authUser({ role: "analista", email: "staff@example.test", cpf: null });
  const fixture = await authHttpFixture(t, [admin, staff]); const token = fixture.token(admin);
  const payload = { name: "Staff Name", email: staff.email, role: "analista", password: "new staff password phrase" };
  assert.equal((await fixture.request("/auth/users", { method: "PUT", token, body: payload })).status, 409);
  assert.equal(fixture.users.get(staff.id).password, staff.password);
  assert.equal((await fixture.request("/auth/users", { method: "PUT", token, body: { ...payload, id: staff.id } })).status, 200);
  assert.equal(await bcrypt.compare(payload.password, fixture.users.get(staff.id).password), true);
});

test("recovery responses for unknown and unconfirmed-contact accounts have the same public shape", async (t) => {
  const user = authUser(); const fixture = await authHttpFixture(t, [user]);
  const results = await Promise.all([user.cpf, "11144477735"].map((identifier) => fixture.request("/auth/forgot-password", {
    method: "POST", body: { audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, identifier },
  })));
  for (const result of results) {
    assert.equal(result.status, 200); assert.equal(result.body.ok, true);
    assert.equal(result.body.expiresIn, 600); assert.equal(result.body.retryAfter, 60);
    assert.match(result.body.challengeId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(Object.keys(result.body).sort(), ["challengeId", "expiresIn", "ok", "retryAfter"]);
  }
  assert.equal(fixture.challenges.size, 0);
});
