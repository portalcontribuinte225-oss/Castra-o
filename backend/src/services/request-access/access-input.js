import { ContactKind } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { normalizeTrackingProtocol } from "../../../../shared/request-tracking-contract.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { isValidCpf, normalizeCpf } from "../../utils.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "../auth/auth-contacts.js";
import { authError, authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

// The kind of contact the person chose decides the channel of the code: an e-mail by e-mail, the mobile phone through the phone
// chain (WhatsApp, then SMS). The channel kept with the code only tells an e-mail from a phone.
const channels = Object.freeze({ [ContactKind.EMAIL]: NotificationChannel.EMAIL, [ContactKind.PHONE]: NotificationChannel.WHATSAPP });

export function readAccessCpf(value) {
  const cpf = typeof value === "string" && value.length <= 20 ? normalizeCpf(value) : "";
  return isValidCpf(cpf) ? cpf : "";
}

export function readAccessStartInput(body) {
  const input = body && typeof body === "object" ? body : {};
  if (!isUuid(input.municipalityId)) throw authError(400, "Selecione um município válido.");
  const protocol = normalizeTrackingProtocol(input.protocol);
  if (!protocol) throw authError(400, "Informe o protocolo no formato 000123/2026.");
  const cpf = readAccessCpf(input.cpf);
  if (!cpf) throw authError(400, "Informe um CPF válido.");
  const channel = Object.hasOwn(channels, input.channel) ? channels[input.channel] : "";
  if (!channel) throw authError(400, "Escolha receber o código por e-mail ou pelo celular.");
  return { municipalityId: input.municipalityId, protocol, cpf, channel };
}

// The code only goes to a contact the request already has: the e-mail or the mobile phone of its tutor.
export function accessDestination(request, channel) {
  if (!request) return "";
  return channel === NotificationChannel.EMAIL ? normalizeAuthEmail(request.tutor_email) : normalizeAuthPhone(request.phone);
}

// Digests are compared in constant time, so a near match leaks nothing through timing.
export function sameCpf(stored, given) {
  const cpf = normalizeCpf(stored);
  return Boolean(cpf && given) && safeDigestEqual(authenticatedDigest("request-access-cpf", cpf), authenticatedDigest("request-access-cpf", given));
}

// What the access token remembers of the contact that received the code: a digest, never the contact.
export function accessContactDigest(channel, value) {
  return value ? authenticatedDigest("request-access-contact", channel, value) : "";
}
