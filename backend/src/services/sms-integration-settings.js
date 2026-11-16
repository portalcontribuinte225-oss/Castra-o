import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { SMS_CONFIG_KEY, SmsProvider, SmsEnvironment, normalizeSmsConfig, validateSmsToken } from "../../../shared/sms-contract.js";
import { secretPreview } from "../../../shared/secret-preview-contract.js";
import { buildSmsTestText, buildSmsText } from "../../../shared/sms-messages-contract.js";
import { getSmsUse } from "../../../shared/sms-uses-contract.js";
import { DeliveryCode, DeliveryStatus } from "../../../shared/notification-contract.js";
import { assertSmsMunicipality, loadSmsRecord, storeSmsRecord } from "../repositories/sms-settings.js";
import { consumeAuthLimit } from "../repositories/auth-limits.js";
import { authenticatedDigest, authError } from "./auth/auth-security.js";
import { decryptSecretStrict, encryptSecretStrict, isSecretEncryptionAvailable } from "./config-secret-cipher.js";
import { normalizeSmsPhone, querySmsBalance, sendSmsMessage } from "./smsmais.js";
import { deliveryFailure } from "./notifications/delivery-result.js";
import { isSmsUseOn, listSmsUses } from "./sms-uses.js";

const environmentFor = (token) => token.startsWith("sbx_") ? SmsEnvironment.SANDBOX : SmsEnvironment.PRODUCTION;
const fingerprint = (municipalityId, token) => authenticatedDigest("sms-credential", municipalityId, token);

function validatedCredential(record, municipalityId) {
  if (!record?.token || record.provider !== SmsProvider.SMSMAIS) return null;
  try {
    const token = decryptSecretStrict(record.token);
    if (!token || validateSmsToken(token)) return null;
    const environment = environmentFor(token);
    return { token, environment, valid: record.verification?.fingerprint === fingerprint(municipalityId, token)
      && record.verification?.environment === environment && Boolean(record.verification?.verifiedAt) };
  } catch { return null; }
}

function safeSmsConfig(record, municipalityId, extras = {}) {
  const credential = validatedCredential(record, municipalityId);
  return normalizeSmsConfig({ active: record?.active === true, hasToken: Boolean(record?.token), tokenPreview: record?.tokenPreview,
    environment: credential?.environment || null, tokenValid: credential?.valid === true,
    lastValidatedAt: credential?.valid ? record.verification.verifiedAt : null, secureStorageAvailable: isSecretEncryptionAvailable(), ...extras });
}

// What the administrator reads: the safe settings, the municipality name (for the text samples) and the switch of each use.
async function settingsView(record, municipalityId, municipality, database) {
  return safeSmsConfig(record, municipalityId, { municipalityName: municipality.name, uses: await listSmsUses({ municipalityId, database }) });
}

export async function getSmsIntegrationSettings(municipalityId, { database = pool } = {}) {
  const municipality = await assertSmsMunicipality(municipalityId, database);
  return settingsView(await loadSmsRecord(municipalityId, database), municipalityId, municipality, database);
}

// What a visitor reads, as for WhatsApp: only whether the channel is on, so the follow-up form knows it may ask for a phone.
export async function getPublicSmsConfig(municipalityId, { database = pool } = {}) {
  await assertSmsMunicipality(municipalityId, database);
  return { active: (await loadSmsRecord(municipalityId, database))?.active === true };
}

async function limitValidation(actor, municipalityId, database) {
  if (!await consumeAuthLimit(["sms-validation", actor.id, municipalityId], { limit: 10, seconds: 600, database })) {
    throw authError(429, "Muitas consultas. Aguarde alguns minutos.");
  }
}

function parseInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw authError(400, "Configuração de SMS inválida.");
  if (Object.keys(input).some((key) => !["active", "token", "clearToken", "provider"].includes(key))
    || (input.provider !== undefined && input.provider !== SmsProvider.SMSMAIS)
    || (input.active !== undefined && typeof input.active !== "boolean")
    || (input.clearToken !== undefined && typeof input.clearToken !== "boolean")) throw authError(400, "Configuração de SMS inválida.");
  const tokenError = validateSmsToken(input.token);
  if (tokenError) throw authError(400, tokenError);
  if (input.clearToken && input.token) throw authError(400, "Escolha substituir ou remover o token.");
  return input;
}

export async function saveSmsIntegrationSettings({ municipalityId, input, actor }, { database = pool, queryBalance = querySmsBalance, now = () => new Date() } = {}) {
  const body = parseInput(input);
  const municipality = await assertSmsMunicipality(municipalityId, database);
  const snapshot = await loadSmsRecord(municipalityId, database);
  const tokenChanged = Boolean(body.token); const tokenRemoved = body.clearToken === true;
  const value = { provider: SmsProvider.SMSMAIS, active: body.active ?? (snapshot?.active === true),
    token: snapshot?.token || "", tokenPreview: snapshot?.tokenPreview || "", verification: snapshot?.verification || null, revision: randomUUID() };
  if (tokenRemoved) { value.token = ""; value.tokenPreview = ""; value.active = false; value.verification = null; }
  else if (tokenChanged) { value.token = encryptSecretStrict(body.token); value.tokenPreview = secretPreview(body.token); value.verification = null; }
  if (value.active) {
    if (!value.token) throw authError(400, "Informe um token de API válido para ativar SMS.");
    const token = tokenChanged ? body.token : decryptSecretStrict(value.token);
    if (!token || validateSmsToken(token)) throw authError(400, "Informe um token de API válido para ativar SMS.");
    const environment = environmentFor(token);
    if (environment !== SmsEnvironment.PRODUCTION) throw authError(400, "Token de homologação não pode ativar o SMS.");
    const previousCredential = validatedCredential(snapshot, municipalityId);
    if (tokenChanged || snapshot?.active !== true || !previousCredential?.valid) {
      await limitValidation(actor, municipalityId, database);
      const result = await queryBalance(token);
      if (!result.valid) throw authError(400, result.reason || "Não foi possível validar o token de SMS.", result.code);
      value.verification = { fingerprint: fingerprint(municipalityId, token), environment, verifiedAt: now().toISOString() };
    }
  }
  await storeSmsRecord({ municipalityId, snapshot, value, actor, changes: { active: value.active, tokenChanged, tokenRemoved } }, database);
  return { key: SMS_CONFIG_KEY, municipality_id: municipalityId, value: await settingsView(value, municipalityId, municipality, database) };
}

export async function testSmsConnection({ municipalityId, token, actor }, { database = pool, queryBalance = querySmsBalance, now = () => new Date() } = {}) {
  const tokenError = validateSmsToken(token); if (tokenError) throw authError(400, tokenError);
  await assertSmsMunicipality(municipalityId, database);
  await limitValidation(actor, municipalityId, database);
  const saved = token ? null : await loadSmsRecord(municipalityId, database);
  if (!token && !saved?.token) throw authError(400, "Informe ou salve um token para testar.");
  const selected = token || decryptSecretStrict(saved.token);
  const result = await queryBalance(selected);
  return { valid: result.valid === true, environment: environmentFor(selected), checkedAt: now().toISOString(),
    ...(result.valid ? { balance: result.balance } : { balance: null, code: result.code, reason: result.reason }) };
}

// What the screen says when the test cannot start; the codes are the ones the notices use.
const TEST_NOT_READY = Object.freeze({
  [DeliveryCode.CHANNEL_DISABLED]: "Ative o SMS antes de enviar um teste.",
  [DeliveryCode.NOT_CONFIGURED]: "Salve um token de produção válido antes de enviar um teste.",
});
const notReady = (code) => ({ ...deliveryFailure(DeliveryStatus.SKIPPED, code), reason: TEST_NOT_READY[code] });

async function limitTestSending(actor, municipalityId, database) {
  if (!await consumeAuthLimit(["sms-test-message", actor.id, municipalityId], { limit: 5, seconds: 600, database })) {
    throw authError(429, "Muitos testes de envio. Aguarde alguns minutos.");
  }
}

// Sends one real SMS, with a fixed text, to the phone the administrator typed, through the municipality's own account: the
// path the notices take, to a number of their choosing. A channel or token that is not ready answers "skipped" and sends nothing.
export async function sendSmsTestMessage({ municipalityId, phone, actor }, { database = pool, sendMessage = sendSmsMessage, ...options } = {}) {
  const municipality = await assertSmsMunicipality(municipalityId, database);
  if (typeof phone !== "string" || !normalizeSmsPhone(phone)) throw authError(400, "Informe um celular válido com DDD, por exemplo (48) 99999-1234. Telefone fixo não recebe SMS.");
  const record = await loadSmsRecord(municipalityId, database);
  if (record?.active !== true) return notReady(DeliveryCode.CHANNEL_DISABLED);
  const credential = validatedCredential(record, municipalityId);
  if (!credential?.valid || credential.environment !== SmsEnvironment.PRODUCTION) return notReady(DeliveryCode.NOT_CONFIGURED);
  await limitTestSending(actor, municipalityId, database);
  return sendMessage({ token: credential.token, phone, text: buildSmsTestText(municipality.name), messageId: randomUUID() }, options);
}

// Discovery may call this within its own transaction. It performs no network call or quota debit.
export async function getSmsAvailability(municipalityId, { database = pool } = {}) {
  if (!municipalityId) return { available: false };
  const record = await loadSmsRecord(municipalityId, database);
  const credential = validatedCredential(record, municipalityId);
  return { available: record?.active === true && credential?.valid === true && credential.environment === SmsEnvironment.PRODUCTION };
}

// Available for one message: the channel is usable and the municipality turned that message on.
export async function isSmsUseAvailable({ municipalityId, use, database = pool }) {
  if (!(await getSmsAvailability(municipalityId, { database })).available) return { available: false };
  return { available: await isSmsUseOn({ municipalityId, use, database }) };
}

// Sends one message of a use through the municipality's own account. A channel or use that is off answers "channel disabled",
// so callers can tell "not in use" from a real failure. The text is built here, from the municipality name and the use's data.
export async function sendSmsUse(input, { database = pool, sendMessage = sendSmsMessage, ...options } = {}) {
  if (!input.municipalityId || !getSmsUse(input.use)) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const record = await loadSmsRecord(input.municipalityId, database);
  const credential = validatedCredential(record, input.municipalityId);
  if (record?.active !== true) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  if (!credential?.valid || credential.environment !== SmsEnvironment.PRODUCTION) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
  if (!await isSmsUseOn({ municipalityId: input.municipalityId, use: input.use, database })) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const municipality = await assertSmsMunicipality(input.municipalityId, database);
  const text = buildSmsText(input.use, { ...input.data, municipality: municipality.name });
  return sendMessage({ token: credential.token, phone: input.phone, text, messageId: input.messageId || randomUUID(), expiresAt: input.expiresAt }, options);
}
