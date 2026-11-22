import { WHATSAPP_CATALOG_CONFIG_KEY, WHATSAPP_MAX_BODY_LENGTH } from "../../../shared/whatsapp-templates-contract.js";
import { readWhatsappConfigValue, updateWhatsappConfigValue } from "../repositories/whatsapp-templates.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { describeGraphTemplate, fetchGraphTemplates } from "./whatsapp-graph-templates.js";

const MIN_SYNC_INTERVAL_MS = 30_000;
const MAX_TEMPLATES = 500;
const PARAMETER_FORMATS = ["POSITIONAL", "NAMED"];
const HEADER_KINDS = ["NONE", "TEXT", "TEXT_VARIABLE", "MEDIA"];
const lastSyncAttempt = new Map();

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const { name, language, status, category, parameterFormat, hasBody, bodyVariables, bodySequential, header, buttons, extraComponents } = entry;
  if ([name, language, status, category].some((value) => typeof value !== "string") || !name || !language) return null;
  if (!PARAMETER_FORMATS.includes(parameterFormat) || !HEADER_KINDS.includes(header)) return null;
  if ([hasBody, bodySequential, extraComponents].some((value) => typeof value !== "boolean")) return null;
  if (!Number.isInteger(bodyVariables) || bodyVariables < 0) return null;
  if (!Array.isArray(buttons) || buttons.length > 10 || buttons.some((button) => typeof button !== "string")) return null;
  // The body text came later: an entry cached without it stays, with no text to show until the next synchronization.
  const bodyText = typeof entry.bodyText === "string" && entry.bodyText.length <= WHATSAPP_MAX_BODY_LENGTH ? entry.bodyText : "";
  return { name, language, status, category, parameterFormat, bodyText, hasBody, bodyVariables, bodySequential, header, buttons, extraComponents };
}

// Entries cached before a format change fail validation and are dropped: the next synchronization rebuilds them.
export function normalizeWhatsappCatalog(value) {
  const templates = Array.isArray(value?.templates) ? value.templates.map(normalizeEntry).filter(Boolean).slice(0, MAX_TEMPLATES) : [];
  return { syncedAt: typeof value?.syncedAt === "string" ? value.syncedAt : "", templates };
}

export function findCatalogTemplate(catalog, name, language) {
  return catalog.templates.find((template) => template.name === name && template.language === language) || null;
}

export async function loadWhatsappCatalog(municipalityId, database) {
  return normalizeWhatsappCatalog(await readWhatsappConfigValue(WHATSAPP_CATALOG_CONFIG_KEY, municipalityId, database));
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
    throw Object.assign(new Error("Escolha a variável do token e informe o ID da conta do WhatsApp Business antes de sincronizar."), { status: 400 });
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
