import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { SmsProvider, SmsEnvironment, normalizeSmsConfig, validateSmsToken } from "../../../shared/sms-contract.js";
import { secretPreview } from "../../../shared/secret-preview-contract.js";
import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { buildSmsTestText, buildSmsText } from "../../../shared/sms-messages-contract.js";
import { getSmsUse } from "../../../shared/sms-uses-contract.js";
import { DeliveryCode, DeliveryStatus, NotificationChannel } from "../../../shared/notification-contract.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { loadSmsAccount, storeSmsAccount } from "../repositories/sms-settings.js";
import { consumeAuthLimit } from "../repositories/auth-limits.js";
import { authError } from "./auth/auth-security.js";
import { checkAndConsumeQuota, getQuotaStatus, isQuotaAvailable } from "./message-quota.js";
import { normalizeSmsPhone, querySmsBalance, sendSmsMessage } from "./smsmais.js";
import { deliveryFailure } from "./notifications/delivery-result.js";
import { readServerCredential } from "./server-credentials.js";
import { isSmsUseOn, listSmsUses } from "./sms-uses.js";

const environmentFor = (token) => token.startsWith("sbx_") ? SmsEnvironment.SANDBOX : SmsEnvironment.PRODUCTION;
const LIMIT_SCOPE = "platform";

// The platform's SMSMais token, from the environment (SMS_TOKEN). A malformed one counts as absent.
export function readSmsCredential(env = process.env) {
  const { value, issue } = readServerCredential(ServerCredential.SMS_TOKEN, (token) => !validateSmsToken(token), env);
  return { token: value, issue, environment: value ? environmentFor(value) : null };
}

// The channel can send: it is on and the server holds a production token.
function sendingCredential(record, env) {
  const credential = readSmsCredential(env);
  return record?.active === true && credential.environment === SmsEnvironment.PRODUCTION ? credential : null;
}

function safeAccount(record, env) {
  const credential = readSmsCredential(env);
  return { active: record?.active === true, hasToken: Boolean(credential.token), tokenPreview: secretPreview(credential.token),
    environment: credential.environment, tokenIssue: credential.issue };
}

// What a screen reads. The master reads the whole account; the municipal administration only whether the channel is on. With a
// municipality, the view also carries its name (for the text samples) and the switch of each message.
async function settingsView({ record, municipalityId, master, database, env }) {
  const municipality = municipalityId ? await assertActiveMunicipality(municipalityId, database) : null;
  return normalizeSmsConfig({ ...(master ? safeAccount(record, env) : { active: record?.active === true }),
    municipalityName: municipality?.name, ...(municipality ? { uses: await listSmsUses({ municipalityId, database }) } : {}) });
}

export async function getSmsIntegrationSettings({ municipalityId = null, master = false } = {}, { database = pool, env = process.env } = {}) {
  if (!municipalityId && !master) throw authError(400, "Selecione um município ativo.");
  return settingsView({ record: await loadSmsAccount(database), municipalityId, master, database, env });
}

// What a visitor reads, as for WhatsApp: only whether SMS can reach the tutors of the municipality (the channel can send, the
// municipality has a contract in force and its service is on), so the follow-up form knows it may ask for a phone.
export async function getPublicSmsConfig(municipalityId, { database = pool, env = process.env } = {}) {
  await assertActiveMunicipality(municipalityId, database);
  const record = await loadSmsAccount(database);
  const status = await getQuotaStatus(NotificationChannel.SMS, municipalityId, { database });
  return { active: Boolean(sendingCredential(record, env)) && status?.active === true && status.enabled === true };
}

async function limitValidation(actor, database) {
  if (!await consumeAuthLimit(["sms-validation", actor.id, LIMIT_SCOPE], { limit: 10, seconds: 600, database })) {
    throw authError(429, "Muitas consultas. Aguarde alguns minutos.");
  }
}

function parseInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => key !== "active")
    || typeof input.active !== "boolean") throw authError(400, "Configuração de SMS inválida.");
  return input;
}

// Turns the platform's channel on or off (the master only decides who calls this). The token lives in the environment, so
// turning on only checks that it is a production token the provider accepts.
export async function saveSmsAccount({ input, actor }, { database = pool, queryBalance = querySmsBalance, env = process.env } = {}) {
  const { active } = parseInput(input);
  const snapshot = await loadSmsAccount(database);
  if (active && snapshot?.active !== true) {
    const credential = readSmsCredential(env);
    if (!credential.token) throw authError(400, "Cadastre um token de API válido em SMS_TOKEN nas variáveis do servidor para ativar o SMS.");
    if (credential.environment !== SmsEnvironment.PRODUCTION) throw authError(400, "Token de homologação não pode ativar o SMS.");
    await limitValidation(actor, database);
    const result = await queryBalance(credential.token);
    if (!result.valid) throw authError(400, result.reason || "Não foi possível validar o token de SMS.", result.code);
  }
  const value = { provider: SmsProvider.SMSMAIS, active, revision: randomUUID() };
  await storeSmsAccount({ snapshot, value, actor, changes: { active } }, database);
  return value;
}

export async function testSmsConnection({ actor }, { database = pool, queryBalance = querySmsBalance, now = () => new Date(), env = process.env } = {}) {
  const credential = readSmsCredential(env);
  if (!credential.token) throw authError(400, "Cadastre o token em SMS_TOKEN nas variáveis do servidor para testar.");
  await limitValidation(actor, database);
  const result = await queryBalance(credential.token);
  return { valid: result.valid === true, environment: credential.environment, checkedAt: now().toISOString(),
    ...(result.valid ? { balance: result.balance } : { balance: null, code: result.code, reason: result.reason }) };
}

// What the screen says when the test cannot start; the codes are the ones the notices use.
const TEST_NOT_READY = Object.freeze({
  [DeliveryCode.CHANNEL_DISABLED]: "Ative o SMS antes de enviar um teste.",
  [DeliveryCode.NOT_CONFIGURED]: "Cadastre um token de produção válido em SMS_TOKEN nas variáveis do servidor antes de enviar um teste.",
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
export async function sendSmsTestMessage({ municipalityId = null, phone, actor }, { database = pool, sendMessage = sendSmsMessage, env = process.env, ...options } = {}) {
  const municipality = municipalityId ? await assertActiveMunicipality(municipalityId, database) : null;
  if (typeof phone !== "string" || !normalizeSmsPhone(phone)) throw authError(400, "Informe um celular válido com DDD, por exemplo (48) 99999-1234. Telefone fixo não recebe SMS.");
  const record = await loadSmsAccount(database);
  if (record?.active !== true) return notReady(DeliveryCode.CHANNEL_DISABLED);
  const credential = sendingCredential(record, env);
  if (!credential) return notReady(DeliveryCode.NOT_CONFIGURED);
  await limitTestSending(actor, database);
  return sendMessage({ token: credential.token, phone, text: buildSmsTestText(municipality?.name), messageId: randomUUID() }, options);
}

// Discovery may call this within its own transaction. It performs no network call or quota debit: the channel can send and the
// municipality still has messages left in its contract.
export async function getSmsAvailability(municipalityId, { database = pool, env = process.env } = {}) {
  if (!municipalityId || !sendingCredential(await loadSmsAccount(database), env)) return { available: false };
  return { available: await isQuotaAvailable(NotificationChannel.SMS, municipalityId, { database }) };
}

// Available for one message: the channel is usable, the contract has room and the municipality turned that message on.
export async function isSmsUseAvailable({ municipalityId, use, database = pool, env = process.env }) {
  if (!(await getSmsAvailability(municipalityId, { database, env })).available) return { available: false };
  return { available: await isSmsUseOn({ municipalityId, use, database }) };
}

// Sends one message of a use through the platform's account. A channel or use that is off answers "channel disabled", so callers
// can tell "not in use" from a real failure; a municipality without contract or balance answers "quota unavailable". The text is
// built here, from the municipality name and the use's data.
export async function sendSmsUse(input, { database = pool, sendMessage = sendSmsMessage, consumeQuota = checkAndConsumeQuota, env = process.env, ...options } = {}) {
  if (!input.municipalityId || !getSmsUse(input.use)) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const record = await loadSmsAccount(database);
  if (record?.active !== true) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const credential = sendingCredential(record, env);
  if (!credential) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
  if (!await isSmsUseOn({ municipalityId: input.municipalityId, use: input.use, database })) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const municipality = await assertActiveMunicipality(input.municipalityId, database);
  if (!(await consumeQuota(NotificationChannel.SMS, input.municipalityId, { database })).allowed) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE);
  const text = buildSmsText(input.use, { ...input.data, municipality: municipality.name });
  return sendMessage({ token: credential.token, phone: input.phone, text, messageId: input.messageId || randomUUID(), expiresAt: input.expiresAt }, options);
}
