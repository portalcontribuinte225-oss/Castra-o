import test from "node:test";
import assert from "node:assert/strict";
import { prepareRequestSubmission, mergeProtectedWorkflow } from "../src/services/request-submission.js";
import { loadRequestSettings } from "../src/repositories/request-settings.js";
import { SMS_CONFIG_KEY } from "../../shared/sms-contract.js";
import { AnimalTutorship } from "../../shared/request-tutorship-contract.js";
import { REQUEST_CONTACT_CPF_KEY } from "../../shared/request-contract.js";

const cpf = "52998224725";
const phone = "(48) 99999-1234";
const municipalityId = "municipality-a";
const surgery = () => [{ neighborhood: "Centro", requestTypeIds: ["surgery"] }];
const defaults = {
  body: { animals: surgery(), cpf, phone }, municipalityId,
  workflow: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false } },
  settings: {
    requestTypes: [{ id: "surgery", name: "Cirurgia", active: true }],
    phoneEnabled: false,
  },
};

function prepare(overrides = {}) {
  return prepareRequestSubmission({ ...structuredClone(defaults), ...overrides });
}

test("an animal without a tutor accepts no CPF, and an explicit refusal of the notices is normalized", () => {
  const result = prepare({ body: { animals: surgery() }, workflow: {
    tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false, email: "discard@example.com" }, [REQUEST_CONTACT_CPF_KEY]: cpf,
  } });
  assert.equal(result.cpf, null);
  assert.deepEqual(result.workflow.followUp, { enabled: false, email: "", phone: "" });
  assert.equal(Object.hasOwn(result.workflow, REQUEST_CONTACT_CPF_KEY), false);
});

test("only the answer about the tutor can dispense it: the toggles of the request type never do", () => {
  for (const stepTutor of [true, false, undefined]) {
    const asked = structuredClone(defaults);
    asked.body.cpf = "";
    asked.settings.requestTypes[0].stepTutor = stepTutor;
    assert.throws(() => prepareRequestSubmission(asked), /CPF/);
    const noTutor = structuredClone(asked);
    noTutor.workflow.tutorship = AnimalTutorship.WITHOUT_TUTOR;
    assert.equal(prepareRequestSubmission(noTutor).cpf, null);
  }
});

test("origin and skipped profile screens cannot dispense required tutor identity", () => {
  for (const user of [undefined, { role: "tutor", profileComplete: true }]) {
    assert.throws(() => prepare({ user, body: { animals: surgery(), origin: "INTERNA", skipTutor: true }, workflow: defaults.workflow }), /CPF/);
  }
});

test("supplied invalid CPF is rejected even for a tutorless flow", () => {
  for (const invalidCpf of ["12345678901", "not-a-cpf", "11111111111", 0]) {
    assert.throws(() => prepare({ body: { animals: surgery(), cpf: invalidCpf }, workflow: { ...defaults.workflow, tutorship: AnimalTutorship.WITHOUT_TUTOR } }), /CPF/);
  }
});

test("no answer about the tutor means with a tutor, and an answer that is not one of the two is refused", () => {
  assert.throws(() => prepare({ body: { animals: surgery() }, workflow: { ...defaults.workflow, tutorship: undefined } }), /CPF/);
  for (const tutorship of ["unknown", "owned", "stray", "with_tutor", "ANIMAL_SEM_TUTOR", " animal_sem_tutor"]) {
    assert.throws(() => prepare({ body: { animals: surgery() }, workflow: { ...defaults.workflow, tutorship } }), /resposta sobre o tutor/i, tutorship);
  }
});

test("request types are checked within the selected municipality", () => {
  for (const extra of [{ active: false }, { municipalityId: "municipality-b" }]) {
    const settings = structuredClone(defaults.settings);
    Object.assign(settings.requestTypes[0], extra, { stepTutor: false });
    assert.throws(() => prepare({ body: { animals: surgery() }, settings }), /solicitação/);
  }
  assert.throws(() => prepare({ body: { type: "unknown" }, workflow: { ...defaults.workflow, tutorship: AnimalTutorship.WITHOUT_TUTOR } }), /ao menos um procedimento/);
});

test("authenticated tutors retain identity requirements even when the animal is said to have no tutor", () => {
  assert.throws(() => prepare({ user: { role: "tutor", profileComplete: true }, body: { animals: surgery() }, workflow: { ...defaults.workflow, tutorship: AnimalTutorship.WITHOUT_TUTOR } }), /CPF/);
});

test("identification must agree across animals and the request", () => {
  assert.throws(() => prepare({ body: { animals: [{ ...surgery()[0], tutorship: AnimalTutorship.WITHOUT_TUTOR }] } }), /não corresponde/);
  assert.throws(() => prepare({ body: { animals: [null] } }), /animal inválidos/);
});

test("malformed stored request types cannot bypass the validation", () => {
  const settings = structuredClone(defaults.settings);
  settings.requestTypes = [null, "invalid"];
  assert.throws(() => prepare({ settings, body: { animals: surgery() }, workflow: { ...defaults.workflow, tutorship: AnimalTutorship.WITHOUT_TUTOR } }), /solicitação/);
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
  assert.throws(() => prepare({ settings, workflow: followUp("123") }), /celular/);
  assert.throws(() => prepare({ settings, workflow: followUp("(48) 3333-4444") }), /celular/, "a landline cannot receive the notices");
  assert.equal(prepare({ workflow: followUp("(48) 99999-1234") }).workflow.followUp.phone, "");
});

test("staff may register an animal without a tutor only by saying that it has none", () => {
  const user = { role: "analista" };
  const input = (workflow, extra = {}) => ({ user, body: { animals: surgery() }, workflow, ...extra });
  const result = prepare(input({ tutorship: AnimalTutorship.WITHOUT_TUTOR }));
  assert.equal(result.cpf, null);
  assert.equal(result.internal, true);
  assert.equal(result.tutorRequired, false);
  assert.throws(() => prepare(input({ tutorship: AnimalTutorship.WITH_TUTOR })), /CPF/);
  assert.throws(() => prepare(input({})), /CPF/);
  assert.equal(prepare({ ...input({ tutorship: AnimalTutorship.WITH_TUTOR }), body: { animals: surgery(), cpf, phone } }).cpf, cpf);
  assert.throws(() => prepare({ ...input({ tutorship: AnimalTutorship.WITHOUT_TUTOR }), body: { animals: surgery(), cpf: "123" } }), /CPF/);
});

test("staff cannot use an unknown answer, nor mix it with the animals' answer, to dispense the tutor", () => {
  const user = { role: "analista" };
  assert.throws(() => prepare({ user, body: { animals: surgery() }, workflow: { tutorship: "unknown" } }), /resposta sobre o tutor/i);
  assert.throws(() => prepare({ user, body: { animals: [{ ...surgery()[0], tutorship: AnimalTutorship.WITH_TUTOR }] }, workflow: { tutorship: AnimalTutorship.WITHOUT_TUTOR } }), /não corresponde/);
  assert.throws(() => prepare({ user, body: { type: "DENUNCIA", tutor_name: "Cidadão", phone: "48999991234" }, workflow: { tutorship: AnimalTutorship.WITHOUT_TUTOR } }));
});

test("internal submissions preserve their contract and cannot omit CPF", () => {
  const user = { role: "analista" };
  assert.equal(prepare({ user, workflow: {} }).internal, true);
  assert.throws(() => prepare({ user, body: { animals: surgery() }, workflow: {} }), /CPF/);
});

test("complaints preserve name, CPF and phone requirements without new step", () => {
  const body = { request_type: "DENUNCIA", cpf, tutor_name: "Cidadão", phone: "48999991234" };
  assert.equal(prepare({ body, workflow: {} }).requestType, "DENUNCIA");
  for (const missing of [{ cpf: "" }, { tutor_name: "" }, { phone: "" }]) {
    assert.throws(() => prepare({ body: { ...body, ...missing }, workflow: {} }));
  }
});

test("PATCH preserves consent, recipients, delivery metadata and the contact's CPF", () => {
  const current = { followUp: { enabled: false }, notificationDispatches: { version: 1 }, [REQUEST_CONTACT_CPF_KEY]: cpf };
  assert.deepEqual(mergeProtectedWorkflow(current, { followUp: { enabled: true }, notificationDispatches: {}, [REQUEST_CONTACT_CPF_KEY]: "", notes: "allowed" }), { ...current, notes: "allowed" });
  assert.deepEqual(mergeProtectedWorkflow({}, { followUp: { enabled: true }, notificationResults: { status: "sent" }, notes: "allowed" }), { notes: "allowed" });
});

test("settings repository scopes every config lookup to an active municipality and asks for the channels it needs", async () => {
  const asked = [];
  const database = { query: async (sql, parameters) => {
    assert.match(sql, /m\.id = \$1 AND m\.active = TRUE/);
    assert.match(sql, /c\.municipality_id = m\.id/);
    assert.match(sql, /c\.municipality_id IS NULL AND c\.key = \$3/, "the SMS account is the one platform value read");
    assert.equal(parameters[0], municipalityId);
    assert.equal(parameters[2], SMS_CONFIG_KEY);
    asked.push(...parameters[1]);
    return { rows: [{ municipality_id: municipalityId, key: null, value: null }] };
  } };
  const settings = await loadRequestSettings(municipalityId, database);
  assert.equal("identificationTypes" in settings, false, "the identification types are not part of the settings any more");
  assert.equal(settings.phoneEnabled, false);
  assert.equal("whatsappEnabled" in settings || "notifications" in settings, false);
  assert.equal(asked.includes("whatsapp") && asked.includes("sms_quota"), true);
  assert.equal(asked.includes(SMS_CONFIG_KEY), false, "a municipal SMS row is never read");
  assert.equal(asked.includes("castragestao:notifications"), false);
  assert.equal(asked.includes("castragestao:identification-types"), false, "the answer about the tutor is not configured");
  await assert.rejects(loadRequestSettings(municipalityId, { query: async () => ({ rows: [] }) }), /Município/);
});

test("the phone is asked as soon as WhatsApp is active or SMS can reach the municipality, and only when one really can", async () => {
  const withConfig = (config) => ({ query: async () => ({ rows: [{ municipality_id: municipalityId, key: null, value: null },
    ...Object.entries(config).map(([key, value]) => ({ municipality_id: municipalityId, key, value }))] }) });
  const phoneEnabled = async (config) => (await loadRequestSettings(municipalityId, withConfig(config))).phoneEnabled;
  assert.equal(await phoneEnabled({ whatsapp: { active: true } }), true);
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: true }, sms_quota: { plan: 10 } }), true);
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: true } }), false, "the channel is on but the municipality has no SMS contract");
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: true }, sms_quota: { plan: 10, contractEnd: "2020-01-01" } }), false, "the contract ended");
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: false }, sms_quota: { plan: 10 } }), false, "the contract alone does not turn the channel on");
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: true }, sms_quota: { plan: 10, enabled: false } }), false, "the service is switched off for the municipality");
  assert.equal(await phoneEnabled({ [SMS_CONFIG_KEY]: { active: true }, sms_quota: { plan: 10, enabled: true } }), true);
  assert.equal(await phoneEnabled({ whatsapp: { active: true }, [SMS_CONFIG_KEY]: { active: true }, sms_quota: { plan: 10, enabled: false } }), true, "WhatsApp still reaches the phone");
  assert.equal(await phoneEnabled({ whatsapp: { active: true }, [SMS_CONFIG_KEY]: { active: false } }), true);
  assert.equal(await phoneEnabled({ whatsapp: { active: false }, [SMS_CONFIG_KEY]: { active: false } }), false);
  assert.equal(await phoneEnabled({ whatsapp: { active: "true" }, [SMS_CONFIG_KEY]: { hasToken: true } }), false);
  assert.equal(await phoneEnabled({}), false);
});

const procedureSettings = (extra = {}) => ({
  ...structuredClone(defaults.settings),
  requestTypes: [
    { id: "castration", name: "Castração", active: true },
    { id: "microchip", name: "Microchipagem", active: true },
    { id: "no-tutor", name: "Sem tutor", active: true, stepTutor: false },
    { id: "no-tutor-too", name: "Também sem tutor", active: true, stepTutor: false },
    { id: "vaccine", name: "Vacinação", active: false },
  ],
  ...extra,
});
const bairro = { neighborhood: "Centro" };
const procedureInput = (animals, extra = {}) => ({ body: { animals }, settings: procedureSettings(), workflow: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false } }, ...extra });

test("with procedures per animal the request type is derived from them, whole, and the animals come back normalized", () => {
  const animals = [{ name: "Rex", ...bairro, requestTypeIds: ["microchip", "castration"] }, { name: "Mia", ...bairro, requestTypeIds: ["castration", "castration"] }];
  const result = prepare(procedureInput(animals, { body: { animals, cpf, phone } }));
  assert.equal(result.requestType, "Microchipagem, Castração");
  assert.deepEqual(result.animals, [{ name: "Rex", ...bairro, requestTypeIds: ["microchip", "castration"] }, { name: "Mia", ...bairro, requestTypeIds: ["castration"] }]);
  assert.deepEqual(result.workflow.requestTypeIds, ["microchip", "castration"]);
  assert.deepEqual(result.workflow.requestTypeNames, ["Microchipagem", "Castração"]);
  assert.equal(result.workflow.requestTypeId, undefined);
});

test("the single type, the type text and the derived workflow keys a client sends are ignored when procedures are present", () => {
  const animals = [{ ...bairro, requestTypeIds: ["microchip"] }];
  const result = prepare({ ...procedureInput(animals, { body: { animals, cpf, phone, requestTypeId: "castration", type: "Castração", request_type: "Castração" } }),
    workflow: { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false }, requestTypeIds: ["castration"], requestTypeNames: ["Forjado"], requestTypeId: "castration" } });
  assert.equal(result.requestType, "Microchipagem");
  assert.deepEqual(result.workflow.requestTypeIds, ["microchip"]);
  assert.deepEqual(result.workflow.requestTypeNames, ["Microchipagem"]);
  assert.equal(Object.hasOwn(result.workflow, "requestTypeId"), false);
});

test("a request without the procedures of each animal is refused, for the public and the staff alike", () => {
  for (const user of [undefined, { role: "analista" }]) {
    for (const body of [{ requestTypeId: "castration", cpf, phone }, { requestTypeId: "castration", cpf, phone, animals: [{ name: "Rex", ...bairro }] },
      { request_type: "Castração", cpf, phone, animals: [] }]) {
      assert.throws(() => prepare({ ...procedureInput([]), user, body }), /ao menos um procedimento/, JSON.stringify(body));
    }
  }
});

test("the tutor is dispensed only by the answer about the tutor, never by a procedure", () => {
  const { WITH_TUTOR, WITHOUT_TUTOR } = AnimalTutorship;
  const settings = procedureSettings();
  const run = (animals, tutorship, body = {}) => prepare({ body: { animals, ...body }, settings, workflow: { tutorship, followUp: { enabled: false } } });
  const noTutor = [{ ...bairro, requestTypeIds: ["no-tutor"] }, { ...bairro, requestTypeIds: ["no-tutor-too"] }];
  const needsTutor = [{ ...bairro, requestTypeIds: ["castration"] }, { ...bairro, requestTypeIds: ["microchip"] }];
  assert.throws(() => run(noTutor, WITH_TUTOR), /CPF/, "a procedure whose type has no tutor step does not dispense it");
  assert.throws(() => run([...noTutor, ...needsTutor], WITH_TUTOR), /CPF/);
  assert.throws(() => run([{ ...bairro, requestTypeIds: ["castration", "no-tutor"] }], WITH_TUTOR), /CPF/);
  assert.deepEqual([run(noTutor, WITHOUT_TUTOR).tutorRequired, run(noTutor, WITHOUT_TUTOR).cpf], [false, null]);
  assert.equal(run(needsTutor, WITHOUT_TUTOR).tutorRequired, false, "the answer alone may dispense it");
  assert.throws(() => run(needsTutor, WITH_TUTOR), /CPF/);
  assert.equal(run(needsTutor, WITH_TUTOR, { cpf, phone }).tutorRequired, true);
});

test("a request with procedures refuses unknown, switched-off or missing ones for public and staff alike", () => {
  const staff = { role: "analista" };
  for (const user of [undefined, staff]) {
    const input = (animals) => procedureInput(animals, { user, body: { animals, cpf, phone } });
    assert.throws(() => prepare(input([{ ...bairro, requestTypeIds: ["unknown"] }])), /solicitação/);
    assert.throws(() => prepare(input([{ ...bairro, requestTypeIds: ["vaccine"] }])), /solicitação/);
    assert.throws(() => prepare(input([{ ...bairro, requestTypeIds: ["castration"] }, { ...bairro, name: "Sem procedimento", requestTypeIds: [] }])), /ao menos um procedimento/);
    assert.equal(prepare(input([{ ...bairro, requestTypeIds: ["castration"] }])).requestType, "Castração");
  }
});

test("staff also get the derived type, and still need a CPF unless they say that the animal has no tutor", () => {
  const staff = { role: "analista" };
  const animals = [{ ...bairro, requestTypeIds: ["microchip"] }, { ...bairro, requestTypeIds: ["castration"] }];
  assert.throws(() => prepare(procedureInput(animals, { user: staff })), /CPF/);
  const withCpf = prepare(procedureInput(animals, { user: staff, body: { animals, cpf, phone } }));
  assert.deepEqual([withCpf.internal, withCpf.requestType, withCpf.tutorRequired], [true, "Microchipagem, Castração", true]);
  const stray = prepare({ body: { animals }, user: staff, settings: procedureSettings(), workflow: { tutorship: AnimalTutorship.WITHOUT_TUTOR } });
  assert.deepEqual([stray.cpf, stray.tutorRequired, stray.requestType], [null, false, "Microchipagem, Castração"]);
});

test("a complaint ignores procedures: it is not a procedure and has its own requirements", () => {
  const body = { request_type: "DENUNCIA", cpf, tutor_name: "Cidadão", phone: "48999991234", animals: [{ requestTypeIds: ["unknown"] }] };
  const result = prepare({ body, settings: procedureSettings(), workflow: {} });
  assert.equal(result.requestType, "DENUNCIA");
  assert.equal(result.animals, undefined);
  assert.equal(Object.hasOwn(result.workflow, "requestTypeIds"), false);
});

test("PATCH cannot overwrite the derived procedures, which only the server recomputes", () => {
  const current = { requestTypeIds: ["castration"], requestTypeNames: ["Castração"], scheduleTime: "08:00" };
  assert.deepEqual(mergeProtectedWorkflow(current, { requestTypeIds: ["forged"], requestTypeNames: ["Forjado"], scheduleTime: "09:00" }),
    { requestTypeIds: ["castration"], requestTypeNames: ["Castração"], scheduleTime: "09:00" });
  assert.deepEqual(mergeProtectedWorkflow({ scheduleTime: "08:00" }, { requestTypeIds: ["forged"], requestTypeNames: ["Forjado"] }), { scheduleTime: "08:00" });
});

test("the tutor's mobile is required wherever the tutor is, whoever fills the form, and only a mobile counts", () => {
  for (const user of [undefined, { role: "analista" }]) {
    for (const bad of [undefined, null, "", "   ", "123", "(48) 3333-4444", "4833334444", "(48) 8999-1234", "(00) 99999-1234", "(48) 99999-12345", "abc", 48999991234.5]) {
      assert.throws(() => prepare({ user, body: { ...defaults.body, phone: bad } }), { status: 400, message: /celular completo/ }, `${user?.role || "public"} ${String(bad)}`);
    }
    for (const good of [phone, "48999991234", "(11) 91234-5678"]) assert.equal(prepare({ user, body: { ...defaults.body, phone: good } }).cpf, cpf, good);
  }
});

test("the mobile is not asked of a logged tutor (the profile has it), a tutorless flow or a complaint, which keeps its own phone rule", () => {
  const { phone: _omitted, ...withoutPhone } = defaults.body;
  assert.equal(prepare({ user: { role: "tutor", profileComplete: true }, body: withoutPhone }).cpf, cpf);
  for (const user of [undefined, { role: "analista" }]) {
    assert.equal(prepare({ user, body: { animals: surgery() }, workflow: { tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false } } }).cpf, null);
  }
  const complaint = { request_type: "DENUNCIA", cpf, tutor_name: "Cidadão" };
  assert.throws(() => prepare({ body: complaint, workflow: {} }), /telefone/);
  assert.equal(prepare({ body: { ...complaint, phone: "(48) 3333-4444" }, workflow: {} }).requestType, "DENUNCIA", "the complaint still accepts any valid phone");
});

test("the follow-up needs at least one contact, and an internal request carries its follow-up through", () => {
  const settings = { ...structuredClone(defaults.settings), phoneEnabled: true };
  const only = (contacts, extra = {}) => prepare({ settings, ...extra, workflow: { followUp: { enabled: true, ...contacts } } }).workflow.followUp;
  assert.deepEqual(only({ email: "citizen@example.com" }), { enabled: true, email: "citizen@example.com", phone: "" });
  assert.deepEqual(only({ phone: "(48) 99999-1234" }), { enabled: true, email: "", phone: "48999991234" });
  assert.deepEqual(only({ email: "citizen@example.com", phone: "(48) 99999-1234" }), { enabled: true, email: "citizen@example.com", phone: "48999991234" });
  for (const contacts of [{}, { email: "", phone: "" }]) assert.throws(() => only(contacts), /ao menos um contato/);
  assert.throws(() => prepare({ workflow: { followUp: { enabled: true, phone: "(48) 99999-1234" } } }), /ao menos um contato/, "no phone channel, no e-mail");
  assert.deepEqual(only({ phone: "(48) 99999-1234" }, { user: { role: "analista" } }), { enabled: true, email: "", phone: "48999991234" });
  assert.equal(prepare({ user: { role: "analista" }, workflow: {} }).workflow.followUp, undefined, "the internal request may still go without the answer");
});

test("the request types of the staff's animals do not dispense the tutor either", () => {
  const user = { role: "analista" };
  const asked = (...ids) => procedureInput([{ ...bairro, requestTypeIds: ids }], { user });
  for (const ids of [["no-tutor"], ["no-tutor", "no-tutor-too"], ["castration", "no-tutor"], ["castration"]]) {
    assert.throws(() => prepare(asked(...ids)), /CPF/, ids.join());
  }
});
