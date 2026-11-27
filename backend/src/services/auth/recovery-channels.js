import { AuthPurpose } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { recoveryContacts } from "./auth-contacts.js";
import { maskEmail, maskPhone } from "./auth-security.js";
import { listCodeChannels } from "./code-channels.js";
import { recoveryOptionId } from "./recovery-token.js";

// Read-only availability: never consumes quota, creates a challenge or calls a provider. Only the channels the account has a
// contact for are offered.
export async function getRecoveryOptions(user, token, overrides = {}) {
  const contacts = recoveryContacts(user);
  const available = await listCodeChannels(user.municipality_id || null, AuthPurpose.PASSWORD_RESET,
    { email: Boolean(contacts.email), phone: Boolean(contacts.whatsapp) }, overrides);
  return available.map((channel) => ({ id: recoveryOptionId(token, channel, contacts[channel]), channel,
    maskedDestination: channel === NotificationChannel.EMAIL ? maskEmail(contacts[channel]) : maskPhone(contacts[channel]) }));
}
