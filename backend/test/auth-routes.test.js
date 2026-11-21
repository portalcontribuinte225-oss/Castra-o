import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { AuthAudience, AuthErrorCode, AuthPurpose } from "../../shared/auth-contract.js";
import { recoveryDestination } from "../src/services/auth/recovery-token.js";
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
  assert.notEqual(wrongMunicipality.body.code, AuthErrorCode.SESSION_INVALID);
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
  const revoked = await request("/protected", { token: oldToken });
  assert.equal(revoked.status, 401);
  assert.equal(revoked.body.code, AuthErrorCode.SESSION_INVALID);
  assert.equal((await request("/protected", { token: changed.body.token })).status, 200);
});

test("only one concurrent reset consumes a code and previous sessions are revoked", async (t) => {
  const user = authUser(); const fixture = await authHttpFixture(t, [user]); const oldToken = fixture.token(user);
  const pending = await fixture.challenge(user, AuthPurpose.PASSWORD_RESET, recoveryDestination("email", user.profile_email));
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

test("the municipal administrator can edit their own account after the master changes their login", async (t) => {
  const master = authUser({ role: "master", email: "master@example.test", municipality_id: null, cpf: null });
  const admin = authUser({ role: "admin_municipal", email: "original@example.test", cpf: null, is_default_admin: true });
  const otherTeamUser = { id: authUser().id, name: "Another staff account" };
  const team = { sectorIds: ["office"], matricula: "9999", cargo: "Administrator", permissionGroupId: "managers" };
  const sectors = [{ id: "office", name: "Municipal Office" }];
  const teamsKey = `castragestao:teams:${MUNICIPALITY}`;
  const fixture = await authHttpFixture(t, [master, admin], {
    configs: {
      [teamsKey]: { sectors, users: [{ id: admin.id, email: admin.email, ...team, defaultMunicipalityUser: true }, otherTeamUser] },
      [`permission_groups:${MUNICIPALITY}`]: [{ id: team.permissionGroupId, name: "Managers", active: true }],
    },
  });
  const oldToken = fixture.token(admin);
  const credentials = { email: "reset@example.test", password: "password changed by master" };
  const account = { id: admin.id, name: "Municipal Administrator", role: admin.role, municipalityId: MUNICIPALITY, active: true };
  const putUser = (token, body) => fixture.request("/auth/users", { method: "PUT", token, body: { ...account, ...body } });

  const reset = await putUser(fixture.token(master), { ...credentials, team });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.id, admin.id);
  assert.equal(reset.body.teamUser.email, credentials.email);
  assert.equal(reset.body.session, undefined);
  assert.equal((await fixture.request("/protected", { token: oldToken })).status, 401);

  const login = await fixture.request("/auth/login", { method: "POST", body: {
    audience: AuthAudience.STAFF, identifier: credentials.email, password: credentials.password,
  } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, admin.id);
  const token = login.body.token;
  const version = fixture.users.get(admin.id).session_version;
  const passwordHash = fixture.users.get(admin.id).password;

  const updatedTeam = { ...team, matricula: "1000", cargo: "Municipal Office Coordinator" };
  const edited = await putUser(token, { email: credentials.email, name: "Ana Administrator", team: updatedTeam });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.session.user.id, admin.id);
  assert.equal(edited.body.session.user.name, "Ana Administrator");
  assert.equal(edited.body.session.token, undefined);
  assert.equal(edited.body.teamUser.matricula, updatedTeam.matricula);
  assert.equal(edited.body.teamUser.cargo, updatedTeam.cargo);
  assert.equal(fixture.users.get(admin.id).session_version, version);
  assert.equal(fixture.users.get(admin.id).password, passwordHash);
  assert.equal((await fixture.request("/protected", { token })).status, 200);
  const savedTeams = fixture.configs[teamsKey];
  assert.deepEqual(savedTeams.sectors, sectors);
  assert.deepEqual(savedTeams.users.find(({ id }) => id === otherTeamUser.id), otherTeamUser);
  assert.equal(savedTeams.users.find(({ id }) => id === admin.id).defaultMunicipalityUser, true);
  assert.equal(savedTeams.users.find(({ id }) => id === admin.id).matricula, updatedTeam.matricula);

  const newCredentials = { email: "my-new-email@example.test", password: "password changed by administrator" };
  const changed = await putUser(token, { ...newCredentials, name: edited.body.name, team: updatedTeam });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.session.user.email, newCredentials.email);
  assert.equal(changed.body.teamUser.email, newCredentials.email);
  assert.equal(fixture.users.get(admin.id).session_version, version + 1);
  assert.equal(await bcrypt.compare(newCredentials.password, fixture.users.get(admin.id).password), true);
  assert.equal((await fixture.request("/protected", { token })).status, 401);
  assert.equal((await fixture.request("/protected", { token: changed.body.session.token })).status, 200);
});

test("municipal user edits reject an existing e-mail and cannot target another municipality", async (t) => {
  const admin = authUser({ role: "admin_municipal", email: "admin@example.test", cpf: null });
  const foreign = authUser({ role: "admin_municipal", email: "foreign@example.test", municipality_id: OTHER, cpf: null });
  const fixture = await authHttpFixture(t, [admin, foreign]);
  const token = fixture.token(admin);
  const body = { id: admin.id, name: admin.name, role: admin.role, email: foreign.email.toUpperCase() };
  const duplicateEmail = await fixture.request("/auth/users", { method: "PUT", token, body });
  assert.equal(duplicateEmail.status, 409);

  const foreignId = await fixture.request("/auth/users", {
    method: "PUT", token, body: { ...body, id: foreign.id, email: foreign.email, municipalityId: OTHER },
  });
  assert.equal(foreignId.status, 404);
  assert.deepEqual(fixture.users.get(admin.id), admin);
  assert.deepEqual(fixture.users.get(foreign.id), foreign);
});

test("staff identity and team details roll back together when audit fails", async (t) => {
  const admin = authUser({ role: "admin_municipal", email: "admin@example.test", cpf: null });
  const teamsKey = `castragestao:teams:${MUNICIPALITY}`;
  const teams = { sectors: [], users: [{ id: admin.id, email: admin.email, matricula: "1" }] };
  const fixture = await authHttpFixture(t, [admin], { failAudit: true, configs: { [teamsKey]: teams } });
  const result = await fixture.request("/auth/users", { method: "PUT", token: fixture.token(admin), body: {
    id: admin.id, name: "Updated Name", email: admin.email, role: admin.role,
    team: { sectorIds: [], matricula: "2", cargo: "", permissionGroupId: "" },
  } });
  assert.equal(result.status, 500);
  assert.deepEqual(fixture.users.get(admin.id), admin);
  assert.deepEqual(fixture.configs[teamsKey], teams);
  assert.equal(fixture.calls.some(({ sql }) => sql === "ROLLBACK"), true);
});

test("recovery without available transports returns no options and never creates challenges", async (t) => {
  const user = authUser(); const fixture = await authHttpFixture(t, [user]);
  const results = await Promise.all([user.cpf, "11144477735"].map((identifier) => fixture.request("/auth/recovery-options", {
    method: "POST", body: { audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY, identifier },
  })));
  for (const result of results) {
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { recoveryToken: "", options: [] });
  }
  assert.equal(fixture.challenges.size, 0);
});
