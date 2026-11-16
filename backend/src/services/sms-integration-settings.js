import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { SmsProvider, SmsEnvironment, normalizeSmsConfig, validateSmsToken } from "../../../shared/sms-contract.js";
import { secretPreview } from "../../../shared/secret-preview-contract.js";
import { buildSmsTestText, buildSmsText } from "../../../shared/sms-messages-contract.js";
import { getSmsUse } from "../../../shared/sms-uses-contract.js";
import { DeliveryCode, DeliveryStatus, NotificationChannel } from "../../../shared/notification-contract.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { loadSmsAccount, storeSmsAccount } from "../repositories/sms-settings.js";
import { consumeAuthLimit } from "../repositories/auth-limits.js";
import { authenticatedDigest, authError } from "./auth/auth-security.js";
import { decryptSecretStrict, encryptSecretStrict, isSecretEncryptionAvailable } from "./config-secret-cipher.js";
import { checkAndConsumeQuota, getQuotaStatus, isQuotaAvailable } from "./message-quota.js";
import { normalizeSmsPhone, querySmsBalance, sendSmsMessage } from "./smsmais.js";
import { deliveryFailure } from "./notifications/delivery-result.js";
import { isSmsUseOn, listSmsUses } from "./sms-uses.js";

const environmentFor = (token) => token.startsWith("sbx_") ? SmsEnvironment.SANDBOX : SmsEnvironment.PRODUCTION;
// The account is the platform's, so its token is bound to the platform and not to any municipality.
const fingerprint = (token) => authenticatedDigest("sms-credential", "platform", token);
const LIMIT_SCOPE = "platform";

function validatedCredential(record) {
  if (!record?.token || record.provider !== SmsProvider.SMSMAIS) return null;
  try {
    const token = decryptSecretStrict(record.token);
    if (!token || validateSmsToken(token)) return null;
    const environment = environmentFor(token);
    return { token, environment, valid: record.verification?.fingerprint === fingerprint(token)
      && record.verification?.environment === environment && Boolean(record.verification?.verifiedAt) };
  } catch { return null; }
}

// The channel can send: it is on and holds a token the provider accepted in production.
function sendingCredential(record) {
  const credential = validatedCredential(record);
  return record?.active === true && credential?.valid === true && credential.environment === SmsEnvironment.PRODUCTION ? credential : null;
}

function safeAccount(record) {
  const credential = validatedCredential(record);
  return { active: record?.active === true, hasToken: Boolean(record?.token), tokenPreview: record?.tokenPreview,
    environment: credential?.environment || null, tokenValid: credential?.valid === true,
    lastValidatedAt: credential?.valid ? record.verification.verifiedAt : null, secureStorageAvailable: isSecretEncryptionAvailable() };
}

// What a screen reads. The master reads the whole account; the municipal administration only whether the channel is on. With a
// municipality, the view also carries its name (for the text samples) and the switch of each message.
async function settingsView({ record, municipalityId, master, database }) {
  const municipality = municipalityId ? await assertActiveMunicipality(municipalityId, database) : null;
  return normalizeSmsConfig({ ...(master ? safeAccount(record) : { active: record?.active === true }),
    municipalityName: municipality?.name, ...(municipality ? { uses: await listSmsUses({ municipalityId, database }) } : {}) });
}

export async function getSmsIntegrationSettings({ municipalityId = null, master = false } = {}, { database = pool } = {}) {
  if (!municipalityId && !master) throw authError(400, "Selecione um município ativo.");
  return settingsView({ record: await loadSmsAccount(database), municipalityId, master, database });
}

// What a visitor reads, as for WhatsApp: only whether SMS can reach the tutors of the municipality (the channel is on and the
// municipality has a contract), so the follow-up form knows it may ask for a phone.
export async function getPublicSmsConfig(municipalityId, { database = pool } = {}) {
  await assertActiveMunicipality(municipalityId, database);
  const record = await loadSmsAccount(database);
  return { active: record?.active === true && (await getQuotaStatus(NotificationChannel.SMS, municipalityId, { database }))?.active === true };
}

async function limitValidation(actor, database) {
  if (!await consumeAuthLimit(["sms-validation", actor.id, LIMIT_SCOPE], { limit: 10, seconds: 600, database })) {
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

// Saves the platform's account (the master only decides who calls this): the token, its removal or the channel switch.
export async function saveSmsAccount({ input, actor }, { database = pool, queryBalance = querySmsBalance, now = () => new Date() } = {}) {
  const body = parseInput(input);
  const snapshot = await loadSmsAccount(database);
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
    const previousCredential = validatedCredential(snapshot);
    if (tokenChanged || snapshot?.active !== true || !previousCredential?.valid) {
      await limitValidation(actor, database);
      const result = await queryBalance(token);
      if (!result.valid) throw authError(400, result.reason || "Não foi possível validar o token de SMS.", result.code);
      value.verification = { fingerprint: fingerprint(token), environment, verifiedAt: now().toISOString() };
    }
  }
  await storeSmsAccount({ snapshot, value, actor, changes: { active: value.active, tokenChanged, tokenRemoved } }, database);
  return value;
}

export async function testSmsConnection({ token, actor }, { database = pool, queryBalance = querySmsBalance, now = () => new Date() } = {}) {
  const tokenError = validateSmsToken(token); if (tokenError) throw authError(400, tokenError);
  await limitValidation(actor, database);
  const saved = token ? null : await loadSmsAccount(database);
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

async function limitTestSending(actor, database) {
  if (!await consumeAuthLimit(["sms-test-message", actor.id, LIMIT_SCOPE], { limit: 5, seconds: 600, database })) {
    throw authError(429, "Muitos testes de envio. Aguarde alguns minutos.");
  }
}

// Sends one real SMS, with a fixed text, to the phone the master typed, through the platform's account: the path the notices take, to
// a number of their choosing. It names the selected municipality when there is one, and spends no contract. A channel or token that
// is not ready answers "skipped" and sends nothing.
export async function sendSmsTestMessage({ municipalityId = null, phone, actor }, { database = pool, sendMessage = sendSmsMessage, ...options } = {}) {
  const municipality = municipalityId ? await assertActiveMunicipality(municipalityId, database) : null;
  if (typeof phone !== "string" || !normalizeSmsPhone(phone)) throw authError(400, "Informe um celular válido com DDD, por exemplo (48) 99999-1234. Telefone fixo não recebe SMS.");
  const record = await loadSmsAccount(database);
  if (record?.active !== true) return notReady(DeliveryCode.CHANNEL_DISABLED);
  const credential = sendingCredential(record);
  if (!credential) return notReady(DeliveryCode.NOT_CONFIGURED);
  await limitTestSending(actor, database);
  return sendMessage({ token: credential.token, phone, text: buildSmsTestText(municipality?.name), messageId: randomUUID() }, options);
}

// Discovery may call this within its own transaction. It performs no network call or quota debit: the channel can send and the
// municipality still has messages left in its contract.
export async function getSmsAvailability(municipalityId, { database = pool } = {}) {
  if (!municipalityId || !sendingCredential(await loadSmsAccount(database))) return { available: false };
  return { available: await isQuotaAvailable(NotificationChannel.SMS, municipalityId, { database }) };
}

// Available for one message: the channel is usable, the contract has room and the municipality turned that message on.
export async function isSmsUseAvailable({ municipalityId, use, database = pool }) {
  if (!(await getSmsAvailability(municipalityId, { database })).available) return { available: false };
  return { available: await isSmsUseOn({ municipalityId, use, database }) };
}

// Sends one message of a use through the platform's account. A channel or use that is off answers "channel disabled", so callers
// can tell "not in use" from a real failure; a municipality without contract or balance answers "quota unavailable". The text is
// built here, from the municipality name and the use's data.
export async function sendSmsUse(input, { database = pool, sendMessage = sendSmsMessage, consumeQuota = checkAndConsumeQuota, ...options } = {}) {
  if (!input.municipalityId || !getSmsUse(input.use)) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const record = await loadSmsAccount(database);
  if (record?.active !== true) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const credential = sendingCredential(record);
  if (!credential) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
  if (!await isSmsUseOn({ municipalityId: input.municipalityId, use: input.use, database })) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const municipality = await assertActiveMunicipality(input.municipalityId, database);
  if (!(await consumeQuota(NotificationChannel.SMS, input.municipalityId, { database })).allowed) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE);
  const text = buildSmsText(input.use, { ...input.data, municipality: municipality.name });
  return sendMessage({ token: credential.token, phone: input.phone, text, messageId: input.messageId || randomUUID(), expiresAt: input.expiresAt }, options);
}
