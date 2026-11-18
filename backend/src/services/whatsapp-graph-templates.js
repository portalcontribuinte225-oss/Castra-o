import { DeliveryCode } from "../../../shared/notification-contract.js";
import { WHATSAPP_MAX_BODY_LENGTH, WHATSAPP_MAX_VARIABLES } from "../../../shared/whatsapp-templates-contract.js";
import { GRAPH_API_BASE } from "./whatsapp.js";

const MAX_PAGES = 10;
const PAGE_SIZE = 100;
const MAX_TEMPLATES = 500;
const SUPPORTED_COMPONENT_TYPES = new Set(["HEADER", "BODY", "FOOTER", "BUTTONS"]);

const syncErrorMessages = Object.freeze({
  [DeliveryCode.INVALID_CREDENTIALS]: "A Meta recusou o token. Confira se ele é válido e tem permissão para gerenciar o WhatsApp Business.",
  [DeliveryCode.RATE_LIMITED]: "A Meta limitou as consultas. Tente novamente em alguns minutos.",
  [DeliveryCode.PROVIDER_REJECTED]: "A Meta recusou a consulta. Confira o ID da conta do WhatsApp Business e as permissões do token.",
  [DeliveryCode.INVALID_RESPONSE]: "A resposta da Meta não pôde ser interpretada.",
  [DeliveryCode.TIMEOUT]: "A Meta demorou demais para responder. Tente novamente.",
  [DeliveryCode.TRANSPORT_FAILED]: "Não foi possível conectar à Meta. Tente novamente.",
});

function syncError(code) {
  return Object.assign(new Error(syncErrorMessages[code]), { status: 502, code });
}

function failureCode(response) {
  if (response.status === 401 || response.status === 403) return DeliveryCode.INVALID_CREDENTIALS;
  return response.status === 429 ? DeliveryCode.RATE_LIMITED : DeliveryCode.PROVIDER_REJECTED;
}

// Follows the cursor instead of the `next` URL, which carries credentials and points to a host we do not control.
export async function fetchGraphTemplates({ accessToken, wabaId }, { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const templates = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ fields: "name,language,status,category,components,parameter_format", limit: String(PAGE_SIZE) });
    if (after) query.set("after", after);
    let response;
    try {
      response = await fetchImpl(`${GRAPH_API_BASE}/${encodeURIComponent(wabaId)}/message_templates?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw syncError(["AbortError", "TimeoutError"].includes(error?.name) ? DeliveryCode.TIMEOUT : DeliveryCode.TRANSPORT_FAILED);
    }
    if (!response.ok) throw syncError(failureCode(response));
    const body = await response.json().catch(() => null);
    if (!body || !Array.isArray(body.data)) throw syncError(DeliveryCode.INVALID_RESPONSE);
    templates.push(...body.data);
    after = body.paging?.next ? String(body.paging?.cursors?.after || "") : "";
    if (!after || templates.length >= MAX_TEMPLATES) break;
  }
  return templates.slice(0, MAX_TEMPLATES);
}

function text(value, max) {
  return typeof value === "string" && value.length <= max ? value : "";
}

function headerKind(header) {
  if (!header) return "NONE";
  if (header.format !== "TEXT") return "MEDIA";
  return /\{\{/.test(header.text || "") ? "TEXT_VARIABLE" : "TEXT";
}

function buttonKind(button) {
  switch (button?.type) {
    case "QUICK_REPLY": return "QUICK_REPLY";
    case "PHONE_NUMBER": return "PHONE_NUMBER";
    case "URL": return /\{\{/.test(button.url || "") ? "URL_VARIABLE" : "URL";
    case "OTP": return button.otp_type === "COPY_CODE" ? "OTP_COPY_CODE" : "OTP_OTHER";
    default: return "OTHER";
  }
}

// Turns one Graph template into the cached catalog entry: its body text, shown when it is configured, and structural facts.
// Whether the system can use it (and for what) is decided when the catalog is read, by the shared contract.
export function describeGraphTemplate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = text(raw.name, 512);
  const language = text(raw.language, 20);
  if (!name || !language) return null;
  const components = Array.isArray(raw.components) ? raw.components : [];
  const body = components.find((component) => component?.type === "BODY");
  const category = text(raw.category, 40).toUpperCase();
  const bodyText = text(body?.text, WHATSAPP_MAX_BODY_LENGTH);
  const named = /\{\{\s*[A-Za-z_]\w*\s*\}\}/.test(bodyText);
  const indexes = [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
  const highest = indexes.length ? Math.max(...indexes) : 0;
  // Authentication templates may come without text: Meta composes it around the single code variable.
  const codeOnly = category === "AUTHENTICATION" && Boolean(body) && bodyText === "";
  const buttons = components.find((component) => component?.type === "BUTTONS")?.buttons;
  return {
    name,
    language,
    status: text(raw.status, 40).toUpperCase(),
    category,
    parameterFormat: named || raw.parameter_format === "NAMED" ? "NAMED" : "POSITIONAL",
    bodyText,
    hasBody: bodyText !== "" || codeOnly,
    bodyVariables: codeOnly ? 1 : highest,
    bodySequential: codeOnly || (new Set(indexes).size === highest && highest <= WHATSAPP_MAX_VARIABLES),
    header: headerKind(components.find((component) => component?.type === "HEADER")),
    buttons: Array.isArray(buttons) ? buttons.map(buttonKind) : [],
    extraComponents: components.some((component) => !SUPPORTED_COMPONENT_TYPES.has(component?.type)),
  };
}
