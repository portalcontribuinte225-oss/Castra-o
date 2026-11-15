import { WhatsappTemplateField } from "../../../../shared/whatsapp-templates-contract.js";
import { formatScheduleDate } from "./notification-message.js";

const MAX_PARAMETER_LENGTH = 1024;
const EMPTY_PARAMETER = "não informado";

// Only mapped fields are resolved: never arbitrary request properties, CPF, contacts or the legacy validation key.
export function resolveWhatsappField(field, request = {}) {
  const workflow = request.workflow_data || request.workflowData || {};
  const values = {
    [WhatsappTemplateField.TUTOR_NAME]: request.tutor_name || "Solicitante",
    [WhatsappTemplateField.PROTOCOL]: request.protocol,
    [WhatsappTemplateField.SCHEDULE_DATE]: formatScheduleDate(request.schedule_date || ""),
    [WhatsappTemplateField.SCHEDULE_TIME]: workflow.scheduleSlotTime || workflow.scheduleTime || request.schedule_time || "hora a confirmar",
    [WhatsappTemplateField.SCHEDULE_LOCATION_NAME]: request.schedule_location_name || "local a confirmar",
    [WhatsappTemplateField.SCHEDULE_ADDRESS]: request.schedule_address || "endereço a confirmar",
    [WhatsappTemplateField.SCHEDULE_ADDRESS_URL]: request.schedule_address_url || "link indisponível",
    [WhatsappTemplateField.ANIMAL_NAME]: request.animal_name || "animal",
    [WhatsappTemplateField.SPECIES]: request.species || "espécie não informada",
    [WhatsappTemplateField.CITY]: request.city || request.schedule_municipality || "município não informado",
    [WhatsappTemplateField.NOTIFICATION_MESSAGE]: request.notification_message || "Há uma atualização na solicitação.",
  };
  return Object.hasOwn(values, field) ? String(values[field] ?? "") : "";
}

// The Cloud API rejects line breaks, tabs and long runs of spaces inside body parameters.
function parameterText(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, MAX_PARAMETER_LENGTH) || EMPTY_PARAMETER;
}

// `fields` is the ordered field list of the use: parameter n of the template receives fields[n - 1].
export function buildBodyComponents(fields, request) {
  const parameters = fields.map((item) => ({ type: "text", text: parameterText(resolveWhatsappField(item, request)) }));
  return parameters.length ? [{ type: "body", parameters }] : [];
}

export function previewRequest() {
  return {
    tutor_name: "Maria Silva", protocol: "123/2026", schedule_date: "2026-11-20", schedule_time: "09:00",
    schedule_location_name: "Unidade Veterinária Municipal", schedule_address: "Rua das Flores, 100",
    animal_name: "Rex", species: "Cão", city: "Município",
  };
}
