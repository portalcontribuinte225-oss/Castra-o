import { WhatsappTemplateField } from "../../../../shared/whatsapp-templates-contract.js";
import { resolveNoticeField } from "./notification-message.js";

const MAX_PARAMETER_LENGTH = 1024;
const EMPTY_PARAMETER = "não informado";

// The Cloud API rejects line breaks, tabs and long runs of spaces inside body parameters.
function parameterText(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, MAX_PARAMETER_LENGTH) || EMPTY_PARAMETER;
}

// `fields` is the field of each numbered variable, as the template was configured or in the use's own order: parameter n receives fields[n - 1].
export function buildBodyComponents(fields, request) {
  const parameters = fields.map((item) => ({ type: "text", text: parameterText(resolveNoticeField(item, request)) }));
  return parameters.length ? [{ type: "body", parameters }] : [];
}

// What each field shows in the preview of a template being configured, from the same example request the test send uses.
export function previewFieldValues() {
  const request = previewRequest();
  return Object.fromEntries(Object.values(WhatsappTemplateField).map((field) => [field, resolveNoticeField(field, request)]));
}

export function previewRequest() {
  return {
    tutor_name: "Maria Silva", protocol: "123/2026", schedule_date: "2026-11-20", schedule_time: "09:00",
    schedule_location_name: "Unidade Veterinária Municipal", schedule_address: "Rua das Flores, 100",
    animal_name: "Rex", species: "Cão", city: "Município",
  };
}
