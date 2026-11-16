import { DeliveryCode } from "../../../shared/notification-contract.js";
import {
  EMAIL_ACTIVE_USES_CONFIG_KEY, EMAIL_TEMPLATES_CONFIG_KEY, isEmailUseActive, normalizeEmailActiveUses, normalizeEmailTemplateIds,
  validateEmailTemplateIds,
} from "../../../shared/email-contract.js";
import { emailUses, getEmailUse } from "../../../shared/email-uses-contract.js";
import { readConfigValue, updateConfigValue } from "../repositories/config-values.js";
import { loadMunicipalityIdentity } from "../repositories/municipality-identity.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { isEmailAccountConfigured, loadEmailAccount } from "./email-account.js";

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function loadEmailTemplateIds(database) {
  return normalizeEmailTemplateIds(await readConfigValue(EMAIL_TEMPLATES_CONFIG_KEY, null, database));
}

export async function loadActiveEmailUses(municipalityId, database) {
  return normalizeEmailActiveUses(await readConfigValue(EMAIL_ACTIVE_USES_CONFIG_KEY, municipalityId, database));
}

// One row per use. Ids and variables are for the master only; a municipal viewer just learns whether the use can be turned on.
export async function listEmailUses({ account, municipalityId = null, master = false, database } = {}) {
  const [ids, active] = await Promise.all([loadEmailTemplateIds(database), municipalityId ? loadActiveEmailUses(municipalityId, database) : {}]);
  const accountReady = isEmailAccountConfigured(account);
  return emailUses.map(({ key, kind, label, variables }) => ({
    key,
    kind,
    label,
    ...(master ? { variables: [...variables], templateId: ids[key] || "" } : {}),
    configured: accountReady && Boolean(ids[key]),
    active: municipalityId ? isEmailUseActive(active, key) : false,
  }));
}

// The master sets the ids once for every municipality; an empty id clears that use.
export async function saveEmailTemplateIds({ patch, audit, database } = {}) {
  const invalid = validateEmailTemplateIds(patch);
  if (invalid) throw badRequest(invalid);
  await updateConfigValue(EMAIL_TEMPLATES_CONFIG_KEY, null, (current) => {
    const templates = { ...normalizeEmailTemplateIds(current) };
    for (const [key, id] of Object.entries(patch)) {
      if (id.trim()) templates[key] = id.trim();
      else delete templates[key];
    }
    return { templates };
  }, {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.EMAIL_TEMPLATES_UPDATE, entityType: "config", entityId: EMAIL_TEMPLATES_CONFIG_KEY, changes: { uses: Object.keys(patch) } },
  });
}

// Turning a use on needs the master to have set the account and the template; turning it off is always allowed.
export async function setEmailUseActive({ municipalityId, use, active, audit, database } = {}) {
  if (!municipalityId) throw badRequest("Município não identificado.");
  if (!getEmailUse(use) || typeof active !== "boolean") throw badRequest("Informe a mensagem e se ela deve ficar ativa.");
  if (!await loadMunicipalityIdentity(municipalityId, database)) throw badRequest("Município não encontrado.", 404);
  if (active) {
    const [account, ids] = await Promise.all([loadEmailAccount(database), loadEmailTemplateIds(database)]);
    if (!isEmailAccountConfigured(account) || !ids[use]) throw badRequest("Só é possível ligar mensagens com a conta de envio e o template configurados.");
  }
  await updateConfigValue(EMAIL_ACTIVE_USES_CONFIG_KEY, municipalityId, (current) => ({ active: { ...normalizeEmailActiveUses(current), [use]: active } }), {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.EMAIL_USE_UPDATE, entityType: "config", entityId: EMAIL_ACTIVE_USES_CONFIG_KEY, changes: { use, active } },
  });
}

// The single answer to "may this use be sent?". The municipal switch comes first: a use the municipality did not turn on is
// simply not in use (channel disabled), while one it turned on without a configured template is a real gap (not configured).
// A null municipality is the platform itself (staff recovery), which has no switch.
export async function resolveEmailTemplate({ municipalityId = null, use, database } = {}) {
  if (municipalityId && !isEmailUseActive(await loadActiveEmailUses(municipalityId, database), use)) return { ok: false, code: DeliveryCode.CHANNEL_DISABLED };
  const [account, ids] = await Promise.all([loadEmailAccount(database), loadEmailTemplateIds(database)]);
  if (!isEmailAccountConfigured(account) || !ids[use]) return { ok: false, code: DeliveryCode.NOT_CONFIGURED };
  return { ok: true, templateId: ids[use] };
}
