import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { authHttpFixture, authUser, AUTH_TEST_MUNICIPALITY as MUNICIPALITY, AUTH_TEST_OTHER_MUNICIPALITY as OTHER } from "./fixtures/auth-http.js";
import { REQUEST_CONTACT_CPF_KEY, withoutRequestContactCpf } from "../../shared/request-contract.js";
import { AnimalTutorship } from "../../shared/request-tutorship-contract.js";

const REQUEST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FINISHED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOREIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function fixtureWithTutor(t, failAudit = false) {
  const tutor = authUser({ name: "Maria Silva", profile_phone: "48999990000", address: "Rua Velha, 10", neighborhood: "Centro", city: "Criciúma", state: "SC", cep: "88800000" });
  const analyst = authUser({ role: "analista", email: "staff@example.test", cpf: null });
  const partner = authUser({ role: "ong", email: "partner@example.test", cpf: null });
  const fixture = await authHttpFixture(t, [tutor, analyst, partner], { failAudit });
  const snapshot = { tutor_name: "Maria Silva", tutor_email: "tutor@example.test", phone: "48999990000", address: "Rua Velha, 10", neighborhood: "Centro", city: "Criciúma", state: "SC", cep: "88800000" };
  fixture.requestRows.push(
    { id: REQUEST, municipality_id: MUNICIPALITY, tutor_id: tutor.id, cpf: tutor.cpf, status: "AGENDADA", ...snapshot, workflow_data: { followUp: { enabled: true, email: "tutor@example.test", phone: "48999990000" } } },
    { id: FINISHED, municipality_id: MUNICIPALITY, tutor_id: tutor.id, cpf: tutor.cpf, status: "REALIZADA", ...snapshot, workflow_data: { followUp: { enabled: true, email: "tutor@example.test" } } },
    { id: FOREIGN, municipality_id: OTHER, tutor_id: tutor.id, cpf: tutor.cpf, status: "NOVA", ...snapshot, workflow_data: {} },
  );
  return { fixture, tutor, analyst, partner, path: (id = REQUEST) => `/auth/request-tutor/${id}` };
}

const changes = { name: "Maria Souza", email: "Maria@Example.test", phone: "(48) 98888-7777", address: "Rua Nova, 20", neighborhood: "Pinheirinho", city: "Criciúma", state: "sc", cep: "88801-000" };

test("the tutor data of a request is read by the staff of the municipality only", async (t) => {
  const { fixture, tutor, analyst, partner, path } = await fixtureWithTutor(t);
  assert.equal((await fixture.request(path(), { token: fixture.token(tutor) })).status, 403);
  assert.equal((await fixture.request(path(), { token: fixture.token(partner) })).status, 403);
  assert.equal((await fixture.request(path(FOREIGN), { token: fixture.token(analyst) })).status, 404);
  const result = await fixture.request(path(), { token: fixture.token(analyst) });
  assert.equal(result.status, 200); assert.equal(result.cacheControl, "no-store");
  assert.deepEqual(result.body.tutor, { id: tutor.id, hasAccess: true, name: "Maria Silva", cpf: tutor.cpf, email: "tutor@example.test", phone: "48999990000", emailVerified: false,
    phoneVerified: false, address: "Rua Velha, 10", neighborhood: "Centro", city: "Criciúma", state: "SC", cep: "88800000" });
});

test("saving the tutor data and a typed password updates the account, the open requests and the audit, never the CPF", async (t) => {
  const { fixture, tutor, analyst, path } = await fixtureWithTutor(t);
  const result = await fixture.request(path(), { method: "PUT", token: fixture.token(analyst), body: { ...changes, cpf: "11144477735", password: "senha digitada pelo atendente" } });
  assert.equal(result.status, 200); assert.equal(result.body.passwordChanged, true);
  const saved = fixture.users.get(tutor.id);
  assert.equal(saved.name, "Maria Souza"); assert.equal(saved.profile_email, "maria@example.test"); assert.equal(saved.profile_phone, "48988887777");
  assert.equal(saved.cep, "88801000"); assert.equal(saved.state, "SC"); assert.equal(saved.cpf, tutor.cpf);
  assert.ok(saved.email_verified_at && saved.phone_verified_at, "a contact typed by the staff counts as verified");
  assert.equal(await bcrypt.compare("senha digitada pelo atendente", saved.password), true);
  assert.equal(saved.must_change_password, false); assert.equal(saved.session_version, 1);
  const [open, finished, foreign] = fixture.requestRows;
  assert.deepEqual([open.tutor_name, open.neighborhood, open.phone, open.workflow_data.followUp.email, open.workflow_data.followUp.phone], ["Maria Souza", "Pinheirinho", "48988887777", "maria@example.test", "48988887777"]);
  assert.deepEqual([finished.tutor_name, finished.neighborhood, finished.workflow_data.followUp.email], ["Maria Silva", "Centro", "tutor@example.test"]);
  assert.deepEqual([foreign.tutor_name, foreign.neighborhood], ["Maria Silva", "Centro"]);
  assert.equal(fixture.animalTutorUpdates.length, 1);
  const audit = fixture.calls.find(({ sql }) => sql.includes("INSERT INTO audit_logs"));
  const logged = JSON.parse(audit.values[4]);
  assert.equal(audit.values[2], "TUTOR_DATA_UPDATE"); assert.equal(logged.passwordChanged, true);
  assert.deepEqual(logged.fields, ["name", "email", "phone", "address", "neighborhood", "cep"]);
  assert.equal(JSON.stringify(logged).includes("senha digitada"), false);
});

test("a request registered by the staff has no account: its own data is read and edited, and there is no password to set", async (t) => {
  const { fixture, analyst, path } = await fixtureWithTutor(t);
  const loose = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", municipality_id: MUNICIPALITY, tutor_id: null, cpf: "11144477735", status: "REALIZADA", tutor_name: "Sem Conta",
    tutor_email: "", phone: "", address: "Rua Sem Conta", neighborhood: "Michel", city: "Criciúma", state: "SC", cep: "", workflow_data: {} };
  const other = { ...loose, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", status: "NOVA" };
  const finished = { ...loose, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" };
  fixture.requestRows.push(loose, other, finished);
  const token = fixture.token(analyst);
  const read = await fixture.request(path(loose.id), { token });
  assert.equal(read.status, 200); assert.equal(read.body.tutor.hasAccess, false); assert.equal(read.body.tutor.id, null);
  assert.deepEqual([read.body.tutor.name, read.body.tutor.cpf, read.body.tutor.neighborhood], ["Sem Conta", "11144477735", "Michel"]);
  const refused = await fixture.request(path(loose.id), { method: "PUT", token, body: { ...changes, password: "senha digitada pelo atendente" } });
  assert.equal(refused.status, 400); assert.match(refused.body.error, /senha/i);
  const saved = await fixture.request(path(loose.id), { method: "PUT", token, body: changes });
  assert.equal(saved.status, 200); assert.equal(saved.body.tutor.hasAccess, false); assert.equal(saved.body.tutor.neighborhood, "Pinheirinho");
  assert.deepEqual([loose.tutor_name, loose.neighborhood, other.tutor_name, other.neighborhood, finished.tutor_name], ["Maria Souza", "Pinheirinho", "Maria Souza", "Pinheirinho", "Sem Conta"]);
  const audit = fixture.calls.filter(({ sql }) => sql.includes("INSERT INTO audit_logs")).at(-1);
  assert.deepEqual([audit.values[2], audit.values[3], audit.values[5]], ["TUTOR_DATA_UPDATE", loose.id, "request"]);
  assert.equal((await fixture.request(path("99999999-9999-4999-8999-999999999999"), { token })).status, 404);
});

test("a request without a tutor exposes editable contact data and saves it only for that request", async (t) => {
  const { fixture, tutor, analyst, path } = await fixtureWithTutor(t);
  const request = { id: "aaaaaaaa-0000-4000-8000-000000000000", municipality_id: MUNICIPALITY, tutor_id: null, cpf: null, status: "NOVA",
    workflow_data: { tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false } } };
  const untouched = { ...request, id: "aaaaaaaa-0000-4000-8000-000000000001", cpf: "", address: "Outra rua" };
  const linked = { ...request, id: "aaaaaaaa-0000-4000-8000-000000000002", tutor_id: "aaaaaaaa-0000-4000-8000-000000000003" };
  fixture.requestRows.push(request, untouched, linked);
  const token = fixture.token(analyst);
  const linkedResult = await fixture.request(path(linked.id), { token });
  assert.equal(linkedResult.status, 200);
  assert.deepEqual(linkedResult.body, { tutor: null });
  const read = await fixture.request(path(request.id), { token });
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.tutor, { id: null, hasAccess: false, contactOnly: true, name: "", cpf: "", email: "", phone: "",
    emailVerified: false, phoneVerified: false, address: "", neighborhood: "", city: "", state: "", cep: "" });
  const save = (body) => fixture.request(path(request.id), { method: "PUT", token, body });
  assert.equal((await save({ cpf: "123" })).status, 400);
  assert.equal((await save({ password: "senha digitada pelo atendente" })).status, 400);
  const saved = await save({ address: "Rua do contato", cpf: "529.982.247-25" });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.tutor, { ...read.body.tutor, address: "Rua do contato", cpf: tutor.cpf });
  assert.equal(saved.body.passwordChanged, false);
  assert.deepEqual([request.cpf, request.tutor_id, untouched.address], [null, null, "Outra rua"]);
  assert.equal(request.workflow_data[REQUEST_CONTACT_CPF_KEY], tutor.cpf);
  assert.deepEqual(withoutRequestContactCpf(request.workflow_data), { tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false } });
  assert.deepEqual((await fixture.request(path(request.id), { token })).body.tutor, saved.body.tutor);
  assert.equal((await save({ address: "Rua atualizada" })).body.tutor.cpf, tutor.cpf);
  assert.equal((await save({ address: "Rua atualizada", cpf: "" })).body.tutor.cpf, "");
  assert.equal(fixture.users.get(tutor.id).name, tutor.name);
  assert.deepEqual(fixture.animalTutorUpdates, []);
  const fields = fixture.calls.filter(({ sql }) => sql.includes("INSERT INTO audit_logs")).map(({ values }) => JSON.parse(values[4]).fields);
  assert.deepEqual(fields, [["address", "cpf"], ["address"], ["cpf"]]);
});

test("without a password the current one is kept and no session is revoked", async (t) => {
  const { fixture, tutor, analyst, path } = await fixtureWithTutor(t);
  const before = fixture.users.get(tutor.id).password;
  const result = await fixture.request(path(), { method: "PUT", token: fixture.token(analyst), body: { ...changes, password: "" } });
  assert.equal(result.status, 200); assert.equal(result.body.passwordChanged, false);
  assert.equal(fixture.users.get(tutor.id).password, before); assert.equal(fixture.users.get(tutor.id).session_version, 0);
});

test("invalid data is refused before anything is written", async (t) => {
  const { fixture, tutor, analyst, partner, path } = await fixtureWithTutor(t);
  const token = fixture.token(analyst);
  for (const [patch, message] of [[{ name: "A" }, /nome/i], [{ email: "not-an-email" }, /e-mail/i], [{ phone: "123" }, /celular/i], [{ phone: "" }, /celular/i], [{ phone: "(48) 3333-4444" }, /celular/i],
    [{ state: "Santa" }, /UF/], [{ cep: "123" }, /CEP/], [{ password: "123" }, /senha/i], [{ neighborhood: "x".repeat(121) }, /Bairro/]]) {
    const result = await fixture.request(path(), { method: "PUT", token, body: { ...changes, ...patch } });
    assert.equal(result.status, 400, JSON.stringify(patch)); assert.match(result.body.error, message);
  }
  assert.equal((await fixture.request(path(), { method: "PUT", token: fixture.token(partner), body: changes })).status, 403);
  assert.equal((await fixture.request(path(FOREIGN), { method: "PUT", token, body: changes })).status, 404);
  assert.equal(fixture.users.get(tutor.id).name, "Maria Silva");
});

test("the change is rolled back when the mandatory audit fails", async (t) => {
  const { fixture, tutor, analyst, path } = await fixtureWithTutor(t, true);
  const result = await fixture.request(path(), { method: "PUT", token: fixture.token(analyst), body: { ...changes, password: "senha digitada pelo atendente" } });
  assert.equal(result.status, 500);
  assert.equal(fixture.users.get(tutor.id).password, tutor.password); assert.equal(fixture.users.get(tutor.id).session_version, 0);
  assert.equal(fixture.calls.some(({ sql }) => sql === "ROLLBACK"), true);
});
