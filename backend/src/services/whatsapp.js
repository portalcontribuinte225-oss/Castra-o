import { pool } from "../db/index.js";
import { checkAndConsumeQuota } from "./whatsappQuota.js";

const WHATSAPP_CONFIG_KEY = "whatsapp";
const DEFAULT_CONFIRMATION_VARIABLES = [
  "tutor_name",
  "schedule_date",
];

function parseJsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function onlyDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function toE164Brazil(value = "") {
  const digits = onlyDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function getScheduleAddress(request = {}) {
  return [
    request.schedule_location_name,
    request.schedule_address,
    request.schedule_municipality || request.city,
  ].filter(Boolean).join(" - ");
}

function resolveConfirmationVariable(key, request = {}) {
  const wf = request.workflow_data && typeof request.workflow_data === "object" ? request.workflow_data : {};
  const values = {
    tutor_name: request.tutor_name || "Tutor",
    protocol: request.protocol || "-",
    schedule_date: request.schedule_date || "data a confirmar",
    schedule_time: wf.scheduleTime || request.schedule_time || "hora a confirmar",
    schedule_location_name: request.schedule_location_name || "local a confirmar",
    schedule_address: request.schedule_address || getScheduleAddress(request) || "endereco a confirmar",
    schedule_address_url: request.schedule_address_url || "link indisponivel",
    animal_name: request.pet_name || request.animal_name || "animal",
    species: request.species || request.pet_species || "especie nao informada",
    city: request.city || request.schedule_municipality || "municipio nao informado",
    phone: request.phone || "-",
  };
  return values[key] || request[key] || "-";
}

function buildConfirmationVariables(config = {}, request = {}) {
  const configuredVariables = Array.isArray(config.templateVariables)
    ? config.templateVariables.map((variable) => String(variable || "").trim()).filter(Boolean)
    : [];
  const variables = configuredVariables.length ? configuredVariables : DEFAULT_CONFIRMATION_VARIABLES;
  return variables.map((variable) => resolveConfirmationVariable(variable, request));
}

export async function getMunicipalityWhatsappConfig(municipalityId) {
  if (!municipalityId) return {};
  const { rows } = await pool.query(
    "SELECT value FROM config WHERE key=$1 AND municipality_id=$2",
    [WHATSAPP_CONFIG_KEY, municipalityId],
  );
  return parseJsonObject(rows[0]?.value);
}

export function getRuntimeConfig(config = {}) {
  return {
    active: Boolean(config.active),
    provider: config.provider || "cloud_api",
    mode: config.mode || "template",
    accessToken: config.accessToken || process.env.WHATSAPP_TOKEN || "",
    phoneNumberId: config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    templateName: config.confirmationTemplate || process.env.WHATSAPP_TEMPLATE_CONFIRMATION || "confirmacao_agenda_castracao",
    languageCode: config.languageCode || process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR",
    templateVariables: Array.isArray(config.templateVariables) ? config.templateVariables : DEFAULT_CONFIRMATION_VARIABLES,
  };
}

export async function sendCloudApiTemplate(config, request) {
  const to = toE164Brazil(request.phone);
  if (!to) return { status: "skipped", reason: "telefone ausente" };
  const variables = buildConfirmationVariables(config, request);
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.languageCode },
      components: [
        {
          type: "body",
          parameters: variables.map((text) => ({ type: "text", text: String(text || "-") })),
        },
      ],
    },
  };

  const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[WhatsApp] Falha na API:", JSON.stringify({ status: response.status, error: payload?.error }));
    return {
      status: "failed",
      reason: payload?.error?.message || response.statusText,
      providerResponse: payload,
    };
  }
  return {
    status: "sent",
    providerMessageId: payload?.messages?.[0]?.id || "",
    providerResponse: payload,
  };
}

export async function notifyScheduleConfirmation(request = {}) {
  const rawConfig = await getMunicipalityWhatsappConfig(request.municipality_id);
  const config = getRuntimeConfig(rawConfig);

  // Bloqueio explícito: só respeita active===false quando foi salvo intencionalmente
  if (rawConfig.active === false) {
    return { status: "skipped", reason: "WhatsApp desativado para o município" };
  }

  if (config.provider !== "cloud_api") {
    return { status: "skipped", reason: `Provedor ${config.provider} ainda não implementado` };
  }
  if (!config.accessToken || !config.phoneNumberId || !config.templateName) {
    return { status: "skipped", reason: "Credenciais ou template do WhatsApp incompletos" };
  }

  // Quota valida o contrato e o limite mensal — se aprovada, ativa automaticamente
  const quota = await checkAndConsumeQuota(request.municipality_id);
  if (!quota.allowed) {
    return { status: "skipped", reason: quota.reason };
  }
  return sendCloudApiTemplate(config, request);
}

export function whatsappHistoryNote(result = {}, context = "confirmation") {
  const label = context === "reschedule" ? "reagendamento" : "confirmacao de agenda";
  if (result.status === "sent") return `WhatsApp: ${label} enviado${result.providerMessageId ? ` (${result.providerMessageId})` : ""}.`;
  if (result.status === "failed") return `WhatsApp: falha ao enviar ${label}. ${result.reason || ""}`.trim();
  return `WhatsApp: ${label} nao enviado. ${result.reason || "Configuracao ausente."}`;
}
