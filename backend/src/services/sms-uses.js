import { SMS_ACTIVE_USES_CONFIG_KEY, isSmsUseActive, normalizeSmsActiveUses } from "../../../shared/sms-contract.js";
import { getSmsUse, smsUses } from "../../../shared/sms-uses-contract.js";
import { readConfigValue, updateConfigValue } from "../repositories/config-values.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { loadSmsAccount } from "../repositories/sms-settings.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { isServiceEnabled } from "./message-quota.js";
import { AUDIT_ACTIONS } from "./audit.js";

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export async function loadActiveSmsUses(municipalityId, database) {
  return normalizeSmsActiveUses(await readConfigValue(SMS_ACTIVE_USES_CONFIG_KEY, municipalityId, database));
}

export async function isSmsUseOn({ municipalityId, use, database }) {
  return isSmsUseActive(await loadActiveSmsUses(municipalityId, database), use);
}

// One row per use, with the switch the municipality has (or the use's default).
export async function listSmsUses({ municipalityId, database }) {
  const active = await loadActiveSmsUses(municipalityId, database);
  return smsUses.map(({ key, kind, label }) => ({ key, kind, label, active: isSmsUseActive(active, key) }));
}

// A message can only be turned on while the platform's SMS channel is active; turning it off is always allowed. Turning the channel
// off keeps the switches, which apply again when it is reactivated.
export async function setSmsUseActive({ municipalityId, use, active, audit, database }) {
  if (!getSmsUse(use) || typeof active !== "boolean") throw badRequest("Informe a mensagem e se ela deve ficar ativa.");
  await assertActiveMunicipality(municipalityId, database);
  if (active && (await loadSmsAccount(database))?.active !== true) throw badRequest("O SMS ainda não está ativo na plataforma.");
  if (active && !(await isServiceEnabled(NotificationChannel.SMS, municipalityId, { database }))) throw badRequest("O serviço de SMS está desativado para este município.");
  await updateConfigValue(SMS_ACTIVE_USES_CONFIG_KEY, municipalityId, (current) => ({ active: { ...normalizeSmsActiveUses(current), [use]: active } }), {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.SMS_USE_UPDATE, entityType: "config", entityId: SMS_ACTIVE_USES_CONFIG_KEY, changes: { use, active } },
  });
}
