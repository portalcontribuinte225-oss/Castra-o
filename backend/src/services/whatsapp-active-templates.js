import { DeliveryCode } from "../../../shared/notification-contract.js";
import {
  WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, WHATSAPP_APPROVED_STATUS, WHATSAPP_TEMPLATE_LINKS_CONFIG_KEY, activateTemplate, activeUseKeys,
  cleanTemplateIdentity, deactivateTemplate, findTemplateLink, getWhatsappUse, isRetiredWhatsappTemplate, isWhatsappTemplateUsable, noticeStructureReason,
  normalizeActiveTemplates, normalizeTemplateLinks, recognizeWhatsappTemplate, templateFields, templateLinkIssue, whatsappFieldLabels,
} from "../../../shared/whatsapp-templates-contract.js";
import { readWhatsappConfigValue, updateWhatsappConfigValue } from "../repositories/whatsapp-templates.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { previewFieldValues } from "./notifications/whatsapp-template-parameters.js";
import { findCatalogTemplate, loadWhatsappCatalog } from "./whatsapp-catalog.js";

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

const sameTemplate = (item, name, language) => item.name === name && item.language === language;

const templateLabel = (uses) => getWhatsappUse(uses[0])?.label || "";

export async function loadActiveTemplates(municipalityId, database) {
  return normalizeActiveTemplates(await readWhatsappConfigValue(WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, municipalityId, database));
}

export async function loadTemplateLinks(municipalityId, database) {
  return normalizeTemplateLinks(await readWhatsappConfigValue(WHATSAPP_TEMPLATE_LINKS_CONFIG_KEY, municipalityId, database));
}

// One row per catalog template, plus a row for each active template that no longer exists on Meta. `fields` is the field of each
// numbered variable (the link's or the use's own order) and `variables` their names; a link keeps its notice and fields even while
// the template no longer fits it, so the screen can show and fix it.
export function buildTemplateRows(catalog, active, links = []) {
  const rows = catalog.templates.filter(({ name }) => !isRetiredWhatsappTemplate(name)).map((entry) => {
    const link = findTemplateLink(links, entry.name, entry.language);
    const { uses, reason } = recognizeWhatsappTemplate(entry, link);
    const first = getWhatsappUse(uses[0]);
    const fields = link ? link.fields : templateFields(uses[0]);
    return {
      name: entry.name,
      language: entry.language,
      status: entry.status,
      category: entry.category,
      label: templateLabel(uses),
      uses,
      variables: link ? fields.map((field) => whatsappFieldLabels[field]) : first ? [...first.variables] : [],
      reason: uses.length ? "" : reason,
      active: activeUseKeys(active, entry.name, entry.language).length > 0,
      canActivate: uses.length > 0 && entry.status === WHATSAPP_APPROVED_STATUS,
      configured: Boolean(link),
      linkedUse: link ? link.use : "",
      fields: [...fields],
      bodyText: entry.bodyText,
      bodyVariables: entry.bodyVariables,
      // Code templates keep the structure Meta gives them, so only the others can be linked to a notice.
      configurable: entry.category !== "AUTHENTICATION",
      structureReason: noticeStructureReason(entry),
    };
  });
  const known = new Set(catalog.templates.map((entry) => `${entry.name}|${entry.language}`));
  const missing = new Map();
  for (const [key, item] of Object.entries(active)) {
    if (isRetiredWhatsappTemplate(item.name)) continue;
    const id = `${item.name}|${item.language}`;
    if (known.has(id)) continue;
    const row = missing.get(id) || { name: item.name, language: item.language, keys: [] };
    row.keys.push(key);
    missing.set(id, row);
  }
  for (const { name, language, keys } of missing.values()) {
    const first = getWhatsappUse(keys[0]);
    const link = findTemplateLink(links, name, language);
    rows.push({
      name, language, status: "NOT_FOUND", category: "", label: templateLabel(keys), uses: keys, variables: [...first.variables], reason: "", active: true,
      canActivate: false, configured: Boolean(link), linkedUse: link ? link.use : "", fields: templateFields(keys[0], link), bodyText: "", bodyVariables: 0,
      configurable: false, structureReason: "",
    });
  }
  return rows;
}

export async function listWhatsappTemplates(municipalityId, database) {
  const [catalog, active, links] = await Promise.all([
    loadWhatsappCatalog(municipalityId, database), loadActiveTemplates(municipalityId, database), loadTemplateLinks(municipalityId, database),
  ]);
  return { syncedAt: catalog.syncedAt, templates: buildTemplateRows(catalog, active, links), fieldSamples: previewFieldValues() };
}

// Turning a template on needs it recognized (by its link or its name) and approved; turning it off only removes it from the active list.
export async function setWhatsappTemplateActive({ municipalityId, name, language, active: turnOn, audit, database }) {
  const identity = cleanTemplateIdentity(name, language);
  if (!identity || typeof turnOn !== "boolean") throw badRequest("Informe o template, o idioma e se ele deve ficar ativo.");
  let entry = null;
  let link = null;
  if (turnOn) {
    entry = findCatalogTemplate(await loadWhatsappCatalog(municipalityId, database), identity.name, identity.language);
    if (!entry) throw badRequest("Template não encontrado no catálogo. Sincronize os templates e tente novamente.");
    link = findTemplateLink(await loadTemplateLinks(municipalityId, database), identity.name, identity.language);
    const { uses, reason } = recognizeWhatsappTemplate(entry, link);
    if (!uses.length) throw badRequest(reason);
    if (entry.status !== WHATSAPP_APPROVED_STATUS) throw badRequest("Só é possível ligar templates aprovados pela Meta.");
  }
  await updateWhatsappConfigValue(
    WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, municipalityId,
    (current) => {
      const stored = normalizeActiveTemplates(current);
      return { active: turnOn ? activateTemplate(stored, entry, link) : deactivateTemplate(stored, identity.name, identity.language) };
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

// Links a template to a notice and to the field of each numbered variable; an empty `use` removes the link, so the name decides again.
// The template stays on only for the notices it still sends: a new notice turns it off, new fields alone keep it on.
export async function setWhatsappTemplateLink({ municipalityId, name, language, use, fields, audit, database }) {
  const identity = cleanTemplateIdentity(name, language);
  if (!identity || typeof use !== "string") throw badRequest("Informe o template, o idioma e o aviso.");
  const entry = findCatalogTemplate(await loadWhatsappCatalog(municipalityId, database), identity.name, identity.language);
  if (!entry) throw badRequest("Template não encontrado no catálogo. Sincronize os templates e tente novamente.");
  const link = use === "" ? null : { ...identity, use, fields };
  if (link) {
    const issue = templateLinkIssue(entry, use, fields);
    if (issue) throw badRequest(issue);
  }
  await updateWhatsappConfigValue(
    WHATSAPP_TEMPLATE_LINKS_CONFIG_KEY, municipalityId,
    (current) => {
      const stored = normalizeTemplateLinks(current);
      const others = stored.filter((item) => !sameTemplate(item, identity.name, identity.language));
      if (!link && others.length === stored.length) return undefined;
      return { links: link ? [...others, { ...link, fields: [...fields] }] : others };
    },
    {
      database,
      audit: audit && {
        ...audit, action: AUDIT_ACTIONS.WHATSAPP_TEMPLATE_UPDATE, entityType: "config", entityId: WHATSAPP_TEMPLATE_LINKS_CONFIG_KEY,
        changes: { name: identity.name, language: identity.language, use, fields: link ? fields : [] },
      },
    },
  );
  const stillSent = recognizeWhatsappTemplate(entry, link).uses;
  await updateWhatsappConfigValue(WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY, municipalityId, (current) => {
    const stored = normalizeActiveTemplates(current);
    const kept = Object.fromEntries(Object.entries(stored).filter(([key, item]) => !sameTemplate(item, identity.name, identity.language) || stillSent.includes(key)));
    return Object.keys(kept).length === Object.keys(stored).length ? undefined : { active: kept };
  }, { database });
  return listWhatsappTemplates(municipalityId, database);
}

// The single answer to "may this use be sent?": an active template that still exists, is approved and keeps its structure, with the
// field of each numbered variable.
export async function resolveActiveTemplate(municipalityId, useKey, database) {
  const [active, catalog, links] = await Promise.all([
    loadActiveTemplates(municipalityId, database), loadWhatsappCatalog(municipalityId, database), loadTemplateLinks(municipalityId, database),
  ]);
  const chosen = active[useKey];
  if (!chosen) return { ok: false, code: DeliveryCode.NOT_CONFIGURED };
  const entry = findCatalogTemplate(catalog, chosen.name, chosen.language);
  const link = findTemplateLink(links, chosen.name, chosen.language);
  if (!isWhatsappTemplateUsable(entry, useKey, link)) return { ok: false, code: DeliveryCode.TEMPLATE_UNAVAILABLE };
  return { ok: true, template: { name: chosen.name, language: chosen.language, fields: templateFields(useKey, link) } };
}
