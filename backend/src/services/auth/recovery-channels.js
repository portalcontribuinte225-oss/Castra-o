import { pool } from "../../db/index.js";
import { AuthPurpose, normalizeAuthDeliveryConfig } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../whatsapp.js";
import { isWhatsappQuotaAvailable } from "../whatsappQuota.js";
import { getSmsAvailability } from "../sms-integration-settings.js";
import { loadAuthDeliveryConfig } from "./auth-message-delivery.js";
import { recoveryContacts } from "./auth-contacts.js";
import { maskEmail, maskPhone } from "./auth-security.js";
import { recoveryOptionId } from "./recovery-token.js";

// Read-only availability: never consumes quota, creates a challenge or calls a provider.
export async function getRecoveryOptions(user, token, overrides = {}) {
  const database = overrides.database || pool;
  const deps = { env: process.env, loadConfig: (id) => loadAuthDeliveryConfig(id, database),
    loadWhatsapp: (id) => getMunicipalityWhatsappConfig(id, database), quotaAvailable: (id) => isWhatsappQuotaAvailable(id, database),
    smsAvailable: (id) => getSmsAvailability(id, { database }), ...overrides };
  const contacts = recoveryContacts(user);
  const municipalityId = user.municipality_id;
  const config = normalizeAuthDeliveryConfig(municipalityId ? await deps.loadConfig(municipalityId) : undefined);
  const available = [];
  const emailTemplate = config.emailTemplates[AuthPurpose.PASSWORD_RESET] || deps.env.EMAILJS_TEMPLATE_ID;
  if (contacts.email && emailTemplate && deps.env.EMAILJS_SERVICE_ID && deps.env.EMAILJS_PUBLIC_KEY) available.push(NotificationChannel.EMAIL);
  if (municipalityId && contacts.whatsapp) {
    const raw = await deps.loadWhatsapp(municipalityId);
    const runtime = getRuntimeConfig(raw);
    if (raw.active === true && runtime.provider === "cloud_api" && runtime.accessToken && runtime.phoneNumberId
      && config.whatsappTemplates[AuthPurpose.PASSWORD_RESET] && await deps.quotaAvailable(municipalityId)) available.push(NotificationChannel.WHATSAPP);
    if ((await deps.smsAvailable(municipalityId)).available) available.push(NotificationChannel.SMS);
  }
  return available.map((channel) => ({ id: recoveryOptionId(token, channel, contacts[channel]), channel,
    maskedDestination: channel === NotificationChannel.EMAIL ? maskEmail(contacts[channel]) : maskPhone(contacts[channel]) }));
}
