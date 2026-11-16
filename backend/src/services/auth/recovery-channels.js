import { pool } from "../../db/index.js";
import { AuthPurpose } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../whatsapp.js";
import { resolveActiveTemplate } from "../whatsapp-active-templates.js";
import { resolveEmailTemplate } from "../email-templates.js";
import { isWhatsappQuotaAvailable } from "../whatsappQuota.js";
import { getSmsAvailability } from "../sms-integration-settings.js";
import { recoveryContacts } from "./auth-contacts.js";
import { maskEmail, maskPhone } from "./auth-security.js";
import { recoveryOptionId } from "./recovery-token.js";

// Read-only availability: never consumes quota, creates a challenge or calls a provider.
export async function getRecoveryOptions(user, token, overrides = {}) {
  const database = overrides.database || pool;
  const deps = { loadWhatsapp: (id) => getMunicipalityWhatsappConfig(id, database), quotaAvailable: (id) => isWhatsappQuotaAvailable(id, database),
    resolveTemplate: (id, purpose) => resolveActiveTemplate(id, purpose, database),
    resolveEmail: (id) => resolveEmailTemplate({ municipalityId: id, use: AuthPurpose.PASSWORD_RESET, database }),
    smsAvailable: (id) => getSmsAvailability(id, { database }), ...overrides };
  const contacts = recoveryContacts(user);
  const municipalityId = user.municipality_id;
  const available = [];
  // Staff without a municipality recover by e-mail through the platform template, which has no switch.
  if (contacts.email && (await deps.resolveEmail(municipalityId || null)).ok) available.push(NotificationChannel.EMAIL);
  if (municipalityId && contacts.whatsapp) {
    const raw = await deps.loadWhatsapp(municipalityId);
    const runtime = getRuntimeConfig(raw);
    if (raw.active === true && runtime.provider === "cloud_api" && runtime.accessToken && runtime.phoneNumberId
      && (await deps.resolveTemplate(municipalityId, AuthPurpose.PASSWORD_RESET)).ok && await deps.quotaAvailable(municipalityId)) available.push(NotificationChannel.WHATSAPP);
    if ((await deps.smsAvailable(municipalityId)).available) available.push(NotificationChannel.SMS);
  }
  return available.map((channel) => ({ id: recoveryOptionId(token, channel, contacts[channel]), channel,
    maskedDestination: channel === NotificationChannel.EMAIL ? maskEmail(contacts[channel]) : maskPhone(contacts[channel]) }));
}
