import { NotificationEvent } from "./notification-contract.js";

export const WHATSAPP_BINDINGS_CONFIG_KEY = "whatsapp_bindings";
export const WHATSAPP_CATALOG_CONFIG_KEY = "whatsapp_catalog";
export const WHATSAPP_APPROVED_STATUS = "APPROVED";
export const WHATSAPP_DEFAULT_LANGUAGE = "pt_BR";
export const WHATSAPP_MAX_VARIABLES = 20;
export const WHATSAPP_MAX_FIXED_TEXT = 200;

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

export const WhatsappMappingKind = Object.freeze({ FIELD: "field", TEXT: "text" });

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

// Sample values for previews and for the connection test message.
export const whatsappFieldExamples = Object.freeze({
  [WhatsappTemplateField.TUTOR_NAME]: "Maria Silva",
  [WhatsappTemplateField.PROTOCOL]: "123/2026",
  [WhatsappTemplateField.SCHEDULE_DATE]: "20/11/2026",
  [WhatsappTemplateField.SCHEDULE_TIME]: "09:00",
  [WhatsappTemplateField.SCHEDULE_LOCATION_NAME]: "Unidade Veterinária Municipal",
  [WhatsappTemplateField.SCHEDULE_ADDRESS]: "Rua das Flores, 100",
  [WhatsappTemplateField.SCHEDULE_ADDRESS_URL]: "https://maps.example.com/unidade",
  [WhatsappTemplateField.ANIMAL_NAME]: "Rex",
  [WhatsappTemplateField.SPECIES]: "Cão",
  [WhatsappTemplateField.CITY]: "Município",
  [WhatsappTemplateField.NOTIFICATION_MESSAGE]: "Solicitação 123/2026: agendamento confirmado.",
});

export const whatsappEventLabels = Object.freeze({
  [NotificationEvent.SCHEDULE_CONFIRMED]: "Agendamento confirmado",
  [NotificationEvent.SCHEDULE_CHANGED]: "Agendamento alterado (reagendamento)",
  [NotificationEvent.SCHEDULE_CANCELLED]: "Agendamento cancelado",
  [NotificationEvent.DOCUMENTS_REVIEWED]: "Documentos conferidos",
  [NotificationEvent.COMPLETED]: "Atendimento concluído",
});

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max && !CONTROL_CHARACTERS.test(trimmed) ? trimmed : "";
}

function fieldMapping(...fields) {
  return fields.map((value) => ({ kind: WhatsappMappingKind.FIELD, value }));
}

// Templates already approved in the Meta account (positions follow the registered body text).
export function buildDefaultWhatsappBindings() {
  const schedule = fieldMapping(
    WhatsappTemplateField.TUTOR_NAME, WhatsappTemplateField.SCHEDULE_DATE,
    WhatsappTemplateField.SCHEDULE_TIME, WhatsappTemplateField.SCHEDULE_LOCATION_NAME,
  );
  return {
    [NotificationEvent.SCHEDULE_CONFIRMED]: { templateName: "castracao_confirmacao_agendamento", languageCode: WHATSAPP_DEFAULT_LANGUAGE, mapping: schedule },
    [NotificationEvent.SCHEDULE_CHANGED]: { templateName: "castracao_reagendamento", languageCode: WHATSAPP_DEFAULT_LANGUAGE, mapping: schedule },
    [NotificationEvent.SCHEDULE_CANCELLED]: {
      templateName: "castracao_cancelamento", languageCode: WHATSAPP_DEFAULT_LANGUAGE,
      mapping: fieldMapping(WhatsappTemplateField.TUTOR_NAME, WhatsappTemplateField.SCHEDULE_DATE, WhatsappTemplateField.SCHEDULE_TIME),
    },
    [NotificationEvent.DOCUMENTS_REVIEWED]: null,
    [NotificationEvent.COMPLETED]: null,
  };
}

function normalizeMappingItem(item) {
  if (!item || typeof item !== "object") return null;
  if (item.kind === WhatsappMappingKind.FIELD) {
    return Object.values(WhatsappTemplateField).includes(item.value) ? { kind: item.kind, value: item.value } : null;
  }
  if (item.kind === WhatsappMappingKind.TEXT) {
    const value = cleanText(item.value, WHATSAPP_MAX_FIXED_TEXT);
    return value ? { kind: item.kind, value } : null;
  }
  return null;
}

// Returns a clean binding or null when any part is missing or invalid.
export function normalizeWhatsappBinding(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.mapping)) return null;
  const templateName = cleanText(value.templateName, 512);
  const languageCode = cleanText(value.languageCode, 20);
  if (!templateName || !languageCode || value.mapping.length > WHATSAPP_MAX_VARIABLES) return null;
  const mapping = value.mapping.map(normalizeMappingItem);
  return mapping.includes(null) ? null : { templateName, languageCode, mapping };
}

// A stored null means the event was unlinked on purpose; a missing key falls back to the Meta defaults.
export function normalizeWhatsappBindings(stored) {
  const defaults = buildDefaultWhatsappBindings();
  const saved = stored?.bindings && typeof stored.bindings === "object" && !Array.isArray(stored.bindings) ? stored.bindings : {};
  return Object.fromEntries(Object.values(NotificationEvent).map((event) => [
    event, Object.hasOwn(saved, event) ? normalizeWhatsappBinding(saved[event]) : defaults[event],
  ]));
}

// `template` is the synchronized catalog entry for the requested name and language.
export function validateWhatsappBindingInput(event, input, template) {
  if (!Object.values(NotificationEvent).includes(event)) return "Evento de notificação inválido.";
  const binding = normalizeWhatsappBinding(input);
  if (!binding) return "Informe o template, o idioma e o campo de cada variável.";
  if (!template) return "Template não encontrado no catálogo. Sincronize os templates e tente novamente.";
  if (template.status !== WHATSAPP_APPROVED_STATUS) return "Só é possível vincular templates aprovados pela Meta.";
  if (template.supported !== true) return template.unsupportedReason || "Formato de template não suportado.";
  if (binding.mapping.length !== template.variableCount) {
    return `O template tem ${template.variableCount} variável(is) e o mapeamento informa ${binding.mapping.length}.`;
  }
  return "";
}
