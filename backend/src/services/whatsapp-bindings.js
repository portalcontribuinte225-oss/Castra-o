import {
  WHATSAPP_BINDINGS_CONFIG_KEY, normalizeWhatsappBinding, normalizeWhatsappBindings, validateWhatsappBindingInput,
} from "../../../shared/whatsapp-binding-contract.js";
import { NotificationEvent } from "../../../shared/notification-contract.js";
import { readWhatsappConfigValue, updateWhatsappConfigValue } from "../repositories/whatsapp-templates.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { findCatalogTemplate, loadWhatsappCatalog } from "./whatsapp-catalog.js";

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function loadWhatsappBindings(municipalityId, database) {
  return normalizeWhatsappBindings(await readWhatsappConfigValue(WHATSAPP_BINDINGS_CONFIG_KEY, municipalityId, database));
}

// The binding of one event and its catalog entry (null when the catalog was never synchronized).
export async function loadEventBinding(municipalityId, event, database) {
  const [bindings, catalog] = await Promise.all([
    loadWhatsappBindings(municipalityId, database), loadWhatsappCatalog(municipalityId, database),
  ]);
  const binding = bindings[event] || null;
  return { binding, template: binding ? findCatalogTemplate(catalog, binding.templateName, binding.languageCode) : null };
}

async function saveBindings(municipalityId, event, binding, audit, database) {
  const next = await updateWhatsappConfigValue(
    WHATSAPP_BINDINGS_CONFIG_KEY, municipalityId,
    (current) => ({ bindings: { ...normalizeWhatsappBindings(current), [event]: binding } }),
    {
      database,
      audit: audit && {
        ...audit, action: AUDIT_ACTIONS.WHATSAPP_BINDING_UPDATE, entityType: "config", entityId: WHATSAPP_BINDINGS_CONFIG_KEY,
        changes: { event, templateName: binding?.templateName || null },
      },
    },
  );
  return normalizeWhatsappBindings(next);
}

export async function saveWhatsappBinding({ municipalityId, event, input, audit, database }) {
  const catalog = await loadWhatsappCatalog(municipalityId, database);
  const template = findCatalogTemplate(catalog, input?.templateName, input?.languageCode);
  const error = validateWhatsappBindingInput(event, input, template);
  if (error) throw badRequest(error);
  return saveBindings(municipalityId, event, normalizeWhatsappBinding(input), audit, database);
}

export async function removeWhatsappBinding({ municipalityId, event, audit, database }) {
  if (!Object.values(NotificationEvent).includes(event)) throw badRequest("Evento de notificação inválido.");
  return saveBindings(municipalityId, event, null, audit, database);
}
