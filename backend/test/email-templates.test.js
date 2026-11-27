import test from "node:test";
import assert from "node:assert/strict";
import { listEmailUses, resolveEmailTemplate, saveEmailTemplateIds, setEmailUseActive } from "../src/services/email-templates.js";
import { EMAIL_ACTIVE_USES_CONFIG_KEY, EMAIL_TEMPLATES_CONFIG_KEY, isEmailUseActive, normalizeEmailActiveUses, normalizeEmailTemplateIds } from "../../shared/email-contract.js";
import { EmailUseKind, emailUses, getEmailUse } from "../../shared/email-uses-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { DeliveryCode, NotificationEvent } from "../../shared/notification-contract.js";
import { fakeEmailDatabase } from "./fixtures/email-config-db.js";
import { clearServerCredentials, replaceServerCredentials, TEST_EMAIL_CREDENTIALS } from "./fixtures/server-credentials.js";

// The platform account comes from the server's variables; these tests use a fake one.
clearServerCredentials();
Object.assign(process.env, TEST_EMAIL_CREDENTIALS);

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const municipalities = { [MUNICIPALITY]: { name: "Test Town" }, [OTHER]: { name: "Other Town" } };
const account = { serviceId: "service_test", publicKey: "public-key-test", privateKey: "private-key-test", publicUrl: "", issues: [] };
const RESET = AuthPurpose.PASSWORD_RESET;
const CONFIRMED = NotificationEvent.SCHEDULE_CONFIRMED;

function configured(extra = {}) {
  return fakeEmailDatabase({ municipalities, configs: {
    [`${EMAIL_TEMPLATES_CONFIG_KEY}:null`]: { templates: { [RESET]: "tpl_reset", [CONFIRMED]: "tpl_confirmed" } },
    ...extra,
  } });
}

test("there are eleven uses, seven notices and four access messages; neither phone confirmation nor the initial password is one of them", () => {
  assert.equal(emailUses.length, 11);
  assert.equal(emailUses.filter(({ kind }) => kind === EmailUseKind.NOTICE).length, 7);
  assert.equal(emailUses.filter(({ kind }) => kind === EmailUseKind.ACCESS).length, 4);
  assert.equal(getEmailUse("initial_password"), null);
  assert.equal(new Set(emailUses.map(({ key }) => key)).size, 11);
  for (const event of Object.values(NotificationEvent)) assert.ok(getEmailUse(event), event);
  assert.equal(getEmailUse(AuthPurpose.VERIFY_PHONE), null);
  assert.deepEqual(emailUses.filter(({ defaultActive }) => defaultActive).map(({ key }) => key), [RESET]);
});

test("every use carries the recipient and the municipality identity, and only agenda notices carry the schedule fields", () => {
  for (const use of emailUses) {
    for (const name of ["to_email", "to_name", "municipality_name", "municipality_brasao_url", "department_name", "department_logo_url", "municipality_contact", "municipality_email", "municipality_address"]) {
      assert.ok(use.variables.includes(name), `${use.key} must carry ${name}`);
    }
  }
  const schedule = [NotificationEvent.SCHEDULE_CONFIRMED, NotificationEvent.SCHEDULE_CHANGED, NotificationEvent.SCHEDULE_CANCELLED, NotificationEvent.NO_SHOW];
  for (const use of emailUses) assert.equal(use.variables.includes("schedule_date"), schedule.includes(use.key), use.key);
  assert.equal(emailUses.some(({ variables }) => variables.includes("documents_result")), false);
  assert.ok(getEmailUse(AuthPurpose.CONTACT_CHANGED).variables.includes("changed_fields"));
  assert.deepEqual(emailUses.map(({ label }) => label).slice(0, 7), ["Solicitação registrada", "Agendamento confirmado", "Agendamento alterado", "Agendamento cancelado", "Não comparecimento", "Atendimento concluído", "Solicitação indeferida"]);
  assert.ok(getEmailUse(RESET).variables.includes("codigo_recuperacao"));
  assert.equal(emailUses.some(({ variables }) => variables.includes("temporary_password")), false);
});

test("stored templates and switches keep only known uses, and an explicit false survives the password default", () => {
  assert.deepEqual(normalizeEmailTemplateIds({ templates: { [RESET]: " tpl_reset ", [CONFIRMED]: "bad id", unknown: "tpl", [AuthPurpose.VERIFY_PHONE]: "tpl" } }), { [RESET]: "tpl_reset" });
  assert.deepEqual(normalizeEmailTemplateIds(null), {});
  assert.deepEqual(normalizeEmailActiveUses({ active: { [RESET]: false, [CONFIRMED]: true, unknown: true, [AuthPurpose.VERIFY_EMAIL]: "yes" } }), { [RESET]: false, [CONFIRMED]: true });
  assert.equal(isEmailUseActive({}, RESET), true);
  assert.equal(isEmailUseActive({ [RESET]: false }, RESET), false);
  assert.equal(isEmailUseActive({}, CONFIRMED), false);
});

test("the master sees ids and variables; a municipal viewer only learns which uses are configured and on", async () => {
  const database = configured({ [`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`]: { active: { [CONFIRMED]: true } } });
  const master = await listEmailUses({ account, municipalityId: MUNICIPALITY, master: true, database });
  const municipal = await listEmailUses({ account, municipalityId: MUNICIPALITY, master: false, database });
  assert.equal(master.length, emailUses.length);
  assert.equal(master.find(({ key }) => key === RESET).templateId, "tpl_reset");
  assert.ok(master.find(({ key }) => key === RESET).variables.includes("code"));
  for (const row of municipal) assert.equal(Object.hasOwn(row, "templateId") || Object.hasOwn(row, "variables"), false);
  const inListOrder = (keys) => emailUses.map(({ key }) => key).filter((key) => keys.includes(key));
  assert.deepEqual(municipal.filter(({ configured: ready }) => ready).map(({ key }) => key), inListOrder([CONFIRMED, RESET]));
  assert.deepEqual(municipal.filter(({ active }) => active).map(({ key }) => key), inListOrder([CONFIRMED, RESET]));
  assert.equal(JSON.stringify(municipal).includes("tpl_"), false);
});

test("without a municipality nothing is on, and without the account nothing is configured", async () => {
  const database = configured();
  assert.equal((await listEmailUses({ account, municipalityId: null, master: true, database })).some(({ active }) => active), false);
  const empty = fakeEmailDatabase({ municipalities });
  assert.equal((await listEmailUses({ account: {}, municipalityId: MUNICIPALITY, master: true, database: empty })).some(({ configured: ready }) => ready), false);
});

test("the master sets ids once for everyone, clears one with an empty value, and the change is audited without a municipality", async () => {
  const database = fakeEmailDatabase({ municipalities });
  await saveEmailTemplateIds({ patch: { [RESET]: " tpl_reset ", [CONFIRMED]: "tpl_confirmed" }, audit: { userId: "master-1", municipalityId: MUNICIPALITY }, database });
  assert.deepEqual(database.store.get(`${EMAIL_TEMPLATES_CONFIG_KEY}:null`), { templates: { [RESET]: "tpl_reset", [CONFIRMED]: "tpl_confirmed" } });
  await saveEmailTemplateIds({ patch: { [CONFIRMED]: "" }, database });
  assert.deepEqual(database.store.get(`${EMAIL_TEMPLATES_CONFIG_KEY}:null`), { templates: { [RESET]: "tpl_reset" } });
  assert.equal(database.audits[0].action, "EMAIL_TEMPLATES_UPDATE");
  assert.equal(database.audits[0].municipalityId, null);
  assert.deepEqual(database.audits[0].changes, { uses: [RESET, CONFIRMED] });
  for (const patch of [null, [], { unknown: "tpl" }, { [AuthPurpose.VERIFY_PHONE]: "tpl" }, { [RESET]: "bad id" }, { [RESET]: 5 }, { [RESET]: "x".repeat(201) }]) {
    await assert.rejects(saveEmailTemplateIds({ patch, database }), { status: 400 }, JSON.stringify(patch));
  }
});

test("a use can only be turned on once the master has set the account and its template; turning off is always allowed", async () => {
  const bare = fakeEmailDatabase({ municipalities });
  await assert.rejects(setEmailUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, database: bare }), { status: 400 });
  await setEmailUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: false, database: bare });
  assert.deepEqual(bare.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [CONFIRMED]: false } });
  const noTemplate = configured();
  await assert.rejects(setEmailUseActive({ municipalityId: MUNICIPALITY, use: NotificationEvent.COMPLETED, active: true, database: noTemplate }), { status: 400 });
  const noAccount = fakeEmailDatabase({ municipalities, configs: { [`${EMAIL_TEMPLATES_CONFIG_KEY}:null`]: { templates: { [CONFIRMED]: "tpl_confirmed" } } } });
  await assert.rejects(setEmailUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, database: noAccount, env: {} }), { status: 400 });
});

test("turning a use on is stored and audited for that municipality only", async () => {
  const database = configured();
  await setEmailUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, audit: { userId: "admin-1", municipalityId: OTHER }, database });
  assert.deepEqual(database.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [CONFIRMED]: true } });
  assert.equal(database.store.has(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${OTHER}`), false);
  assert.deepEqual([database.audits[0].action, database.audits[0].municipalityId, database.audits[0].changes], ["EMAIL_USE_UPDATE", MUNICIPALITY, { use: CONFIRMED, active: true }]);
  await setEmailUseActive({ municipalityId: MUNICIPALITY, use: RESET, active: false, database });
  assert.deepEqual(database.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [CONFIRMED]: true, [RESET]: false } });
});

test("the switch request is validated: known use, real boolean, existing municipality", async () => {
  const database = configured();
  for (const body of [{ use: "unknown", active: true }, { use: AuthPurpose.VERIFY_PHONE, active: true }, { use: CONFIRMED, active: "true" }, { use: CONFIRMED }]) {
    await assert.rejects(setEmailUseActive({ municipalityId: MUNICIPALITY, ...body, database }), { status: 400 }, JSON.stringify(body));
  }
  await assert.rejects(setEmailUseActive({ municipalityId: "33333333-3333-4333-8333-333333333333", use: CONFIRMED, active: true, database }), { status: 404 });
  await assert.rejects(setEmailUseActive({ municipalityId: null, use: CONFIRMED, active: true, database }), { status: 400 });
});

test("resolving a use answers whether it may be sent: on for the municipality first, then configured", async () => {
  const database = configured();
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: RESET, database }), { ok: true, templateId: "tpl_reset" });
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: CONFIRMED, database }), { ok: false, code: DeliveryCode.CHANNEL_DISABLED });
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: NotificationEvent.COMPLETED, database }), { ok: false, code: DeliveryCode.CHANNEL_DISABLED });
  const gap = configured({ [`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`]: { active: { [NotificationEvent.COMPLETED]: true } } });
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: NotificationEvent.COMPLETED, database: gap }), { ok: false, code: DeliveryCode.NOT_CONFIGURED });
  await setEmailUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, database });
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: CONFIRMED, database }), { ok: true, templateId: "tpl_confirmed" });
  assert.equal((await resolveEmailTemplate({ municipalityId: OTHER, use: CONFIRMED, database })).code, DeliveryCode.CHANNEL_DISABLED);
});

test("an explicit off beats the password-recovery default, and the platform (no municipality) has no switch", async () => {
  const database = configured({ [`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`]: { active: { [RESET]: false } } });
  assert.equal((await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: RESET, database })).code, DeliveryCode.CHANNEL_DISABLED);
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: null, use: RESET, database }), { ok: true, templateId: "tpl_reset" });
  assert.equal((await resolveEmailTemplate({ municipalityId: null, use: CONFIRMED, database })).ok, true);
});

test("clearing an id stops the use without losing the municipal switch, which applies again when the id returns", async () => {
  const database = configured({ [`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`]: { active: { [CONFIRMED]: true } } });
  assert.equal((await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: CONFIRMED, database })).ok, true);
  await saveEmailTemplateIds({ patch: { [CONFIRMED]: "" }, database });
  assert.equal((await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: CONFIRMED, database })).code, DeliveryCode.NOT_CONFIGURED);
  assert.deepEqual(database.store.get(`${EMAIL_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`), { active: { [CONFIRMED]: true } });
  await saveEmailTemplateIds({ patch: { [CONFIRMED]: "tpl_confirmed_v2" }, database });
  assert.deepEqual(await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: CONFIRMED, database }), { ok: true, templateId: "tpl_confirmed_v2" });
});

test("an incomplete account makes every use unavailable, even the platform recovery", async (t) => {
  t.after(replaceServerCredentials({ EMAILJS_SERVICE_ID: "service_test" }));
  const database = configured();
  assert.equal((await resolveEmailTemplate({ municipalityId: null, use: RESET, database })).code, DeliveryCode.NOT_CONFIGURED);
  assert.equal((await resolveEmailTemplate({ municipalityId: MUNICIPALITY, use: RESET, database })).code, DeliveryCode.NOT_CONFIGURED);
});
