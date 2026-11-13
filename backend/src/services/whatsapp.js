import { pool } from "../db/index.js";
import { DeliveryStatus, DeliveryCode } from "../../../shared/notification-contract.js";
import { deliveryFailure } from "./notifications/delivery-result.js";

const WHATSAPP_CONFIG_KEY = "whatsapp";
const DEFAULT_CONFIRMATION_VARIABLES = ["tutor_name", "schedule_date"];

export function toE164Brazil(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : "";
}

function resolveTemplateVariable(key, request = {}) {
  const workflow = request.workflow_data || {};
  const values = {
    tutor_name: request.tutor_name || "Solicitante",
    protocol: request.protocol || "-",
    schedule_date: request.schedule_date || "data a confirmar",
    schedule_time: workflow.scheduleSlotTime || workflow.scheduleTime || request.schedule_time || "hora a confirmar",
    schedule_location_name: request.schedule_location_name || "local a confirmar",
    schedule_address: request.schedule_address || "endereço a confirmar",
    schedule_address_url: request.schedule_address_url || "link indisponível",
    animal_name: request.animal_name || "animal",
    species: request.species || "espécie não informada",
    city: request.city || request.schedule_municipality || "município não informado",
    notification_message: request.notification_message || "Há uma atualização na solicitação.",
  };
  // Never resolve arbitrary request fields, CPF, contacts or the legacy validation key.
  return Object.hasOwn(values, key) ? String(values[key]) : "-";
}

export async function getMunicipalityWhatsappConfig(municipalityId) {
  if (!municipalityId) return {};
  const { rows } = await pool.query(
    "SELECT value FROM config WHERE key=$1 AND municipality_id=$2",
    [WHATSAPP_CONFIG_KEY, municipalityId],
  );
  const value = rows[0]?.value;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function getRuntimeConfig(config = {}) {
  return {
    active: config.active === true,
    provider: config.provider || "cloud_api",
    mode: config.mode || "template",
    accessToken: config.accessToken || process.env.WHATSAPP_TOKEN || "",
    phoneNumberId: config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    templateName: config.confirmationTemplate || process.env.WHATSAPP_TEMPLATE_CONFIRMATION || "confirmacao_agenda_castracao",
    languageCode: config.languageCode || process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR",
    templateVariables: Array.isArray(config.templateVariables) && config.templateVariables.length ? config.templateVariables : DEFAULT_CONFIRMATION_VARIABLES,
  };
}

export async function sendWhatsappTemplateComponents(config, phone, components, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const to = toE164Brazil(phone);
  if (!to) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.INVALID_RECIPIENT);
  if (!config.accessToken || !config.phoneNumberId || !config.templateName) {
    return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
  }
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.languageCode || "pt_BR" },
      components,
    },
  };
  try {
    const response = await fetchImpl(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return deliveryFailure(DeliveryStatus.FAILED, response.status === 429 ? DeliveryCode.RATE_LIMITED : DeliveryCode.PROVIDER_REJECTED);
    return { status: DeliveryStatus.SENT };
  } catch (error) {
    return deliveryFailure(DeliveryStatus.FAILED, ["AbortError", "TimeoutError"].includes(error?.name) ? DeliveryCode.TIMEOUT : DeliveryCode.TRANSPORT_FAILED);
  }
}

export async function sendCloudApiTemplate(config, request, options) {
  const variables = (Array.isArray(config.templateVariables) ? config.templateVariables : DEFAULT_CONFIRMATION_VARIABLES)
    .map((key) => resolveTemplateVariable(key, request));
  return sendWhatsappTemplateComponents(config, request.phone,
    [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }], options);
}
