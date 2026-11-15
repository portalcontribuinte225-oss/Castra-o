import { markCatalogTemplateStatus } from "./whatsapp-catalog.js";
import { sendWhatsappTemplateComponents } from "./whatsapp.js";

// Sends a template that resolveActiveTemplate approved. When the provider says the template is paused, disabled or
// missing, the cached status is updated so the next sends are blocked until a new synchronization.
export async function sendResolvedTemplate(
  { municipalityId, runtime, template, phone, components },
  { sendWhatsapp = sendWhatsappTemplateComponents, markTemplateStatus = markCatalogTemplateStatus } = {},
) {
  const transport = await sendWhatsapp({ ...runtime, templateName: template.name, languageCode: template.language }, phone, components);
  if (transport?.templateStatus) {
    try {
      await markTemplateStatus(municipalityId, template.name, template.language, transport.templateStatus);
    } catch {
      // The send result is already known; the next synchronization corrects the cache.
    }
  }
  return transport;
}
