import test from "node:test";
import assert from "node:assert/strict";
import { SMS_ACTIVE_USES_CONFIG_KEY, SMS_CONFIG_KEY, validateSmsToken } from "../../shared/sms-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { DeliveryCode, DeliveryStatus, NotificationEvent } from "../../shared/notification-contract.js";
import { smsUses } from "../../shared/sms-uses-contract.js";
import { saveSmsIntegrationSettings, getSmsIntegrationSettings, getPublicSmsConfig, getSmsAvailability, isSmsUseAvailable, sendSmsTestMessage, sendSmsUse, testSmsConnection } from "../src/services/sms-integration-settings.js";
import { decryptSecretStrict, encryptSecret, encryptSecretStrict, isSecretEncryptionAvailable } from "../src/services/config-secret-cipher.js";
import { smsSettingsDatabase, SMS_TEST_MUNICIPALITY as MUNICIPALITY, SMS_TEST_OTHER as OTHER } from "./fixtures/sms-settings-db.js";

const ACTOR = { id: "33333333-3333-4333-8333-333333333333", role: "admin_municipal", municipalityId: MUNICIPALITY };
const TOKEN = "production-test-token";
const now = () => new Date("2026-11-13T12:00:00Z");
function fixture(t) {
  const previous = { cipher: process.env.CONFIG_ENCRYPTION_KEY, jwt: process.env.JWT_SECRET };
  process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64"); process.env.JWT_SECRET = "sms-settings-test-secret";
  t.after(() => {
    if (previous.cipher === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previous.cipher;
    if (previous.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.jwt;
  });
  const database = smsSettingsDatabase(); let validations = 0;
  const queryBalance = async () => { assert.equal(database.state.borrowed, 0, "provider validation must hold no database connection"); validations += 1; return { valid: true, balance: { credits: 0, sms: 0 } }; };
  const save = (input, deps = {}) => saveSmsIntegrationSettings({ municipalityId: MUNICIPALITY, actor: ACTOR, input }, { database, now, queryBalance, ...deps });
  return { database, save, queryBalance, validations: () => validations };
}

test("strict encryption blocks plaintext, absent/invalid key and tampering without changing legacy fallback", (t) => {
  fixture(t); const encrypted = encryptSecretStrict(TOKEN); assert.match(encrypted, /^enc:v1:/); assert.equal(decryptSecretStrict(encrypted), TOKEN);
  assert.throws(() => decryptSecretStrict(TOKEN), { status: 503 });
  assert.throws(() => decryptSecretStrict(`${encrypted.slice(0, -4)}AAAA`), { status: 503 });
  delete process.env.CONFIG_ENCRYPTION_KEY;
  assert.equal(isSecretEncryptionAvailable(), false); assert.equal(encryptSecret(TOKEN), TOKEN);
  assert.throws(() => encryptSecretStrict(TOKEN), { status: 503 });
  process.env.CONFIG_ENCRYPTION_KEY = "not-a-valid-key";
  assert.throws(() => decryptSecretStrict(encrypted), { status: 503 });
});

test("configuration defaults disabled, uses encrypted token, validates zero balance outside transaction and never returns secrets", async (t) => {
  const f = fixture(t); const defaults = await getSmsIntegrationSettings(MUNICIPALITY, { database: f.database });
  assert.equal(defaults.active, false); assert.equal(defaults.secureStorageAvailable, true);
  assert.equal(defaults.hasToken, false); assert.equal(defaults.tokenPreview, "");
  const saved = await f.save({ token: TOKEN, active: true }); assert.equal(f.validations(), 1);
  assert.equal(saved.key, SMS_CONFIG_KEY); assert.equal(saved.value.tokenValid, true); assert.equal(saved.value.environment, "production");
  assert.equal(JSON.stringify(saved).includes(TOKEN), false); assert.equal(JSON.stringify(saved).includes("enc:v1:"), false);
  assert.equal(decryptSecretStrict(f.database.records.get(MUNICIPALITY).token), TOKEN);
  const audits = f.database.calls.filter(({ sql }) => sql.includes("INSERT INTO audit_logs"));
  assert.equal(JSON.stringify(audits).includes(TOKEN), false); assert.equal(JSON.stringify(audits).includes("enc:v1:"), false);
  assert.equal((await getSmsAvailability(MUNICIPALITY, { database: f.database })).available, true);
});

test("the administrator reads only the start of the token, eight characters, never the token whole", async (t) => {
  const f = fixture(t); const saved = await f.save({ token: TOKEN, active: false });
  assert.equal(saved.value.tokenPreview, TOKEN.slice(0, 8)); assert.equal(TOKEN.slice(0, 8).length, 8);
  const read = await getSmsIntegrationSettings(MUNICIPALITY, { database: f.database });
  assert.equal(read.tokenPreview, TOKEN.slice(0, 8)); assert.equal(JSON.stringify(read).includes(TOKEN), false);
  await f.save({ token: "", active: false }); assert.equal(f.database.records.get(MUNICIPALITY).tokenPreview, TOKEN.slice(0, 8));
  await f.save({ token: "replacement-token-test", active: false });
  assert.equal(f.database.records.get(MUNICIPALITY).tokenPreview, "replacem"); assert.equal((await getSmsIntegrationSettings(MUNICIPALITY, { database: f.database })).tokenPreview, "replacem");
  await f.save({ clearToken: true });
  assert.equal(f.database.records.get(MUNICIPALITY).tokenPreview, ""); assert.equal((await getSmsIntegrationSettings(MUNICIPALITY, { database: f.database })).tokenPreview, "");
  f.database.records.set(MUNICIPALITY, { ...f.database.records.get(MUNICIPALITY), token: encryptSecretStrict(TOKEN) });
  const legacy = await getSmsIntegrationSettings(MUNICIPALITY, { database: f.database });
  assert.equal(legacy.hasToken, true); assert.equal(legacy.tokenPreview, "");
});

test("the settings carry the municipality name and one switch per message, with only password recovery on by default", async (t) => {
  const f = fixture(t); const settings = await getSmsIntegrationSettings(MUNICIPALITY, { database: f.database });
  assert.equal(settings.municipalityName, "Test Town");
  assert.deepEqual(settings.uses.map(({ key }) => key), smsUses.map(({ key }) => key));
  assert.deepEqual(settings.uses.filter(({ active }) => active).map(({ key }) => key), [AuthPurpose.PASSWORD_RESET]);
  assert.equal((await getSmsIntegrationSettings(OTHER, { database: f.database })).municipalityName, "Other Town");
  await assert.rejects(getSmsIntegrationSettings("33333333-3333-4333-8333-333333333333", { database: f.database }), { status: 400 });
});

test("a visitor learns only whether the channel is on, never the account, the token or the messages", async (t) => {
  const f = fixture(t);
  assert.deepEqual(await getPublicSmsConfig(MUNICIPALITY, { database: f.database }), { active: false });
  await f.save({ token: TOKEN, active: true });
  assert.deepEqual(await getPublicSmsConfig(MUNICIPALITY, { database: f.database }), { active: true });
  assert.deepEqual(await getPublicSmsConfig(OTHER, { database: f.database }), { active: false });
  await assert.rejects(getPublicSmsConfig("not-a-municipality", { database: f.database }), { status: 400 });
});

test("empty token preserves, disabling preserves ciphertext, removal clears, and sandbox cannot activate", async (t) => {
  const f = fixture(t); await f.save({ token: TOKEN, active: true }); const encrypted = f.database.records.get(MUNICIPALITY).token;
  await f.save({ token: "", active: false }); assert.equal(f.database.records.get(MUNICIPALITY).token, encrypted);
  delete process.env.CONFIG_ENCRYPTION_KEY;
  await f.save({ active: false }); assert.equal(f.database.records.get(MUNICIPALITY).token, encrypted);
  await f.save({ clearToken: true }); assert.equal(f.database.records.get(MUNICIPALITY).token, "");
  assert.equal(f.database.records.get(MUNICIPALITY).active, false);
  process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64");
  const sandbox = await f.save({ token: "sbx_example-test-token", active: false }); assert.equal(sandbox.value.environment, "sandbox");
  await assert.rejects(f.save({ active: true }), { status: 400 });
  assert.equal((await getSmsAvailability(MUNICIPALITY, { database: f.database })).available, false);
});

test("failed activation and failed required audit preserve previous settings", async (t) => {
  const f = fixture(t); await f.save({ token: TOKEN, active: false }); const previous = structuredClone(f.database.records.get(MUNICIPALITY));
  await assert.rejects(f.save({ token: "different-test-token", active: true }, { queryBalance: async () => ({ valid: false, reason: "Token inválido." }) }), { status: 400 });
  assert.deepEqual(f.database.records.get(MUNICIPALITY), previous);
  f.database.state.failAudit = true;
  await assert.rejects(f.save({ active: true }), /private database failure/);
  assert.deepEqual(f.database.records.get(MUNICIPALITY), previous); assert.equal(f.database.calls.at(-1).sql, "ROLLBACK");
});

test("a delayed validation cannot overwrite a newer municipal credential", async (t) => {
  const f = fixture(t); let resume; let started;
  const pending = new Promise((resolve) => { started = resolve; });
  const activation = f.save({ token: TOKEN, active: true }, { queryBalance: async () => {
    assert.equal(f.database.state.borrowed, 0); started(); await new Promise((resolve) => { resume = resolve; }); return { valid: true };
  } });
  await pending; await f.save({ token: "newer-saved-token", active: false }); resume();
  await assert.rejects(activation, { status: 409 });
  assert.equal(decryptSecretStrict(f.database.records.get(MUNICIPALITY).token), "newer-saved-token");
  assert.equal(f.database.records.get(MUNICIPALITY).active, false);
});

test("a message is available only with the channel usable and that message on, and asking performs no provider call", async (t) => {
  const f = fixture(t); const reset = AuthPurpose.PASSWORD_RESET;
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: reset, database: f.database })).available, false);
  await f.save({ token: TOKEN, active: true }); const validations = f.validations();
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: reset, database: f.database })).available, true);
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: NotificationEvent.COMPLETED, database: f.database })).available, false);
  f.database.configs.set(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`, { active: { [reset]: false, [NotificationEvent.COMPLETED]: true } });
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: reset, database: f.database })).available, false);
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: NotificationEvent.COMPLETED, database: f.database })).available, true);
  await f.save({ active: false });
  assert.equal((await isSmsUseAvailable({ municipalityId: MUNICIPALITY, use: NotificationEvent.COMPLETED, database: f.database })).available, false);
  assert.equal((await isSmsUseAvailable({ municipalityId: null, use: reset, database: f.database })).available, false);
  assert.equal(f.validations(), validations, "asking never checks the provider");
});

test("sending a message builds the fixed text for the municipality, through its own token, only while the channel and the message are on", async (t) => {
  const f = fixture(t); const sent = [];
  const sendMessage = async (input) => { sent.push(input); assert.equal(input.token, TOKEN); return { status: DeliveryStatus.SENT }; };
  const deps = { database: f.database, sendMessage };
  const reset = { municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET, phone: "48999991234", data: { code: "123456", minutes: "10" },
    messageId: ACTOR.id, expiresAt: "2026-11-13T12:10:00Z" };
  const unsaved = await sendSmsUse(reset, deps);
  assert.deepEqual([unsaved.status, unsaved.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, 0]);
  await f.save({ token: TOKEN, active: true });
  assert.equal((await sendSmsUse(reset, deps)).status, DeliveryStatus.SENT);
  assert.deepEqual(sent[0], { token: TOKEN, phone: "48999991234", text: "Test Town: recebemos um pedido para redefinir sua senha. Codigo: 123456. Valido por 10 minutos. Nao compartilhe.",
    messageId: ACTOR.id, expiresAt: "2026-11-13T12:10:00Z" });
  const notice = { municipalityId: MUNICIPALITY, use: NotificationEvent.SCHEDULE_CONFIRMED, phone: "48999991234",
    data: { protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Veterinária Municipal" } };
  const off = await sendSmsUse(notice, deps);
  assert.deepEqual([off.status, off.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, 1]);
  f.database.configs.set(`${SMS_ACTIVE_USES_CONFIG_KEY}:${MUNICIPALITY}`, { active: { [NotificationEvent.SCHEDULE_CONFIRMED]: true } });
  assert.equal((await sendSmsUse(notice, deps)).status, DeliveryStatus.SENT);
  assert.equal(sent[1].text, "Test Town: castracao confirmada! Esperamos voce em 20/11/2026, as 09:00 na Unidade Veterinaria Municipal. Protocolo: 123/2026.");
  assert.match(sent[1].messageId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(sent[1].expiresAt, undefined);
  await f.save({ active: false });
  const disabled = await sendSmsUse(notice, deps);
  assert.deepEqual([disabled.status, disabled.code, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, 2]);
});

test("an unknown message, a missing municipality, a copied credential and a failing provider are each answered without a send", async (t) => {
  const f = fixture(t); await f.save({ token: TOKEN, active: true });
  let sends = 0; const failing = { status: DeliveryStatus.FAILED, code: DeliveryCode.INSUFFICIENT_BALANCE };
  const deps = { database: f.database, sendMessage: async () => { sends += 1; return failing; } };
  const base = { phone: "48999991234", data: { code: "123456", minutes: "10" } };
  for (const input of [{ ...base, municipalityId: MUNICIPALITY, use: "unknown" }, { ...base, municipalityId: MUNICIPALITY, use: AuthPurpose.INITIAL_PASSWORD },
    { ...base, municipalityId: null, use: AuthPurpose.PASSWORD_RESET }]) {
    const result = await sendSmsUse(input, deps); assert.deepEqual([result.status, result.code], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED]);
  }
  f.database.records.set(OTHER, structuredClone(f.database.records.get(MUNICIPALITY)));
  const copied = await sendSmsUse({ ...base, municipalityId: OTHER, use: AuthPurpose.PASSWORD_RESET }, deps);
  assert.deepEqual([copied.status, copied.code, sends], [DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED, 0]);
  assert.equal(await sendSmsUse({ ...base, municipalityId: MUNICIPALITY, use: AuthPurpose.PASSWORD_RESET }, deps), failing); assert.equal(sends, 1);
});

test("connection test only checks balance, never activates, saves or leaks provider extras", async (t) => {
  const f = fixture(t);
  const result = await testSmsConnection({ municipalityId: MUNICIPALITY, token: "sbx_connection-test", actor: ACTOR }, { database: f.database, queryBalance: f.queryBalance, now });
  assert.deepEqual(result, { valid: true, environment: "sandbox", checkedAt: now().toISOString(), balance: { credits: 0, sms: 0 } });
  assert.equal(f.database.records.size, 0); assert.equal(f.database.state.borrowed, 0);
  for (const token of ["Bearer secret", "secret\nheader", "a".repeat(2049)]) assert.ok(validateSmsToken(token));
  assert.equal(validateSmsToken(""), "");
});

test("a test message goes to the typed phone through the saved token with a fixed text, and nothing is sent before the channel and the token are ready", async (t) => {
  const f = fixture(t); const sent = [];
  const sendMessage = async (input) => { sent.push(input); return { status: DeliveryStatus.SENT, providerMessageId: "4321", reference: input.messageId }; };
  const deps = { database: f.database, sendMessage };
  const input = { municipalityId: MUNICIPALITY, phone: "(48) 99999-1234", actor: ACTOR };
  const off = await sendSmsTestMessage(input, deps);
  assert.deepEqual([off.status, off.code, off.reason, sent.length], [DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED, "Ative o SMS antes de enviar um teste.", 0]);
  await f.save({ token: TOKEN, active: true });
  const result = await sendSmsTestMessage(input, deps);
  assert.deepEqual(result, { status: DeliveryStatus.SENT, providerMessageId: "4321", reference: sent[0].messageId });
  assert.deepEqual(Object.keys(sent[0]).sort(), ["messageId", "phone", "text", "token"]);
  assert.deepEqual([sent[0].token, sent[0].phone], [TOKEN, "(48) 99999-1234"]);
  assert.equal(sent[0].text, "Test Town: teste de envio de SMS do sistema de castracao. Se voce recebeu esta mensagem, o envio esta funcionando.");
  assert.match(sent[0].messageId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  f.database.records.set(OTHER, structuredClone(f.database.records.get(MUNICIPALITY)));
  const copied = await sendSmsTestMessage({ ...input, municipalityId: OTHER }, deps);
  assert.deepEqual([copied.status, copied.code, copied.reason], [DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED, "Salve um token de produção válido antes de enviar um teste."]);
  assert.equal(sent.length, 1);
});

test("a test message refuses a phone that cannot receive an SMS before anything is sent, and a refusal of the provider is answered as it is", async (t) => {
  const f = fixture(t); await f.save({ token: TOKEN, active: true });
  let sends = 0; const refused = { status: DeliveryStatus.FAILED, code: DeliveryCode.INSUFFICIENT_BALANCE, reason: "Saldo de SMS insuficiente." };
  const deps = { database: f.database, sendMessage: async () => { sends += 1; return refused; } };
  for (const phone of ["", "   ", "123", "abc", "489999999999", undefined, null, 48999991234, ["48999991234"]]) {
    await assert.rejects(sendSmsTestMessage({ municipalityId: MUNICIPALITY, phone, actor: ACTOR }, deps), { status: 400, message: "Informe um telefone válido com DDD." }, String(phone));
  }
  await assert.rejects(sendSmsTestMessage({ municipalityId: null, phone: "48999991234", actor: ACTOR }, deps), { status: 400 });
  assert.equal(sends, 0);
  assert.equal(await sendSmsTestMessage({ municipalityId: MUNICIPALITY, phone: "5548999991234", actor: ACTOR }, deps), refused); assert.equal(sends, 1);
});

test("test messages are limited to five in ten minutes for each administrator and municipality", async (t) => {
  const f = fixture(t); await f.save({ token: TOKEN, active: true });
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
