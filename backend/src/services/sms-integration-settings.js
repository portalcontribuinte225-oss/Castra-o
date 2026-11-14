import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { SMS_CONFIG_KEY, SmsProvider, SmsEnvironment, normalizeSmsConfig, validateSmsToken } from "../../../shared/sms-contract.js";
import { DeliveryCode, DeliveryStatus } from "../../../shared/notification-contract.js";
import { assertSmsMunicipality, loadSmsRecord, storeSmsRecord } from "../repositories/sms-settings.js";
import { consumeAuthLimit } from "../repositories/auth-limits.js";
import { authenticatedDigest, authError } from "./auth/auth-security.js";
import { decryptSecretStrict, encryptSecretStrict, isSecretEncryptionAvailable } from "./config-secret-cipher.js";
import { querySmsBalance, sendSmsCode } from "./smsmais.js";
import { deliveryFailure } from "./notifications/delivery-result.js";

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

function safeSmsConfig(record, municipalityId) {
  const credential = validatedCredential(record, municipalityId);
  return normalizeSmsConfig({ active: record?.active === true, hasToken: Boolean(record?.token),
    environment: credential?.environment || null, tokenValid: credential?.valid === true,
    lastValidatedAt: credential?.valid ? record.verification.verifiedAt : null, secureStorageAvailable: isSecretEncryptionAvailable() });
}

export async function getSmsIntegrationSettings(municipalityId, { database = pool } = {}) {
  await assertSmsMunicipality(municipalityId, database);
  return safeSmsConfig(await loadSmsRecord(municipalityId, database), municipalityId);
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
  await assertSmsMunicipality(municipalityId, database);
  const snapshot = await loadSmsRecord(municipalityId, database);
  const tokenChanged = Boolean(body.token); const tokenRemoved = body.clearToken === true;
  const value = { provider: SmsProvider.SMSMAIS, active: body.active ?? (snapshot?.active === true),
    token: snapshot?.token || "", verification: snapshot?.verification || null, revision: randomUUID() };
  if (tokenRemoved) { value.token = ""; value.active = false; value.verification = null; }
  else if (tokenChanged) { value.token = encryptSecretStrict(body.token); value.verification = null; }
  if (value.active) {
    if (!value.token) throw authError(400, "Informe um token de API válido para ativar SMS.");
    const token = tokenChanged ? body.token : decryptSecretStrict(value.token);
    if (!token || validateSmsToken(token)) throw authError(400, "Informe um token de API válido para ativar SMS.");
    const environment = environmentFor(token);
    if (environment !== SmsEnvironment.PRODUCTION) throw authError(400, "Token de homologação não pode ativar a recuperação por SMS.");
    const previousCredential = validatedCredential(snapshot, municipalityId);
    if (tokenChanged || snapshot?.active !== true || !previousCredential?.valid) {
      await limitValidation(actor, municipalityId, database);
      const result = await queryBalance(token);
      if (!result.valid) throw authError(400, result.reason || "Não foi possível validar o token de SMS.", result.code);
      value.verification = { fingerprint: fingerprint(municipalityId, token), environment, verifiedAt: now().toISOString() };
    }
  }
  await storeSmsRecord({ municipalityId, snapshot, value, actor, changes: { active: value.active, tokenChanged, tokenRemoved } }, database);
  return { key: SMS_CONFIG_KEY, municipality_id: municipalityId, value: safeSmsConfig(value, municipalityId) };
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

// Discovery may call this within its own transaction. It performs no network call or quota debit.
export async function getSmsAvailability(municipalityId, { database = pool } = {}) {
  if (!municipalityId) return { available: false };
  const record = await loadSmsRecord(municipalityId, database);
  const credential = validatedCredential(record, municipalityId);
  return { available: record?.active === true && credential?.valid === true && credential.environment === SmsEnvironment.PRODUCTION };
}

export async function sendSmsRecoveryCode(input, { database = pool, sendCode = sendSmsCode, ...options } = {}) {
  if (!input.municipalityId) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const record = await loadSmsRecord(input.municipalityId, database);
  const credential = validatedCredential(record, input.municipalityId);
  if (record?.active !== true) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  if (!credential?.valid || credential.environment !== SmsEnvironment.PRODUCTION) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
  return sendCode({ ...input, token: credential.token }, options);
}
