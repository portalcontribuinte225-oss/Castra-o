import { NotificationEvent } from "./notification-contract.js";
import { AuthPurpose } from "./auth-contract.js";

export const WHATSAPP_ACTIVE_TEMPLATES_CONFIG_KEY = "whatsapp_active_templates";
export const WHATSAPP_CATALOG_CONFIG_KEY = "whatsapp_catalog";
export const WHATSAPP_APPROVED_STATUS = "APPROVED";
// Reason for a template whose name is simply not one of the system's notices (not a defect of the template).
export const WHATSAPP_NOT_A_NOTICE_REASON = "O nome não indica um aviso do sistema.";
export const WHATSAPP_DEFAULT_LANGUAGE = "pt_BR";
export const WHATSAPP_MAX_VARIABLES = 20;
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
export const WhatsappAccessLayout = Object.freeze({ CODE: "code", CONTACT: "contact", PASSWORD: "password" });

const field = WhatsappTemplateField;
const scheduleFields = [field.TUTOR_NAME, field.SCHEDULE_DATE, field.SCHEDULE_TIME, field.SCHEDULE_LOCATION_NAME, field.PROTOCOL];

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
  notice(NotificationEvent.SCHEDULE_CONFIRMED, "Agendamento confirmado", "confirmacao_agendamento", scheduleFields),
  notice(NotificationEvent.SCHEDULE_CHANGED, "Agendamento alterado", "reagendamento", scheduleFields),
  notice(NotificationEvent.NO_SHOW, "Não comparecimento", "cancelamento", [field.TUTOR_NAME, field.SCHEDULE_DATE, field.SCHEDULE_TIME]),
  notice(NotificationEvent.DOCUMENTS_REVIEWED, "Documentos conferidos", "documentos_conferidos", [field.PROTOCOL, field.NOTIFICATION_MESSAGE]),
  notice(NotificationEvent.COMPLETED, "Atendimento concluído", "atendimento_concluido", [field.PROTOCOL, field.NOTIFICATION_MESSAGE]),
  access(AuthPurpose.PASSWORD_RESET, "Recuperação de senha", "Códigos de acesso", "codigo", WhatsappAccessLayout.CODE, ["Código de verificação"], true),
  access(AuthPurpose.VERIFY_PHONE, "Confirmação de telefone", "Códigos de acesso", "codigo", WhatsappAccessLayout.CODE, ["Código de verificação"], true),
  access(AuthPurpose.REQUEST_TRACKING, "Acompanhamento de solicitação", "Códigos de acesso", "codigo", WhatsappAccessLayout.CODE, ["Código de verificação"], true),
  access(AuthPurpose.CONTACT_CHANGED, "Contato alterado", "Contato alterado", "contato_alterado", WhatsappAccessLayout.CONTACT, [whatsappFieldLabels[field.TUTOR_NAME]]),
  access(AuthPurpose.INITIAL_PASSWORD, "Senha inicial", "Senha inicial", "senha_inicial", WhatsappAccessLayout.PASSWORD, [whatsappFieldLabels[field.TUTOR_NAME], "Senha temporária"]),
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
  return part === use.namePart || (use.nameSuffix === true && part.startsWith(`${use.namePart}_`));
}

const NOTICE_BUTTONS = new Set(["QUICK_REPLY", "PHONE_NUMBER", "URL"]);

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
  return entry.buttons.every((button) => NOTICE_BUTTONS.has(button)) ? "" : "Botão com variável ou de código não é suportado.";
}

// Which uses a catalog entry can serve, judged only by its name and structure (never by its status).
export function recognizeWhatsappTemplate(entry) {
  const part = parseWhatsappTemplateName(entry?.name);
  const candidates = part === null ? [] : whatsappUses.filter((use) => matchesUse(part, use));
  if (!candidates.length) return { uses: [], reason: WHATSAPP_NOT_A_NOTICE_REASON };
  const structural = structuralReason(entry);
  if (structural) return { uses: [], reason: structural };
  const checked = candidates.map((use) => ({ use, reason: useReason(entry, use) }));
  const passing = checked.filter(({ reason }) => !reason).map(({ use }) => use.key);
  return passing.length ? { uses: passing, reason: "" } : { uses: [], reason: checked[0].reason };
}

export function isWhatsappTemplateUsable(entry, useKey) {
  return Boolean(entry) && entry.status === WHATSAPP_APPROVED_STATUS && recognizeWhatsappTemplate(entry).uses.includes(useKey);
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
  const source = stored?.active && typeof stored.active === "object" && !Array.isArray(stored.active) ? stored.active : {};
  const active = {};
  for (const use of whatsappUses) {
    const identity = cleanTemplateIdentity(source[use.key]?.name, source[use.key]?.language);
    if (identity) active[use.key] = identity;
  }
  return active;
}

// Turning a template on replaces whichever template was active for each of its uses.
export function activateTemplate(active, entry) {
  const next = { ...active };
  for (const key of recognizeWhatsappTemplate(entry).uses) next[key] = { name: entry.name, language: entry.language };
  return next;
}

export function deactivateTemplate(active, name, language) {
  return Object.fromEntries(Object.entries(active).filter(([, item]) => !(item.name === name && item.language === language)));
}

export function activeUseKeys(active, name, language) {
  return Object.entries(active).filter(([, item]) => item.name === name && item.language === language).map(([key]) => key);
}
