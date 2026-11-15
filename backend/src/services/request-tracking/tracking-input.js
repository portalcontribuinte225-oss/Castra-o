import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { normalizeTrackingProtocol } from "../../../../shared/request-tracking-contract.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "../auth/auth-contacts.js";
import { authError, authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

// The kind of contact decides the channel: an e-mail is answered by e-mail, a phone by WhatsApp.
function readContact(value) {
  if (typeof value !== "string" || value.length > 254) return null;
  if (value.includes("@")) {
    const email = normalizeAuthEmail(value);
    return email ? { channel: NotificationChannel.EMAIL, value: email } : null;
  }
  const phone = normalizeAuthPhone(value);
  return phone ? { channel: NotificationChannel.WHATSAPP, value: phone } : null;
}

export function readStartInput(body) {
  const input = body && typeof body === "object" ? body : {};
  if (!isUuid(input.municipalityId)) throw authError(400, "Selecione um município válido.");
  const protocol = normalizeTrackingProtocol(input.protocol);
  if (!protocol) throw authError(400, "Informe o protocolo no formato 000123/2026.");
  const contact = readContact(input.contact);
  if (!contact) throw authError(400, "Informe o e-mail ou o telefone cadastrado para o acompanhamento.");
  return { municipalityId: input.municipalityId, protocol, ...contact };
}

// Only a request whose citizen chose to be followed can be opened, and only through the contact given back then.
export function followUpDestination(followUp, channel) {
  if (!followUp || followUp.enabled !== true) return "";
  return channel === NotificationChannel.EMAIL ? normalizeAuthEmail(followUp.email) : normalizeAuthPhone(followUp.phone);
}

// Digests are compared in constant time, so a near match leaks nothing through timing.
export function sameContact(stored, given) {
  return Boolean(stored && given)
    && safeDigestEqual(authenticatedDigest("tracking-contact", stored), authenticatedDigest("tracking-contact", given));
}
