import { LEGACY_DOCUMENTS_REVIEWED, NotificationEvent } from "./notification-contract.js";
import { AuthPurpose } from "./auth-contract.js";
import { inheritDocumentNoticeValues } from "./use-switches-contract.js";

export const WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY = "whatsapp_active_templates";
export const WHATSAPP_CATALOG_CONFIG_KEY = "whatsapp_catalog";
// Which notice each template sends and which field fills each numbered variable, as chosen on the templates screen.
export const WHATSAPP_TEMPLATE_LINKS_CONFIG_KEY = "whatsapp_template_links";
export const WHATSAPP_APPROVED_STATUS = "APPROVED";
// Reason for a template whose name is simply not one of the system's notices (not a defect of the template).
export const WHATSAPP_NOT_A_NOTICE_REASON = "O nome não indica um aviso do sistema.";
export const WHATSAPP_LEGACY_DOCUMENTS_LABEL = "Documentos deferidos e indeferidos";
export const WHATSAPP_MAX_VARIABLES = 20;
// The longest body text kept from Meta; a longer body is treated as missing.
export const WHATSAPP_MAX_BODY_LENGTH = 1100;
export const WHATSAPP_TEMPLATE_PREFIX = "castracao_";

export const WhatsappTemplateField = Object.freeze({
  TUTOR_NAME: "tutor_name",
  PROTOCOL: "protocol",
  SCHEDULE_DATE: "schedule_date",
  SCHEDULE_TIME: "schedule_time",
  SCHEDULE_LOCATION_NAME: "schedule_location_name",
  SCHEDULE_ADDRESS: "schedule_address",
  SCHEDULE_ADDRESS_URL: "schedule_address_url",
  ANIMAL_NAME: "animal_name",
  SPECIES: "species",
  CITY: "city",
  NOTIFICATION_MESSAGE: "notification_message",
});

export const whatsappFieldLabels = Object.freeze({
  [WhatsappTemplateField.TUTOR_NAME]: "Nome do tutor",
  [WhatsappTemplateField.PROTOCOL]: "Protocolo",
  [WhatsappTemplateField.SCHEDULE_DATE]: "Data do agendamento",
  [WhatsappTemplateField.SCHEDULE_TIME]: "Horário do agendamento",
  [WhatsappTemplateField.SCHEDULE_LOCATION_NAME]: "Local do atendimento",
  [WhatsappTemplateField.SCHEDULE_ADDRESS]: "Endereço do local",
  [WhatsappTemplateField.SCHEDULE_ADDRESS_URL]: "Link do endereço",
  [WhatsappTemplateField.ANIMAL_NAME]: "Nome do animal",
  [WhatsappTemplateField.SPECIES]: "Espécie",
  [WhatsappTemplateField.CITY]: "Município",
  [WhatsappTemplateField.NOTIFICATION_MESSAGE]: "Mensagem do aviso",
});

export const WhatsappUseKind = Object.freeze({ NOTICE: "notice", ACCESS: "access" });
export const WhatsappAccessLayout = Object.freeze({ CODE: "code", CONTACT: "contact" });

const field = WhatsappTemplateField;
const scheduleFields = [field.TUTOR_NAME, field.SCHEDULE_DATE, field.SCHEDULE_TIME, field.SCHEDULE_LOCATION_NAME, field.PROTOCOL];
const scheduleOutcomeFields = [field.TUTOR_NAME, field.SCHEDULE_DATE, field.SCHEDULE_TIME];
const documentFields = [field.PROTOCOL, field.NOTIFICATION_MESSAGE];
const documentOutcomeUses = [NotificationEvent.DOCUMENTS_APPROVED, NotificationEvent.DOCUMENTS_REJECTED];
const templateAliases = Object.freeze({
  [NotificationEvent.NO_SHOW]: ["nao_compareceu"],
  [NotificationEvent.DOCUMENTS_APPROVED]: ["documentos_aprovados", "documentos_conferidos"],
  [NotificationEvent.DOCUMENTS_REJECTED]: ["documentos_rejeitados", "documentos_conferidos"],
  [AuthPurpose.CONTACT_CHANGED]: ["dados_tutor_alterados"],
});

function notice(key, label, namePart, fields) {
  return Object.freeze({
    key, kind: WhatsappUseKind.NOTICE, label, groupLabel: label, namePart,
    fields: Object.freeze([...fields]), variables: Object.freeze(fields.map((item) => whatsappFieldLabels[item])),
  });
}

function access(key, label, groupLabel, namePart, layout, variables, nameSuffix = false) {
  return Object.freeze({ key, kind: WhatsappUseKind.ACCESS, label, groupLabel, namePart, layout, nameSuffix, variables: Object.freeze([...variables]) });
}

// A use is something a template can serve: a notice sent about a request or an access message.
// Notice keys are NotificationEvent values and access keys are AuthPurpose values, so they never collide.
export const whatsappUses = Object.freeze([
  notice(NotificationEvent.REQUEST_REGISTERED, "Solicitação registrada", "solicitacao_registrada", [field.PROTOCOL, field.NOTIFICATION_MESSAGE]),
  notice(NotificationEvent.SCHEDULE_CONFIRMED, "Agendamento confirmado", "confirmacao_agendamento", scheduleFields),
  notice(NotificationEvent.SCHEDULE_CHANGED, "Agendamento alterado", "reagendamento", scheduleFields),
  notice(NotificationEvent.SCHEDULE_CANCELLED, "Agendamento cancelado", "cancelamento", scheduleOutcomeFields),
  notice(NotificationEvent.NO_SHOW, "Não comparecimento", "nao_comparecimento", scheduleOutcomeFields),
  notice(NotificationEvent.DOCUMENTS_APPROVED, "Documentos deferidos", "documentos_deferidos", documentFields),
  notice(NotificationEvent.DOCUMENTS_REJECTED, "Documentos indeferidos", "documentos_indeferidos", documentFields),
  notice(NotificationEvent.COMPLETED, "Atendimento concluído", "atendimento_concluido", [field.PROTOCOL, field.NOTIFICATION_MESSAGE]),
  notice(NotificationEvent.REQUEST_REJECTED, "Solicitação indeferida", "indeferimento", [field.PROTOCOL, field.NOTIFICATION_MESSAGE]),
  access(AuthPurpose.PASSWORD_RESET, "Recuperação de senha", "Códigos de acesso", "codigo", WhatsappAccessLayout.CODE, ["Código de verificação"], true),
  access(AuthPurpose.VERIFY_PHONE, "Confirmação de telefone", "Códigos de acesso", "codigo", WhatsappAccessLayout.CODE, ["Código de verificação"], true),
  access(AuthPurpose.REQUEST_TRACKING, "Acompanhamento de solicitação", "Códigos de acesso", "codigo", WhatsappAccessLayout.CODE, ["Código de verificação"], true),
  access(AuthPurpose.CONTACT_CHANGED, "Contato alterado", "Contato alterado", "contato_alterado", WhatsappAccessLayout.CONTACT, [whatsappFieldLabels[field.TUTOR_NAME]]),
]);

export function getWhatsappUse(key) {
  return whatsappUses.find((use) => use.key === key) || null;
}

// Returns the part of a `castracao_<part>[_v<n>]` name, or null when the name does not follow the convention.
export function parseWhatsappTemplateName(name) {
  if (typeof name !== "string" || !name.startsWith(WHATSAPP_TEMPLATE_PREFIX)) return null;
  const part = name.slice(WHATSAPP_TEMPLATE_PREFIX.length).replace(/_v\d+$/, "");
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(part) ? part : null;
}

function matchesUse(part, use) {
  return part === use.namePart || templateAliases[use.key]?.includes(part)
    || (use.nameSuffix === true && part.startsWith(`${use.namePart}_`));
}

function scheduleOutcomeLinkIssue(name, use) {
  const part = parseWhatsappTemplateName(name);
  const opposite = use === NotificationEvent.NO_SHOW ? NotificationEvent.SCHEDULE_CANCELLED
    : use === NotificationEvent.SCHEDULE_CANCELLED ? NotificationEvent.NO_SHOW : null;
  return opposite && matchesUse(part, getWhatsappUse(opposite))
    ? "Este template pertence ao outro aviso de agenda. Confira o vínculo." : "";
}

const linkedUses = (link) => link.use === LEGACY_DOCUMENTS_REVIEWED ? [...documentOutcomeUses] : [link.use];

const NOTICE_BUTTONS = new Set(["QUICK_REPLY", "PHONE_NUMBER", "URL"]);
const noticeButtonsReason = (entry) => (entry.buttons.every((button) => NOTICE_BUTTONS.has(button)) ? "" : "Botão com variável ou de código não é suportado.");

function structuralReason(entry) {
  if (!entry.hasBody) return "O template não tem corpo de texto.";
  if (entry.parameterFormat !== "POSITIONAL") return "Variáveis com nome ainda não são suportadas.";
  if (!entry.bodySequential) return "As variáveis do corpo precisam ser numeradas em sequência: {{1}}, {{2}}…";
  if (entry.header !== "NONE" && entry.header !== "TEXT") return "Cabeçalho com variável ou mídia não é suportado.";
  if (entry.extraComponents) return "O template tem componentes que o sistema não suporta.";
  return "";
}

function useReason(entry, use) {
  const expected = use.variables.length;
  if (entry.bodyVariables !== expected) return `O corpo tem ${entry.bodyVariables} variável(is); o esperado é ${expected}.`;
  if (use.layout === WhatsappAccessLayout.CODE) {
    if (entry.category !== "AUTHENTICATION") return "Códigos de acesso precisam ser um template de autenticação.";
    return entry.buttons.length === 1 && entry.buttons[0] === "OTP_COPY_CODE" ? "" : "O template de código precisa do botão de copiar código.";
  }
  if (use.key === AuthPurpose.CONTACT_CHANGED && parseWhatsappTemplateName(entry.name) === "dados_tutor_alterados"
    && entry.category !== "UTILITY") return "O aviso de contato alterado precisa ser um template de utilidade.";
  return noticeButtonsReason(entry);
}

// Why a template cannot carry any notice, whatever its name or link: "" when its structure fits.
export function noticeStructureReason(entry) {
  const structural = structuralReason(entry);
  if (structural) return structural;
  return noticeButtonsReason(entry);
}

// Which uses a catalog entry can serve, judged by its structure and never by its status: the notice of its link when the templates
// screen configured one, otherwise the notice its name indicates.
export function recognizeWhatsappTemplate(entry, link = null) {
  if (link) {
    const reason = scheduleOutcomeLinkIssue(entry.name, link.use) || noticeStructureReason(entry)
      || (link.fields.length === entry.bodyVariables ? "" : `O corpo tem ${entry.bodyVariables} variável(is); a configuração tem ${link.fields.length}. Configure o template de novo.`);
    return reason ? { uses: [], reason } : { uses: linkedUses(link), reason: "" };
  }
  const part = parseWhatsappTemplateName(entry?.name);
  const candidates = part === null ? [] : whatsappUses.filter((use) => matchesUse(part, use));
  if (!candidates.length) return { uses: [], reason: WHATSAPP_NOT_A_NOTICE_REASON };
  const structural = structuralReason(entry);
  if (structural) return { uses: [], reason: structural };
  const checked = candidates.map((use) => ({ use, reason: useReason(entry, use) }));
  const passing = checked.filter(({ reason }) => !reason).map(({ use }) => use.key);
  return passing.length ? { uses: passing, reason: "" } : { uses: [], reason: checked[0].reason };
}

export function isWhatsappTemplateUsable(entry, useKey, link = null) {
  return Boolean(entry) && entry.status === WHATSAPP_APPROVED_STATUS && recognizeWhatsappTemplate(entry, link).uses.includes(useKey);
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max && !CONTROL_CHARACTERS.test(trimmed) ? trimmed : "";
}

export function cleanTemplateIdentity(name, language) {
  const cleanName = cleanText(name, 512);
  const cleanLanguage = cleanText(language, 20);
  return cleanName && cleanLanguage ? { name: cleanName, language: cleanLanguage } : null;
}

// Stored value: { active: { <use key>: { name, language } } }. Only known uses with a valid identity survive.
export function normalizeActiveTemplates(stored) {
  const source = inheritDocumentNoticeValues(stored?.active);
  const active = {};
  for (const use of whatsappUses) {
    const identity = cleanTemplateIdentity(source[use.key]?.name, source[use.key]?.language);
    // The previous alias must not be carried over as an activation for a different event.
    if (identity && !scheduleOutcomeLinkIssue(identity.name, use.key)) active[use.key] = identity;
  }
  return active;
}

// Turning a template on replaces whichever template was active for each of its uses.
export function activateTemplate(active, entry, link = null) {
  const next = { ...active };
  for (const key of recognizeWhatsappTemplate(entry, link).uses) next[key] = { name: entry.name, language: entry.language };
  return next;
}

export function deactivateTemplate(active, name, language) {
  return Object.fromEntries(Object.entries(active).filter(([, item]) => !(item.name === name && item.language === language)));
}

export function activeUseKeys(active, name, language) {
  return Object.entries(active).filter(([, item]) => item.name === name && item.language === language).map(([key]) => key);
}

const knownFields = new Set(Object.values(WhatsappTemplateField));
export const isWhatsappNoticeUse = (key) => getWhatsappUse(key)?.kind === WhatsappUseKind.NOTICE;
const isLinkUse = (key) => isWhatsappNoticeUse(key) || key === LEGACY_DOCUMENTS_REVIEWED;

// Stored value: { links: [{ name, language, use, fields }] }. Only links to a notice whose fields are all known survive, one per template.
export function normalizeTemplateLinks(stored) {
  const source = Array.isArray(stored?.links) ? stored.links : [];
  const links = [];
  for (const item of source) {
    const identity = cleanTemplateIdentity(item?.name, item?.language);
    if (!identity || !isLinkUse(item.use) || !Array.isArray(item.fields) || item.fields.length > WHATSAPP_MAX_VARIABLES) continue;
    if (!item.fields.every((value) => knownFields.has(value))) continue;
    if (findTemplateLink(links, identity.name, identity.language)) continue;
    const movedCancellation = item.use === NotificationEvent.NO_SHOW && scheduleOutcomeLinkIssue(identity.name, item.use);
    const use = movedCancellation ? NotificationEvent.SCHEDULE_CANCELLED : item.use;
    if (!scheduleOutcomeLinkIssue(identity.name, use)) links.push({ ...identity, use, fields: [...item.fields] });
  }
  return links;
}

export function findTemplateLink(links, name, language) {
  return links.find((link) => link.name === name && link.language === language) || null;
}

// The field that fills each numbered variable when the template sends the use: what its link chose, or the use's own order.
export function templateFields(useKey, link = null) {
  if (link && linkedUses(link).includes(useKey)) return [...link.fields];
  return [...(getWhatsappUse(useKey)?.fields || [])];
}

// Why a link cannot be saved for a catalog entry ("" when it can).
export function templateLinkIssue(entry, use, fields) {
  if (!isLinkUse(use)) return "Escolha um aviso do sistema.";
  if (!Array.isArray(fields) || fields.some((value) => !knownFields.has(value))) return "Escolha uma variável do sistema para cada número.";
  const structural = scheduleOutcomeLinkIssue(entry.name, use) || noticeStructureReason(entry);
  if (structural) return structural;
  return fields.length === entry.bodyVariables ? "" : `O template tem ${entry.bodyVariables} variável(is); escolha uma para cada número.`;
}
