import { WHATSAPP_CATALOG_CONFIG_KEY, WHATSAPP_DEFAULT_LANGUAGE } from "../../../shared/whatsapp-binding-contract.js";
import { readWhatsappConfigValue, updateWhatsappConfigValue } from "../repositories/whatsapp-templates.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { describeGraphTemplate, fetchGraphTemplates } from "./whatsapp-graph-templates.js";

const MIN_SYNC_INTERVAL_MS = 30_000;
const MAX_TEMPLATES = 500;
const lastSyncAttempt = new Map();

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const { name, language, status, category, bodyText, variableCount, supported, unsupportedReason } = entry;
  const strings = [name, language, status, category, bodyText, unsupportedReason];
  if (strings.some((value) => typeof value !== "string") || !name || !language) return null;
  if (!Number.isInteger(variableCount) || variableCount < 0 || typeof supported !== "boolean") return null;
  return { name, language, status, category, bodyText, variableCount, supported, unsupportedReason };
}

export function normalizeWhatsappCatalog(value) {
  const templates = Array.isArray(value?.templates) ? value.templates.map(normalizeEntry).filter(Boolean).slice(0, MAX_TEMPLATES) : [];
  return { syncedAt: typeof value?.syncedAt === "string" ? value.syncedAt : "", templates };
}

export function findCatalogTemplate(catalog, name, language) {
  return catalog.templates.find((template) => template.name === name && template.language === language) || null;
}

// Access templates are chosen by name only; prefer the default language when several translations exist.
export function findCatalogTemplateByName(catalog, name) {
  const matches = catalog.templates.filter((template) => template.name === name);
  return matches.find((template) => template.language === WHATSAPP_DEFAULT_LANGUAGE) || matches[0] || null;
}

export async function loadWhatsappCatalog(municipalityId, database) {
  return normalizeWhatsappCatalog(await readWhatsappConfigValue(WHATSAPP_CATALOG_CONFIG_KEY, municipalityId, database));
}

export async function loadAccessTemplate(municipalityId, name, database) {
  return findCatalogTemplateByName(await loadWhatsappCatalog(municipalityId, database), name);
}

function assertSyncAllowed(municipalityId, now) {
  const previous = lastSyncAttempt.get(municipalityId) || 0;
  if (now - previous < MIN_SYNC_INTERVAL_MS) {
    throw Object.assign(new Error("Aguarde alguns segundos antes de sincronizar novamente."), { status: 429 });
  }
  lastSyncAttempt.set(municipalityId, now);
}

export async function syncWhatsappCatalog({ municipalityId, runtime, audit, fetchImpl, now = Date.now(), database }) {
  if (!runtime.accessToken || !runtime.wabaId) {
    throw Object.assign(new Error("Informe o token e o ID da conta do WhatsApp Business antes de sincronizar."), { status: 400 });
  }
  assertSyncAllowed(municipalityId, now);
  const raw = await fetchGraphTemplates(runtime, { fetchImpl });
  const templates = raw.map(describeGraphTemplate).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  const catalog = { syncedAt: new Date(now).toISOString(), templates };
  await updateWhatsappConfigValue(WHATSAPP_CATALOG_CONFIG_KEY, municipalityId, () => catalog, {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.WHATSAPP_CATALOG_SYNC, entityType: "config", entityId: WHATSAPP_CATALOG_CONFIG_KEY, changes: { templates: templates.length } },
  });
  return catalog;
}

// Called after the provider rejected a template, so the next sends are blocked until a new synchronization.
export async function markCatalogTemplateStatus(municipalityId, name, language, status, database) {
  await updateWhatsappConfigValue(WHATSAPP_CATALOG_CONFIG_KEY, municipalityId, (current) => {
    const catalog = normalizeWhatsappCatalog(current);
    const target = findCatalogTemplate(catalog, name, language);
    if (!target || target.status === status) return undefined;
    return { ...catalog, templates: catalog.templates.map((template) => template === target ? { ...template, status } : template) };
  }, { database });
}
