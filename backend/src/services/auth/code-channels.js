import { pool } from "../../db/index.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../whatsapp.js";
import { isWhatsappReady } from "../whatsapp-credentials.js";
import { resolveActiveTemplate } from "../whatsapp-active-templates.js";
import { resolveEmailTemplate } from "../email-templates.js";
import { isQuotaAvailable } from "../message-quota.js";
import { isSmsUseAvailable } from "../sms-integration-settings.js";

// The channels that can carry a code of this purpose in the municipality, in the order e-mail, WhatsApp, SMS. Read-only: never
// consumes quota, creates a challenge or calls a provider. `email` and `phone` say which kinds of contact can be reached, so a
// kind with no contact is not even looked up. Without a municipality (platform staff) only the e-mail of the platform remains,
// which has no switch and no contract.
export async function listCodeChannels(municipalityId, purpose, { email = true, phone = true } = {}, overrides = {}) {
  const database = overrides.database || pool;
  const deps = { loadWhatsapp: (id) => getMunicipalityWhatsappConfig(id, database), quotaAvailable: (channel, id) => isQuotaAvailable(channel, id, { database }),
    resolveTemplate: (id, use) => resolveActiveTemplate(id, use, database),
    resolveEmail: (id, use) => resolveEmailTemplate({ municipalityId: id, use, database }),
    smsAvailable: (id, use) => isSmsUseAvailable({ municipalityId: id, use, database }), ...overrides };
  const channels = [];
  if (email && (await deps.resolveEmail(municipalityId || null, purpose)).ok
    && (!municipalityId || await deps.quotaAvailable(NotificationChannel.EMAIL, municipalityId))) channels.push(NotificationChannel.EMAIL);
  if (municipalityId && phone) {
    if (isWhatsappReady(getRuntimeConfig(await deps.loadWhatsapp(municipalityId)))
      && (await deps.resolveTemplate(municipalityId, purpose)).ok && await deps.quotaAvailable(NotificationChannel.WHATSAPP, municipalityId)) channels.push(NotificationChannel.WHATSAPP);
    if ((await deps.smsAvailable(municipalityId, purpose)).available) channels.push(NotificationChannel.SMS);
  }
  return channels;
}
