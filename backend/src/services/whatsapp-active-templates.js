import { DeliveryCode } from "../../../shared/notification-contract.js";
import {
  WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, WHATSAPP_APPROVED_STATUS, activateTemplate, activeUseKeys, cleanTemplateIdentity,
  deactivateTemplate, getWhatsappUse, isWhatsappTemplateUsable, normalizeActiveTemplates, recognizeWhatsappTemplate,
} from "../../../shared/whatsapp-templates-contract.js";
import { readWhatsappConfigValue, updateWhatsappConfigValue } from "../repositories/whatsapp-templates.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { findCatalogTemplate, loadWhatsappCatalog } from "./whatsapp-catalog.js";

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export async function loadActiveTemplates(municipalityId, database) {
  return normalizeActiveTemplates(await readWhatsappConfigValue(WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, municipalityId, database));
}

// One row per catalog template, plus a row for each active template that no longer exists on Meta.
export function buildTemplateRows(catalog, active) {
  const rows = catalog.templates.map((entry) => {
    const { uses, reason } = recognizeWhatsappTemplate(entry);
    const first = getWhatsappUse(uses[0]);
    return {
      name: entry.name,
      language: entry.language,
      status: entry.status,
      category: entry.category,
      label: first ? first.groupLabel : "",
      uses,
      variables: first ? [...first.variables] : [],
      reason: uses.length ? "" : reason,
      active: activeUseKeys(active, entry.name, entry.language).length > 0,
      canActivate: uses.length > 0 && entry.status === WHATSAPP_APPROVED_STATUS,
    };
  });
  const known = new Set(catalog.templates.map((entry) => `${entry.name}|${entry.language}`));
  const missing = new Map();
  for (const [key, item] of Object.entries(active)) {
    const id = `${item.name}|${item.language}`;
    if (known.has(id)) continue;
    const row = missing.get(id) || { name: item.name, language: item.language, keys: [] };
    row.keys.push(key);
    missing.set(id, row);
  }
  for (const { name, language, keys } of missing.values()) {
    const first = getWhatsappUse(keys[0]);
    rows.push({ name, language, status: "NOT_FOUND", category: "", label: first.groupLabel, uses: keys, variables: [...first.variables], reason: "", active: true, canActivate: false });
  }
  return rows;
}

export async function listWhatsappTemplates(municipalityId, database) {
  const [catalog, active] = await Promise.all([loadWhatsappCatalog(municipalityId, database), loadActiveTemplates(municipalityId, database)]);
  return { syncedAt: catalog.syncedAt, templates: buildTemplateRows(catalog, active) };
}

// Turning a template on needs it recognized and approved; turning it off only removes it from the active list.
export async function setWhatsappTemplateActive({ municipalityId, name, language, active: turnOn, audit, database }) {
  const identity = cleanTemplateIdentity(name, language);
  if (!identity || typeof turnOn !== "boolean") throw badRequest("Informe o template, o idioma e se ele deve ficar ativo.");
  let entry = null;
  if (turnOn) {
    entry = findCatalogTemplate(await loadWhatsappCatalog(municipalityId, database), identity.name, identity.language);
    if (!entry) throw badRequest("Template não encontrado no catálogo. Sincronize os templates e tente novamente.");
    const { uses, reason } = recognizeWhatsappTemplate(entry);
    if (!uses.length) throw badRequest(reason);
    if (entry.status !== WHATSAPP_APPROVED_STATUS) throw badRequest("Só é possível ligar templates aprovados pela Meta.");
  }
  await updateWhatsappConfigValue(
    WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, municipalityId,
    (current) => {
      const stored = normalizeActiveTemplates(current);
      return { active: turnOn ? activateTemplate(stored, entry) : deactivateTemplate(stored, identity.name, identity.language) };
    },
    {
      database,
      audit: audit && {
        ...audit, action: AUDIT_ACTIONS.WHATSAPP_TEMPLATE_UPDATE, entityType: "config", entityId: WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY,
        changes: { name: identity.name, language: identity.language, active: turnOn },
      },
    },
  );
  return listWhatsappTemplates(municipalityId, database);
}

// The single answer to "may this use be sent?": an active template that still exists, is approved and keeps its structure.
export async function resolveActiveTemplate(municipalityId, useKey, database) {
  const [active, catalog] = await Promise.all([loadActiveTemplates(municipalityId, database), loadWhatsappCatalog(municipalityId, database)]);
  const chosen = active[useKey];
  if (!chosen) return { ok: false, code: DeliveryCode.NOT_CONFIGURED };
  const entry = findCatalogTemplate(catalog, chosen.name, chosen.language);
  if (!isWhatsappTemplateUsable(entry, useKey)) return { ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE };
  return { ok: true, template: { name: chosen.name, language: chosen.language } };
}
