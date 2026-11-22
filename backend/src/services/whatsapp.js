import { pool } from "../db/index.js";
import { DeliveryStatus, DeliveryCode } from "../../../shared/notification-contract.js";
import { deliveryFailure } from "./notifications/delivery-result.js";
import { readWhatsappToken } from "./whatsapp-credentials.js";

const WHATSAPP_CONFIG_KEY = "whatsapp";
export const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

// Meta error codes that say the template itself cannot be sent; the value is the status cached for it.
const TEMPLATE_ERROR_STATUS = Object.freeze({ 132001: "NOT_FOUND", 132015: "PAUSED", 132016: "DISABLED", 132000: "", 132012: "" });

export function toE164Brazil(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : "";
}

export async function getMunicipalityWhatsappConfig(municipalityId, database = pool) {
  if (!municipalityId) return {};
  const { rows } = await database.query(
    "SELECT value FROM config WHERE key=$1 AND municipality_id=$2",
    [WHATSAPP_CONFIG_KEY, municipalityId],
  );
  const value = rows[0]?.value;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// The only place that hands out a token: the one in the variable the municipality chose, read from the environment.
export function getRuntimeConfig(config = {}, env = process.env) {
  return {
    active: config.active === true,
    provider: config.provider || "cloud_api",
    accessToken: readWhatsappToken(config.tokenVariable, env).token,
    phoneNumberId: String(config.phoneNumberId || ""),
    wabaId: String(config.wabaId || ""),
  };
}

async function readTemplateErrorCode(response) {
  try {
    const body = await response.json();
    return Number(body?.error?.code);
  } catch {
    return NaN;
  }
}

export async function sendWhatsappTemplateComponents(config, phone, components, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const to = toE164Brazil(phone);
  if (!to) return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.INVALID_RECIPIENT);
  if (!config.accessToken || !config.phoneNumberId || !config.templateName || !config.languageCode) {
    return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
  }
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.languageCode },
      components,
    },
  };
  try {
    const response = await fetchImpl(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const errorCode = await readTemplateErrorCode(response);
      if (Object.hasOwn(TEMPLATE_ERROR_STATUS, errorCode)) {
        return { ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.TEMPLATE_UNAVAILABLE), templateStatus: TEMPLATE_ERROR_STATUS[errorCode] };
      }
      return deliveryFailure(DeliveryStatus.FAILED, response.status === 429 ? DeliveryCode.RATE_LIMITED : DeliveryCode.PROVIDER_REJECTED);
    }
    return { status: DeliveryStatus.SENT };
  } catch (error) {
    return deliveryFailure(DeliveryStatus.FAILED, ["AbortError", "TimeoutError"].includes(error?.name) ? DeliveryCode.TIMEOUT : DeliveryCode.TRANSPORT_FAILED);
  }
}
