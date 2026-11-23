import test from "node:test";
import assert from "node:assert/strict";
import { SMS_ACTIVE_USES_CONFIG_KEY, isSmsUseActive, normalizeSmsActiveUses, normalizeSmsUseRows } from "../../shared/sms-contract.js";
import { SmsUseKind, getSmsUse, smsUses } from "../../shared/sms-uses-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { NotificationEvent } from "../../shared/notification-contract.js";
import { isSmsUseOn, listSmsUses, loadActiveSmsUses, setSmsUseActive } from "../src/services/sms-uses.js";
import { smsSettingsDatabase, SMS_TEST_MUNICIPALITY as MUNICIPALITY, SMS_TEST_OTHER as OTHER } from "./fixtures/sms-settings-db.js";
import { clearServerCredentials, useServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();

const RESET = AuthPurpose.PASSWORD_RESET;
const CONFIRMED = NotificationEvent.SCHEDULE_CONFIRMED;
const COMPLETED = NotificationEvent.COMPLETED;
const TOKEN = "production-test-token";
const keyOf = (municipalityId) => `${SMS_ACTIVE_USES_CONFIG_KEY}:${municipalityId}`;

// SMS integrated (a fake production token in the server's variables) unless told otherwise.
function fixture(t, { integrated = true } = {}) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "sms-uses-test-secret";
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  useServerCredentials(t, { SMS_TOKEN: TOKEN });
  if (!integrated) delete process.env.SMS_TOKEN;
  return { database: smsSettingsDatabase() };
}

test("there are thirteen uses: nine notices and four access messages, without the initial password or e-mail confirmation", () => {
  assert.equal(smsUses.length, 13);
  assert.equal(smsUses.filter(({ kind }) => kind === SmsUseKind.NOTICE).length, 9);
  assert.equal(smsUses.filter(({ kind }) => kind === SmsUseKind.ACCESS).length, 4);
  assert.equal(new Set(smsUses.map(({ key }) => key)).size, 13);
  for (const event of Object.values(NotificationEvent)) assert.equal(getSmsUse(event)?.kind, SmsUseKind.NOTICE, event);
  for (const purpose of [RESET, AuthPurpose.VERIFY_PHONE, AuthPurpose.REQUEST_TRACKING, AuthPurpose.CONTACT_CHANGED]) assert.equal(getSmsUse(purpose)?.kind, SmsUseKind.ACCESS, purpose);
  for (const purpose of ["initial_password", AuthPurpose.VERIFY_EMAIL, "unknown", undefined]) assert.equal(getSmsUse(purpose), null, String(purpose));
  for (const use of smsUses) assert.ok(use.label && typeof use.label === "string", use.key);
});

test("only password recovery starts on, and an explicit off beats that default", () => {
  assert.deepEqual(smsUses.filter(({ defaultActive }) => defaultActive).map(({ key }) => key), [RESET]);
  assert.equal(isSmsUseActive({}, RESET), true);
  assert.equal(isSmsUseActive({ [RESET]: false }, RESET), false);
  assert.equal(isSmsUseActive({}, CONFIRMED), false);
  assert.equal(isSmsUseActive({ [CONFIRMED]: true }, CONFIRMED), true);
  assert.equal(isSmsUseActive({ [CONFIRMED]: true }, "unknown"), false);
  assert.deepEqual(normalizeSmsUseRows().filter(({ active }) => active).map(({ key }) => key), [RESET]);
});

test("stored switches keep only known uses with real booleans", () => {
  assert.deepEqual(normalizeSmsActiveUses({ active: { [RESET]: false, [COMPLETED]: true, unknown: true, [CONFIRMED]: "yes", initial_password: true } }),
    { [RESET]: false, [COMPLETED]: true });
  for (const stored of [null, undefined, [], "text", 5, { active: null }, { active: [] }]) assert.deepEqual(normalizeSmsActiveUses(stored), {}, JSON.stringify(stored));
  const rows = normalizeSmsUseRows([{ key: CONFIRMED, active: true }, { key: RESET, active: false }, { key: "unknown", active: true }, null, { key: COMPLETED, active: "yes" }]);
  assert.deepEqual(rows.map(({ key, active }) => [key, active]).filter(([, active]) => active !== false), [[CONFIRMED, true]]);
  assert.equal(rows.find(({ key }) => key === RESET).active, false);
  assert.equal(rows.find(({ key }) => key === COMPLETED).active, false);
  assert.equal(rows.length, smsUses.length);
});

test("a municipality starts with the defaults, and the switches of one never show in another", async (t) => {
  const { database } = fixture(t, { integrated: false });
  const fresh = await listSmsUses({ municipalityId: MUNICIPALITY, database });
  assert.deepEqual(fresh.map(({ key }) => key), smsUses.map(({ key }) => key));
  assert.deepEqual(fresh.filter(({ active }) => active).map(({ key }) => key), [RESET]);
  database.configs.set(keyOf(MUNICIPALITY), { active: { [CONFIRMED]: true, [RESET]: false } });
  assert.deepEqual((await listSmsUses({ municipalityId: MUNICIPALITY, database })).filter(({ active }) => active).map(({ key }) => key), [CONFIRMED]);
  assert.deepEqual((await listSmsUses({ municipalityId: OTHER, database })).filter(({ active }) => active).map(({ key }) => key), [RESET]);
  assert.equal(await isSmsUseOn({ municipalityId: MUNICIPALITY, use: CONFIRMED, database }), true);
  assert.equal(await isSmsUseOn({ municipalityId: OTHER, use: CONFIRMED, database }), false);
  assert.deepEqual(await loadActiveSmsUses(MUNICIPALITY, database), { [CONFIRMED]: true, [RESET]: false });
});

test("a message can only be turned on while SMS is integrated; turning it off is always allowed and is remembered", async (t) => {
  const { database } = fixture(t, { integrated: false });
  await assert.rejects(setSmsUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, database }), { status: 400, message: /não está integrado/ });
  assert.equal(database.configs.has(keyOf(MUNICIPALITY)), false);
  await setSmsUseActive({ municipalityId: MUNICIPALITY, use: RESET, active: false, database });
  assert.deepEqual(database.configs.get(keyOf(MUNICIPALITY)), { active: { [RESET]: false } });
  assert.equal(await isSmsUseOn({ municipalityId: MUNICIPALITY, use: RESET, database }), false);
});

test("turning a message on is stored for that municipality only and audited without secrets", async (t) => {
  const { database } = fixture(t);
  await setSmsUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, audit: { userId: "admin-1", municipalityId: OTHER }, database });
  assert.deepEqual(database.configs.get(keyOf(MUNICIPALITY)), { active: { [CONFIRMED]: true } });
  assert.equal(database.configs.has(keyOf(OTHER)), false);
  assert.deepEqual(database.audits.map(({ action, municipalityId, entityId, changes }) => [action, municipalityId, entityId, changes]),
    [["SMS_USE_UPDATE", MUNICIPALITY, SMS_ACTIVE_USES_CONFIG_KEY, { use: CONFIRMED, active: true }]]);
  await setSmsUseActive({ municipalityId: MUNICIPALITY, use: COMPLETED, active: true, database });
  await setSmsUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: false, database });
  assert.deepEqual(database.configs.get(keyOf(MUNICIPALITY)), { active: { [CONFIRMED]: false, [COMPLETED]: true } });
  assert.equal(JSON.stringify(database.audits).includes(TOKEN), false);
  assert.equal(JSON.stringify(database.audits).includes("enc:v1:"), false);
  assert.equal(JSON.stringify(database.configs.get(keyOf(MUNICIPALITY))).includes(TOKEN), false);
});

test("the request is validated: a known use, a real boolean and an active municipality", async (t) => {
  const { database } = fixture(t);
  for (const body of [{ use: "unknown", active: true }, { use: "initial_password", active: true }, { use: AuthPurpose.VERIFY_EMAIL, active: false },
    { use: CONFIRMED, active: "true" }, { use: CONFIRMED, active: 1 }, { use: CONFIRMED }, { active: true }, {}]) {
    await assert.rejects(setSmsUseActive({ municipalityId: MUNICIPALITY, ...body, database }), { status: 400 }, JSON.stringify(body));
  }
  for (const municipalityId of ["33333333-3333-4333-8333-333333333333", "not-a-municipality", null, undefined, ""]) {
    await assert.rejects(setSmsUseActive({ municipalityId, use: CONFIRMED, active: false, database }), { status: 400 }, String(municipalityId));
  }
  assert.equal(database.configs.size, 0);
  assert.equal(database.audits.length, 0);
});

test("losing the integration keeps the switches, which apply again when the token comes back", async (t) => {
  const { database } = fixture(t);
  await setSmsUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, database });
  delete process.env.SMS_TOKEN;
  assert.deepEqual(database.configs.get(keyOf(MUNICIPALITY)), { active: { [CONFIRMED]: true } });
  await assert.rejects(setSmsUseActive({ municipalityId: MUNICIPALITY, use: COMPLETED, active: true, database }), { status: 400 });
  process.env.SMS_TOKEN = TOKEN;
  assert.equal(await isSmsUseOn({ municipalityId: MUNICIPALITY, use: CONFIRMED, database }), true);
  assert.equal(await isSmsUseOn({ municipalityId: MUNICIPALITY, use: COMPLETED, database }), false);
});

test("turning a message on does not depend on the contract: the contract decides the sending, not the switches", async (t) => {
  const { database } = fixture(t);
  database.setContract(MUNICIPALITY, { plan: 10, enabled: false });
  await setSmsUseActive({ municipalityId: MUNICIPALITY, use: CONFIRMED, active: true, database });
  assert.equal(await isSmsUseOn({ municipalityId: MUNICIPALITY, use: CONFIRMED, database }), true);
  assert.deepEqual(database.contractOf(MUNICIPALITY), { plan: 10, enabled: false }, "the contract is not touched");
});
