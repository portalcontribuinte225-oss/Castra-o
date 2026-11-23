import { SMS_ACTIVE_USES_CONFIG_KEY, isSmsUseActive, normalizeSmsActiveUses } from "../../../shared/sms-contract.js";
import { getSmsUse, smsUses } from "../../../shared/sms-uses-contract.js";
import { readConfigValue, updateConfigValue } from "../repositories/config-values.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { isSmsIntegrated } from "./sms-credential.js";

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

// A message can only be turned on while SMS is integrated; turning it off is always allowed. Losing the integration keeps the
// switches, which apply again when it comes back.
export async function setSmsUseActive({ municipalityId, use, active, audit, database, env = process.env }) {
  if (!getSmsUse(use) || typeof active !== "boolean") throw badRequest("Informe a mensagem e se ela deve ficar ativa.");
  await assertActiveMunicipality(municipalityId, database);
  if (active && !isSmsIntegrated(env)) throw badRequest("O SMS ainda não está integrado.");
  await updateConfigValue(SMS_ACTIVE_USES_CONFIG_KEY, municipalityId, (current) => ({ active: { ...normalizeSmsActiveUses(current), [use]: active } }), {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.SMS_USE_UPDATE, entityType: "config", entityId: SMS_ACTIVE_USES_CONFIG_KEY, changes: { use, active } },
  });
}
