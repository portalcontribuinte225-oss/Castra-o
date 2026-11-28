import test from "node:test";
import assert from "node:assert/strict";
import { SMS_ACTIVE_USES_CONFIG_KEY, validateSmsToken } from "../../shared/sms-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { DeliveryCode, DeliveryStatus, NotificationEvent } from "../../shared/notification-contract.js";
import { smsUses } from "../../shared/sms-uses-contract.js";
import { messageQuotaDates } from "../../shared/message-quota-contract.js";
import { getSmsIntegrationSettings, getPublicSmsConfig, getSmsAvailability, isSmsUseAvailable, sendSmsTestMessage, sendSmsUse } from "../src/services/sms-integration-settings.js";
import { isSmsIntegrated, readProductionSmsToken } from "../src/services/sms-credential.js";
import { smsSettingsDatabase, SMS_TEST_MUNICIPALITY as MUNICIPALITY, SMS_TEST_OTHER as OTHER } from "./fixtures/sms-settings-db.js";
import { clearServerCredentials, useServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();

const ACTOR = { id: "33333333-3333-4333-8333-333333333333", role: "master", municipalityId: null };
const TOKEN = "production-test-token";
// The token lives in the server's variables (SMS_TOKEN); each test starts with a fake production one.
const setToken = (value) => { if (value) process.env.SMS_TOKEN = value; else delete process.env.SMS_TOKEN; };
function fixture(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "sms-settings-test-secret";
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  useServerCredentials(t, { SMS_TOKEN: TOKEN });
  const database = smsSettingsDatabase();
  const read = (municipalityId = null, master = true) => getSmsIntegrationSettings({ municipalityId, master }, { database });
  return { database, read };
}

test("SMS is integrated only with a production token in the server's variables, and no part of the token is ever returned", async (t) => {
  const f = fixture(t); const settings = await f.read();
  assert.equal(settings.integrated, true);
  assert.deepEqual(Object.keys(settings).sort(), ["integrated", "municipalityName", "uses"]);
  assert.equal(JSON.stringify(settings).includes(TOKEN.slice(0, 8)), false);
  for (const token of ["", "Bearer secret", "sbx_example-test-token"]) {
    setToken(token); assert.equal((await f.read()).integrated, false, token); assert.equal(readProductionSmsToken(), "", token);
  }
  setToken("replacement-token-test"); assert.equal(isSmsIntegrated(), true, "a new token in Render applies at once");
  assert.equal(f.database.calls.some(({ sql }) => sql.includes("INSERT")), false, "reading stores nothing");
});

test("the municipal administration and the master read the same view: integrated, the municipality's name and one switch per message", async (t) => {
  const f = fixture(t);
  const settings = await f.read(MUNICIPALITY, false);
  assert.equal(settings.integrated, true); assert.equal(settings.municipalityName, "Test Town");
  assert.deepEqual(settings.uses.map(({ key }) => key), smsUses.map(({ key }) => key));
  assert.deepEqual(settings.uses.filter(({ active }) => active).map(({ key }) => key), [AuthPurpose.PASSWORD_RESET], "only password recovery is on by default");
  assert.equal((await f.read(OTHER, false)).municipalityName, "Other Town");
  assert.deepEqual(await f.read(MUNICIPALITY), settings);
  assert.equal((await f.read(null, true)).municipalityName, "");
  await assert.rejects(f.read("33333333-3333-4333-8333-333333333333", false), { status: 400 });
  await assert.rejects(f.read(null, false), { status: 400 });
});

test("a visitor learns only whether SMS can reach the municipality, never the token or the messages", async (t) => {
  const f = fixture(t); const asked = (id) => getPublicSmsConfig(id, { database: f.database });
  assert.deepEqual(await asked(MUNICIPALITY), { active: false }, "the municipality has no contract");
  f.database.setContract(MUNICIPALITY, { plan: 10 });
  assert.deepEqual(await asked(MUNICIPALITY), { active: true });
  assert.deepEqual(await asked(OTHER), { active: false }, "another municipality's contract does not count");
  for (const token of ["", "sbx_example-test-token"]) { setToken(token); assert.deepEqual(await asked(MUNICIPALITY), { active: false }, token); }
  setToken(TOKEN);
  f.database.setContract(MUNICIPALITY, { plan: 10, contractEnd: "2020-01-01" });
  assert.deepEqual(await asked(MUNICIPALITY), { active: false }, "the contract ended");
  f.database.setContract(MUNICIPALITY, { plan: 10, enabled: false });
  assert.deepEqual(await asked(MUNICIPALITY), { active: false }, "the contract is switched off");
  f.database.setContract(MUNICIPALITY, { plan: 10, currentPeriodStart: "2000-01", currentPeriodUsed: 10 });
  assert.deepEqual(await asked(MUNICIPALITY), { active: true }, "an empty balance does not hide the channel");
  await assert.rejects(asked("not-a-municipality"), { status: 400 });
  await assert.rejects(asked(undefined), { status: 400 });
});

test("a message is available only with SMS integrated, the contract with room and that message on, and asking performs no provider call", async (t) => {
  const f = fixture(t); const reset = AuthPurpose.PASSWORD_RESET; const available = (use) => isSmsUseAvailable({ municipalityId: MUNICIPALITY, use, database: f.database });
  assert.equal((await available(reset)).available, false, "the municipality has no contract");
  f.database.setContract(MUNICIPALITY, { plan: 1 });
  assert.equal((await available(reset)).available, true);
  assert.equal((await available(NotificationEvent.COMPLETED)).available, false);
  f.database.configs.set(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`, { active: { [reset]: false, [NotificationEvent.COMPLETED]: true } });
  assert.equal((await available(reset)).available, false);
  assert.equal((await available(NotificationEvent.COMPLETED)).available, true);
  f.database.setContract(MUNICIPALITY, { plan: 1, currentPeriodStart: messageQuotaDates().period, currentPeriodUsed: 1 });
  assert.equal((await available(NotificationEvent.COMPLETED)).available, false, "the month's balance is spent");
  f.database.setContract(MUNICIPALITY, { plan: 1 });
  setToken("sbx_example-test-token");
  assert.equal((await available(NotificationEvent.COMPLETED)).available, false, "a sandbox token never sends");
  assert.equal((await getSmsAvailability(MUNICIPALITY, { database: f.database })).available, false);
  setToken(TOKEN);
  assert.equal((await isSmsUseAvailable({ municipalityId: null, use: reset, database: f.database })).available, false);
  assert.equal(f.database.contractOf(MUNICIPALITY).currentPeriodUsed, undefined, "asking spends nothing");
});

test("sending a message builds the fixed text for the municipality through the platform's token, while the token, the message and the contract allow", async (t) => {
  const f = fixture(t); const sent = [];
  const sendMessage = async (input) => { sent.push(input); assert.equal(input.token, TOKEN); return { status: DeliveryStatus.SENT }; };
  const deps = { database: f.database, sendMessage };
  const reset = { municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET, phone: "48999991234", data: { code: "123456", minutes: "10" },
    messageId: ACTOR.id, expiresAt: "2026-11-13T12:10:00Z" };
  setToken("");
  const unintegrated = await sendSmsUse(reset, deps);
  assert.deepEqual([unintegrated.status, unintegrated.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, 0]);
  setToken(TOKEN);
  const uncontracted = await sendSmsUse(reset, deps);
  assert.deepEqual([uncontracted.status, uncontracted.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE, 0], "no contract, no send");
  f.database.setContract(MUNICIPALITY, { plan: 2 });
  assert.equal((await sendSmsUse(reset, deps)).status, DeliveryStatus.SENT);
  assert.deepEqual(sent[0], { token: TOKEN, phone: "48999991234", text: "Test Town: use o código 123456 para redefinir sua senha. Válido por 10 minutos. Não compartilhe.",
    messageId: ACTOR.id, expiresAt: "2026-11-13T12:10:00Z" });
  assert.equal(f.database.contractOf(MUNICIPALITY).currentPeriodUsed, 1);
  const notice = { municipalityId: MUNICIPALITY, use: NotificationEvent.SCHEDULE_CONFIRMED, phone: "48999991234",
    data: { protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Veterinária Municipal" } };
  const off = await sendSmsUse(notice, deps);
  assert.deepEqual([off.status, off.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, 1]);
  assert.equal(f.database.contractOf(MUNICIPALITY).currentPeriodUsed, 1, "a message that is off spends nothing");
  f.database.configs.set(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`, { active: { [NotificationEvent.SCHEDULE_CONFIRMED]: true } });
  assert.equal((await sendSmsUse(notice, deps)).status, DeliveryStatus.SENT);
  assert.equal(sent[1].text, "Test Town: agendamento confirmado em 20/11/2026, às 09:00 em Unidade Veterinária Municipal. Protocolo: 123/2026.");
  assert.match(sent[1].messageId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(sent[1].expiresAt, undefined);
  const spent = await sendSmsUse(notice, deps);
  assert.deepEqual([spent.status, spent.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE, 2], "the contract of two messages is spent");
});

test("an SMS with a missing recovery code never calls the provider or consumes quota", async (t) => {
  const f = fixture(t);
  f.database.setContract(MUNICIPALITY, { plan: 5 });
  const result = await sendSmsUse({ municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET, phone: "48999991234", data: { minutes: "10" } }, {
    database: f.database, sendMessage: async () => assert.fail("a message without the code cannot be sent"),
  });
  assert.deepEqual([result.status, result.code], [DeliveryStatus.SKIPPED, DeliveryCode.PREPARATION_FAILED]);
  assert.equal(f.database.contractOf(MUNICIPALITY).currentPeriodUsed, undefined);
});

test("each municipality spends only its own SMS contract", async (t) => {
  const f = fixture(t);
  f.database.setContract(MUNICIPALITY, { plan: 5 }); f.database.setContract(OTHER, { plan: 5 });
  const deps = { database: f.database, sendMessage: async () => ({ status: DeliveryStatus.SENT }) };
  const input = { use: AuthPurpose.PASSWORD_RESET, phone: "48999991234", data: { code: "123456", minutes: "10" } };
  await sendSmsUse({ ...input, municipalityId: OTHER }, deps); await sendSmsUse({ ...input, municipalityId: OTHER }, deps);
  assert.equal(f.database.contractOf(OTHER).currentPeriodUsed, 2); assert.equal(f.database.contractOf(MUNICIPALITY).currentPeriodUsed, undefined);
});

test("an unknown message, a missing municipality, a server without token and a failing provider are each answered without a wrong send", async (t) => {
  const f = fixture(t); f.database.setContract(MUNICIPALITY);
  let sends = 0; const failing = { status: DeliveryStatus.FAILED, code: DeliveryCode.INSUFFICIENT_BALANCE };
  const deps = { database: f.database, sendMessage: async () => { sends += 1; return failing; } };
  const base = { phone: "48999991234", data: { code: "123456", minutes: "10" } };
  for (const input of [{ ...base, municipalityId: MUNICIPALITY, use: "unknown" }, { ...base, municipalityId: MUNICIPALITY, use: "initial_password" },
    { ...base, municipalityId: null, use: AuthPurpose.PASSWORD_RESET }]) {
    const result = await sendSmsUse(input, deps); assert.deepEqual([result.status, result.code], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED]);
  }
  setToken("");
  const unintegrated = await sendSmsUse({ ...base, municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET }, deps);
  assert.deepEqual([unintegrated.status, unintegrated.code, sends], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, 0], "without a token SMS is not in use");
  setToken(TOKEN);
  assert.equal(await sendSmsUse({ ...base, municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET }, deps), failing); assert.equal(sends, 1);
});

test("a token is accepted only by its shape: no Bearer prefix, no line breaks, no huge value", () => {
  for (const token of ["Bearer secret", "secret\nheader", "a".repeat(2049)]) assert.ok(validateSmsToken(token));
  assert.equal(validateSmsToken(""), "");
});

test("a test message goes to the typed phone through the server's token with a fixed text, spends no contract, and nothing is sent without integration", async (t) => {
  const f = fixture(t); const sent = [];
  const sendMessage = async (input) => { sent.push(input); return { status: DeliveryStatus.SENT, providerMessageId: "4321", reference: input.messageId }; };
  const deps = { database: f.database, sendMessage };
  const input = { municipalityId: MUNICIPALITY, phone: "(48) 99999-1234", actor: ACTOR };
  setToken("");
  const unintegrated = await sendSmsTestMessage(input, deps);
  assert.deepEqual([unintegrated.status, unintegrated.code, unintegrated.reason, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED, "O SMS não está integrado.", 0]);
  setToken(TOKEN);
  const result = await sendSmsTestMessage(input, deps);
  assert.deepEqual(result, { status: DeliveryStatus.SENT, providerMessageId: "4321", reference: sent[0].messageId });
  assert.deepEqual(Object.keys(sent[0]).sort(), ["messageId", "phone", "text", "token"]);
  assert.deepEqual([sent[0].token, sent[0].phone], [TOKEN, "(48) 99999-1234"]);
  assert.equal(sent[0].text, "Test Town: teste de envio de SMS do sistema de castração. Se você recebeu esta mensagem, o envio está funcionando.");
  assert.match(sent[0].messageId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await sendSmsTestMessage({ ...input, municipalityId: null }, deps);
  assert.match(sent[1].text, /^Prefeitura: teste de envio de SMS/, "with no municipality selected the text is neutral");
  assert.equal(f.database.contractOf(MUNICIPALITY), undefined, "a test spends no contract");
});

test("a test message refuses a phone that cannot receive an SMS before anything is sent, and a refusal of the provider is answered as it is", async (t) => {
  const f = fixture(t);
  let sends = 0; const refused = { status: DeliveryStatus.FAILED, code: DeliveryCode.INSUFFICIENT_BALANCE, reason: "Saldo de SMS insuficiente." };
  const deps = { database: f.database, sendMessage: async () => { sends += 1; return refused; } };
  for (const phone of ["", "   ", "123", "abc", "489999999999", "(48) 3333-4444", "(48) 89999-1234", "(00) 99999-1234", undefined, null, 48999991234, ["48999991234"]]) {
    await assert.rejects(sendSmsTestMessage({ municipalityId: MUNICIPALITY, phone, actor: ACTOR }, deps), { status: 400, message: "Informe um celular válido com DDD, por exemplo (48) 99999-1234. Telefone fixo não recebe SMS." }, String(phone));
  }
  await assert.rejects(sendSmsTestMessage({ municipalityId: "not-a-municipality", phone: "48999991234", actor: ACTOR }, deps), { status: 400 });
  assert.equal(sends, 0);
  assert.equal(await sendSmsTestMessage({ municipalityId: MUNICIPALITY, phone: "5548999991234", actor: ACTOR }, deps), refused); assert.equal(sends, 1);
});

test("test messages are limited to five in ten minutes for each administrator", async (t) => {
  const f = fixture(t);
  let attempts = 0; let sends = 0;
  const database = { ...f.database, query: (sql, values) => sql.includes("INSERT INTO auth_rate_limits") ? { rows: [{ attempts: ++attempts }] } : f.database.query(sql, values) };
  const deps = { database, sendMessage: async () => { sends += 1; return { status: DeliveryStatus.SENT, providerMessageId: "1" }; } };
  const input = { municipalityId: MUNICIPALITY, phone: "48999991234", actor: ACTOR };
  for (let test = 0; test < 5; test += 1) assert.equal((await sendSmsTestMessage(input, deps)).status, DeliveryStatus.SENT);
  await assert.rejects(sendSmsTestMessage(input, deps), { status: 429 });
  assert.equal(sends, 5);
  const limits = f.database.calls.filter(({ sql }) => sql.includes("INSERT INTO auth_rate_limits")).length;
  await assert.rejects(sendSmsTestMessage({ ...input, phone: "abc" }, deps), { status: 400 });
  assert.equal(f.database.calls.filter(({ sql }) => sql.includes("INSERT INTO auth_rate_limits")).length, limits, "a refused number does not use up a test");
});

test("a contract switched off closes the channel to its municipality: not offered, not sent, not shown to a visitor, while the others go on", async (t) => {
  const f = fixture(t); const sent = [];
  const deps = { database: f.database, sendMessage: async (input) => { sent.push(input); return { status: DeliveryStatus.SENT }; } };
  const reset = { municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET, phone: "48999991234", data: { code: "123456", minutes: "10" } };
  f.database.setContract(MUNICIPALITY, { plan: 10, enabled: false }); f.database.setContract(OTHER, { plan: 10 });
  assert.deepEqual(await getPublicSmsConfig(MUNICIPALITY, { database: f.database }), { active: false });
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET, database: f.database })).available, false);
  const refused = await sendSmsUse(reset, deps);
  assert.deepEqual([refused.status, refused.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE, 0]);
  assert.deepEqual(f.database.contractOf(MUNICIPALITY), { plan: 10, enabled: false }, "a refusal spends nothing");
  assert.deepEqual(await getPublicSmsConfig(OTHER, { database: f.database }), { active: true });
  assert.equal((await sendSmsUse({ ...reset, municipalityId: OTHER }, deps)).status, DeliveryStatus.SENT);
  f.database.setContract(MUNICIPALITY, { plan: 10, enabled: true });
  assert.deepEqual(await getPublicSmsConfig(MUNICIPALITY, { database: f.database }), { active: true });
  assert.equal((await sendSmsUse(reset, deps)).status, DeliveryStatus.SENT);
});
