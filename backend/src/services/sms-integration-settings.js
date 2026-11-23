import { randomUUID } from "node:crypto";
import { pool } from "../db/index.js";
import { normalizeSmsConfig } from "../../../shared/sms-contract.js";
import { ContractState } from "../../../shared/message-quota-contract.js";
import { buildSmsTestText, buildSmsText } from "../../../shared/sms-messages-contract.js";
import { getSmsUse } from "../../../shared/sms-uses-contract.js";
import { DeliveryCode, DeliveryStatus, NotificationChannel } from "../../../shared/notification-contract.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { consumeAuthLimit } from "../repositories/auth-limits.js";
import { authError } from "./auth/auth-security.js";
import { checkAndConsumeQuota, getQuotaStatus, isQuotaAvailable } from "./message-quota.js";
import { normalizeSmsPhone, sendSmsMessage } from "./smsmais.js";
import { deliveryFailure } from "./notifications/delivery-result.js";
import { isSmsIntegrated, readProductionSmsToken } from "./sms-credential.js";
import { isSmsUseOn, listSmsUses } from "./sms-uses.js";

const LIMIT_SCOPE = "platform";

// What a screen reads: whether the server holds a production token (never any part of it) and, with a municipality, its name (for
// the text samples) and the switch of each message.
export async function getSmsIntegrationSettings({ municipalityId = null, master = false } = {}, { database = pool, env = process.env } = {}) {
  if (!municipalityId && !master) throw authError(400, "Selecione um município ativo.");
  const municipality = municipalityId ? await assertActiveMunicipality(municipalityId, database) : null;
  return normalizeSmsConfig({ integrated: isSmsIntegrated(env), municipalityName: municipality?.name,
    ...(municipality ? { uses: await listSmsUses({ municipalityId, database }) } : {}) });
}

// What a visitor reads, as for WhatsApp: only whether SMS can reach the tutors of the municipality (integrated, with the contract on
// and in force), so the follow-up form knows it may ask for a phone.
export async function getPublicSmsConfig(municipalityId, { database = pool, env = process.env } = {}) {
  await assertActiveMunicipality(municipalityId, database);
  const status = await getQuotaStatus(NotificationChannel.SMS, municipalityId, { database });
  return { active: isSmsIntegrated(env) && status?.state === ContractState.IN_FORCE };
}

async function limitTestSending(actor, database) {
  if (!await consumeAuthLimit(["sms-test-message", actor.id, LIMIT_SCOPE], { limit: 5, seconds: 600, database })) {
    throw authError(429, "Muitos testes de envio. Aguarde alguns minutos.");
  }
}

// Sends one real SMS, with a fixed text, to the phone the master typed, through the platform's account: the path the notices take, to
// a number of their choosing. It names the selected municipality when there is one, and spends no contract. Without a production token
// it answers "skipped" and sends nothing.
export async function sendSmsTestMessage({ municipalityId = null, phone, actor }, { database = pool, sendMessage = sendSmsMessage, env = process.env, ...options } = {}) {
  const municipality = municipalityId ? await assertActiveMunicipality(municipalityId, database) : null;
  if (typeof phone !== "string" || !normalizeSmsPhone(phone)) throw authError(400, "Informe um celular válido com DDD, por exemplo (48) 99999-1234. Telefone fixo não recebe SMS.");
  const token = readProductionSmsToken(env);
  if (!token) return { ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED), reason: "O SMS não está integrado." };
  await limitTestSending(actor, database);
  return sendMessage({ token, phone, text: buildSmsTestText(municipality?.name), messageId: randomUUID() }, options);
}

// Discovery may call this within its own transaction. It performs no network call or quota debit: SMS is integrated and the
// municipality's contract lets one more message go.
export async function getSmsAvailability(municipalityId, { database = pool, env = process.env } = {}) {
  if (!municipalityId || !isSmsIntegrated(env)) return { available: false };
  return { available: await isQuotaAvailable(NotificationChannel.SMS, municipalityId, { database }) };
}

// Available for one message: SMS is integrated, the contract has room and the municipality turned that message on.
export async function isSmsUseAvailable({ municipalityId, use, database = pool, env = process.env }) {
  if (!(await getSmsAvailability(municipalityId, { database, env })).available) return { available: false };
  return { available: await isSmsUseOn({ municipalityId, use, database }) };
}

// Sends one message of a use through the platform's account. SMS not integrated or a use that is off answers "channel disabled", so
// callers can tell "not in use" from a real failure; a municipality without contract or balance answers "quota unavailable". The text
// is built here, from the municipality name and the use's data.
export async function sendSmsUse(input, { database = pool, sendMessage = sendSmsMessage, consumeQuota = checkAndConsumeQuota, env = process.env, ...options } = {}) {
  if (!input.municipalityId || !getSmsUse(input.use)) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const token = readProductionSmsToken(env);
  if (!token) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  if (!await isSmsUseOn({ municipalityId: input.municipalityId, use: input.use, database })) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED);
  const municipality = await assertActiveMunicipality(input.municipalityId, database);
  if (!(await consumeQuota(NotificationChannel.SMS, input.municipalityId, { database })).allowed) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE);
  const text = buildSmsText(input.use, { ...input.data, municipality: municipality.name });
  return sendMessage({ token, phone: input.phone, text, messageId: input.messageId || randomUUID(), expiresAt: input.expiresAt }, options);
}
