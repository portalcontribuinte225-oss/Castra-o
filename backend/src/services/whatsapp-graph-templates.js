import { DeliveryCode } from "../../../shared/notification-contract.js";
import { WHATSAPP_MAX_VARIABLES } from "../../../shared/whatsapp-binding-contract.js";
import { GRAPH_API_BASE } from "./whatsapp.js";

const MAX_PAGES = 10;
const PAGE_SIZE = 100;
const MAX_TEMPLATES = 500;
const MAX_BODY_LENGTH = 1100;
const SUPPORTED_BUTTON_TYPES = new Set(["QUICK_REPLY", "PHONE_NUMBER", "URL"]);
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
    const query = new URLSearchParams({ fields: "name,language,status,category,components", limit: String(PAGE_SIZE) });
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

function unsupportedReason(components, bodyText, positions) {
  if (!bodyText) return "Template sem corpo de texto.";
  if (components.some((component) => !SUPPORTED_COMPONENT_TYPES.has(component?.type))) return "Template com componente não suportado.";
  if (/\{\{\s*[A-Za-z_]\w*\s*\}\}/.test(bodyText)) return "Parâmetros nomeados não são suportados.";
  const highest = positions.length ? Math.max(...positions) : 0;
  if (new Set(positions).size !== highest || highest > WHATSAPP_MAX_VARIABLES) return "Variáveis do corpo fora de sequência.";
  const header = components.find((component) => component?.type === "HEADER");
  if (header && (header.format !== "TEXT" || /\{\{/.test(header.text || ""))) return "Cabeçalho com variável ou mídia não é suportado.";
  const buttons = components.find((component) => component?.type === "BUTTONS")?.buttons;
  if (Array.isArray(buttons) && buttons.some((button) => !SUPPORTED_BUTTON_TYPES.has(button?.type) || /\{\{/.test(button?.url || ""))) {
    return "Botão com variável ou de código não é suportado.";
  }
  return "";
}

// Turns one Graph template into the cached catalog entry (null when it has no usable identity).
export function describeGraphTemplate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = text(raw.name, 512);
  const language = text(raw.language, 20);
  if (!name || !language) return null;
  const components = Array.isArray(raw.components) ? raw.components : [];
  const bodyText = text(components.find((component) => component?.type === "BODY")?.text, MAX_BODY_LENGTH);
  const positions = [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
  const reason = unsupportedReason(components, bodyText, positions);
  return {
    name,
    language,
    status: text(raw.status, 40).toUpperCase(),
    category: text(raw.category, 40).toUpperCase(),
    bodyText,
    variableCount: reason ? 0 : positions.length,
    supported: !reason,
    unsupportedReason: reason,
  };
}
