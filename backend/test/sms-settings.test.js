import test from "node:test";
import assert from "node:assert/strict";
import { SMS_CONFIG_KEY, validateSmsToken } from "../../shared/sms-contract.js";
import { saveSmsIntegrationSettings, getSmsIntegrationSettings, getSmsAvailability, sendSmsRecoveryCode, testSmsConnection } from "../src/services/sms-integration-settings.js";
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
  const saved = await f.save({ token: TOKEN, active: true }); assert.equal(f.validations(), 1);
  assert.equal(saved.key, SMS_CONFIG_KEY); assert.equal(saved.value.tokenValid, true); assert.equal(saved.value.environment, "production");
  assert.equal(JSON.stringify(saved).includes(TOKEN), false); assert.equal(JSON.stringify(saved).includes("enc:v1:"), false);
  assert.equal(decryptSecretStrict(f.database.records.get(MUNICIPALITY).token), TOKEN);
  const audits = f.database.calls.filter(({ sql }) => sql.includes("INSERT INTO audit_logs"));
  assert.equal(JSON.stringify(audits).includes(TOKEN), false); assert.equal(JSON.stringify(audits).includes("enc:v1:"), false);
  assert.equal((await getSmsAvailability(MUNICIPALITY, { database: f.database })).available, true);
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

test("availability performs no provider call, copied tenant validation is invalid and disabling prevents send", async (t) => {
  const f = fixture(t); await f.save({ token: TOKEN, active: true });
  f.database.records.set(OTHER, structuredClone(f.database.records.get(MUNICIPALITY)));
  assert.equal((await getSmsAvailability(OTHER, { database: f.database })).available, false);
  let sends = 0;
  const args = { municipalityId: MUNICIPALITY, phone: "48999991234", code: "123456", challengeId: ACTOR.id, expiresAt: "2026-11-13T12:10:00Z" };
  const deps = { database: f.database, sendCode: async (input) => { sends += 1; assert.equal(input.token, TOKEN); return { status: "sent" }; } };
  assert.equal((await sendSmsRecoveryCode(args, deps)).status, "sent");
  await f.save({ active: false }); assert.equal((await sendSmsRecoveryCode(args, deps)).status, "skipped"); assert.equal(sends, 1);
});

test("connection test only checks balance, never activates, saves or leaks provider extras", async (t) => {
  const f = fixture(t);
  const result = await testSmsConnection({ municipalityId: MUNICIPALITY, token: "sbx_connection-test", actor: ACTOR }, { database: f.database, queryBalance: f.queryBalance, now });
  assert.deepEqual(result, { valid: true, environment: "sandbox", checkedAt: now().toISOString(), balance: { credits: 0, sms: 0 } });
  assert.equal(f.database.records.size, 0); assert.equal(f.database.state.borrowed, 0);
  for (const token of ["Bearer secret", "secret\nheader", "a".repeat(2049)]) assert.ok(validateSmsToken(token));
  assert.equal(validateSmsToken(""), "");
});
