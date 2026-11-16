import test from "node:test";
import assert from "node:assert/strict";
import { prepareRequestSubmission, mergeProtectedWorkflow } from "../src/services/request-submission.js";
import { loadRequestSettings } from "../src/repositories/request-settings.js";
import { SMS_CONFIG_KEY } from "../../shared/sms-contract.js";

const cpf = "52998224725";
const municipalityId = "municipality-a";
const defaults = {
  body: { requestTypeId: "surgery", cpf }, municipalityId,
  workflow: { identificationTypeId: "owned", followUp: { enabled: false } },
  settings: {
    requestTypes: [{ id: "surgery", name: "Cirurgia", active: true }],
    identificationTypes: [{ id: "owned", active: true }, { id: "stray", active: true, stepTutor: false }],
    phoneEnabled: false,
  },
};

function prepare(overrides = {}) {
  return prepareRequestSubmission({ ...structuredClone(defaults), ...overrides });
}

test("configured tutor omission accepts no CPF and normalizes an explicit refusal", () => {
  const result = prepare({ body: { requestTypeId: "surgery" }, workflow: { identificationTypeId: "stray", followUp: { enabled: false, email: "discard@example.com" } } });
  assert.equal(result.cpf, null);
  assert.deepEqual(result.workflow.followUp, { enabled: false, email: "", phone: "" });
});

test("all combinations use the conjunction of trusted tutor toggles", () => {
  for (const stepTutor of [true, false, undefined]) {
    for (const identificationTutor of [true, false, undefined]) {
      const input = structuredClone(defaults);
      input.body.cpf = "";
      input.settings.requestTypes[0].stepTutor = stepTutor;
      input.settings.identificationTypes[0].stepTutor = identificationTutor;
      const permits = stepTutor === false || identificationTutor === false;
      if (permits) assert.equal(prepareRequestSubmission(input).cpf, null);
      else assert.throws(() => prepareRequestSubmission(input), /CPF/);
    }
  }
});

test("origin and skipped profile screens cannot dispense required tutor identity", () => {
  for (const user of [undefined, { role: "tutor", profileComplete: true }]) {
    assert.throws(() => prepare({ user, body: { requestTypeId: "surgery", origin: "INTERNA", skipTutor: true }, workflow: defaults.workflow }), /CPF/);
  }
});

test("supplied invalid CPF is rejected even for a tutorless flow", () => {
  for (const invalidCpf of ["12345678901", "not-a-cpf", "11111111111", 0]) {
    assert.throws(() => prepare({ body: { requestTypeId: "surgery", cpf: invalidCpf }, workflow: { ...defaults.workflow, identificationTypeId: "stray" } }), /CPF/);
  }
});

test("missing, unknown, inactive and foreign identification do not provide a bypass", () => {
  for (const identificationTypeId of [undefined, "unknown"]) {
    assert.throws(() => prepare({ body: { requestTypeId: "surgery" }, workflow: { ...defaults.workflow, identificationTypeId } }));
  }
  for (const extra of [{ active: false }, { municipalityId: "municipality-b" }]) {
    const settings = structuredClone(defaults.settings);
    Object.assign(settings.identificationTypes[1], extra);
    assert.throws(() => prepare({ body: { requestTypeId: "surgery" }, settings, workflow: { ...defaults.workflow, identificationTypeId: "stray" } }), /identificação/);
  }
});

test("request types are checked within the selected municipality", () => {
  for (const extra of [{ active: false }, { municipalityId: "municipality-b" }]) {
    const settings = structuredClone(defaults.settings);
    Object.assign(settings.requestTypes[0], extra, { stepTutor: false });
    assert.throws(() => prepare({ body: { requestTypeId: "surgery" }, settings }), /solicitação/);
  }
  assert.throws(() => prepare({ body: { type: "unknown" }, workflow: { ...defaults.workflow, identificationTypeId: "stray" } }), /solicitação/);
});

test("authenticated tutors retain identity requirements even in a tutorless configuration", () => {
  assert.throws(() => prepare({ user: { role: "tutor", profileComplete: true }, body: { requestTypeId: "surgery" }, workflow: { ...defaults.workflow, identificationTypeId: "stray" } }), /CPF/);
});

test("identification must agree across animals and the request", () => {
  assert.throws(() => prepare({ body: { requestTypeId: "surgery", animals: [{ identificationTypeId: "stray" }] } }), /não corresponde/);
  assert.throws(() => prepare({ body: { requestTypeId: "surgery", animals: [null] } }), /animal inválidos/);
});

test("malformed stored configuration items cannot bypass identity validation", () => {
  const settings = structuredClone(defaults.settings);
  settings.requestTypes = [null, "invalid"];
  settings.identificationTypes = [null, [], ...settings.identificationTypes];
  assert.throws(() => prepare({ settings, body: { type: "unknown" }, workflow: { ...defaults.workflow, identificationTypeId: "stray" } }), /solicitação/);
});

test("every new public procedure requires an explicit follow-up answer", () => {
  assert.throws(() => prepare({ workflow: {} }), /acompanhar/);
  assert.throws(() => prepare({ workflow: { followUp: { enabled: "false" } } }), /acompanhar/);
});

test("contact normalization keeps notification recipients separate and clears hidden phone", () => {
  const result = prepare({ workflow: { followUp: { enabled: true, email: " Citizen@Example.com ", phone: "invalid hidden phone" } } });
  assert.deepEqual(result.workflow.followUp, { enabled: true, email: "citizen@example.com", phone: "" });
  assert.throws(() => prepare({ workflow: { followUp: { enabled: true, email: "invalid" } } }), /e-mail/);
});

test("the phone is kept only when the municipality has a phone channel, and must then be valid", () => {
  const followUp = (phone) => ({ followUp: { enabled: true, email: "citizen@example.com", phone } });
  const settings = { ...structuredClone(defaults.settings), phoneEnabled: true };
  assert.deepEqual(prepare({ settings, workflow: followUp("(48) 99999-1234") }).workflow.followUp, { enabled: true, email: "citizen@example.com", phone: "48999991234" });
  assert.equal(prepare({ settings, workflow: followUp("") }).workflow.followUp.phone, "");
  assert.throws(() => prepare({ settings, workflow: followUp("123") }), /telefone/);
  assert.equal(prepare({ workflow: followUp("(48) 99999-1234") }).workflow.followUp.phone, "");
});

test("internal submissions preserve their contract and cannot omit CPF", () => {
  const user = { role: "analista" };
  assert.equal(prepare({ user, workflow: {} }).internal, true);
  assert.throws(() => prepare({ user, body: { requestTypeId: "surgery" }, workflow: {} }), /CPF/);
});

test("complaints preserve name, CPF and phone requirements without new step", () => {
  const body = { request_type: "DENUNCIA", cpf, tutor_name: "Cidadão", phone: "48999991234" };
  assert.equal(prepare({ body, workflow: {} }).requestType, "DENUNCIA");
  for (const missing of [{ cpf: "" }, { tutor_name: "" }, { phone: "" }]) {
    assert.throws(() => prepare({ body: { ...body, ...missing }, workflow: {} }));
  }
});

test("PATCH cannot overwrite consent, recipients or server delivery metadata", () => {
  const current = { followUp: { enabled: false }, notificationDispatches: { version: 1 } };
  assert.deepEqual(mergeProtectedWorkflow(current, { followUp: { enabled: true }, notificationDispatches: {}, notes: "allowed" }), { ...current, notes: "allowed" });
  assert.deepEqual(mergeProtectedWorkflow({}, { followUp: { enabled: true }, notificationResults: { status: "sent" }, notes: "allowed" }), { notes: "allowed" });
});

test("settings repository scopes every config lookup to an active municipality and asks for the channels it needs", async () => {
  const asked = [];
  const database = { query: async (sql, parameters) => {
    assert.match(sql, /m\.id = \$1 AND m\.active = TRUE/);
    assert.match(sql, /c\.municipality_id = m\.id/);
    assert.equal(parameters[0], municipalityId);
    asked.push(...parameters[1]);
    return { rows: [{ municipality_id: municipalityId, key: null, value: null }] };
  } };
  const settings = await loadRequestSettings(municipalityId, database);
  assert.equal(settings.identificationTypes[0].stepTutor, true);
  assert.equal(settings.phoneEnabled, false);
  assert.equal("whatsappEnabled" in settings || "notifications" in settings, false);
  assert.equal(asked.includes("whatsapp") && asked.includes(SMS_CONFIG_KEY), true);
  assert.equal(asked.includes("castragestao:notifications"), false);
  await assert.rejects(loadRequestSettings(municipalityId, { query: async () => ({ rows: [] }) }), /Município/);
});

test("the phone is asked as soon as WhatsApp or SMS is active, and only when one really is", async () => {
  const withConfig = (config) => ({ query: async () => ({ rows: [{ municipality_id: municipalityId, key: null, value: null },
    ...Object.entries(config).map(([key, value]) => ({ municipality_id: municipalityId, key, value }))] }) });
  const phoneEnabled = async (config) => (await loadRequestSettings(municipalityId, withConfig(config))).phoneEnabled;
  assert.equal(await phoneEnabled({ whatsapp: { active: true } }), true);
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: true } }), true);
  assert.equal(await phoneEnabled({ whatsapp: { active: true }, [SMS_CONFIG_KEY]: { active: false } }), true);
  assert.equal(await phoneEnabled({ whatsapp: { active: false }, [SMS_CONFIG_KEY]: { active: false } }), false);
  assert.equal(await phoneEnabled({ whatsapp: { active: "true" }, [SMS_CONFIG_KEY]: { hasToken: true } }), false);
  assert.equal(await phoneEnabled({}), false);
});
