import { NotificationChannel } from "../../../../shared/notification-contract.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { isValidCpf, normalizeCpf } from "../../utils.js";
import { normalizeAuthEmail, normalizeAuthPhone } from "../auth/auth-contacts.js";
import { authError, authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

const CODE_CHANNELS = new Set(Object.values(NotificationChannel));

export function readAccessCpf(value) {
  const cpf = typeof value === "string" && value.length <= 20 ? normalizeCpf(value) : "";
  return isValidCpf(cpf) ? cpf : "";
}

// The person types only the CPF and chooses the channel of the code: e-mail, WhatsApp or SMS.
export function readAccessStartInput(body) {
  const input = body && typeof body === "object" ? body : {};
  if (!isUuid(input.municipalityId)) throw authError(400, "Selecione um município válido.");
  const cpf = readAccessCpf(input.cpf);
  if (!cpf) throw authError(400, "Informe um CPF válido.");
  if (!CODE_CHANNELS.has(input.channel)) throw authError(400, "Escolha receber o código por e-mail, WhatsApp ou SMS.");
  return { municipalityId: input.municipalityId, cpf, channel: input.channel };
}

// The code goes by the channel the person chose, but what is kept with it is the kind of contact that received it: an e-mail, or a
// phone (kept as WhatsApp whether the code went by WhatsApp or by SMS). Only that contact is compared and confirmed afterwards.
export function contactChannel(channel) {
  return channel === NotificationChannel.EMAIL ? NotificationChannel.EMAIL : NotificationChannel.WHATSAPP;
}

// The code only goes to a contact the request already has: the e-mail of its tutor, or the mobile phone for WhatsApp and SMS.
export function accessDestination(request, channel) {
  if (!request) return "";
  return channel === NotificationChannel.EMAIL ? normalizeAuthEmail(request.tutor_email) : normalizeAuthPhone(request.phone);
}

// Digests are compared in constant time, so a near match leaks nothing through timing.
export function sameCpf(stored, given) {
  const cpf = normalizeCpf(stored);
  return Boolean(cpf && given) && safeDigestEqual(accessCpfDigest(cpf), accessCpfDigest(given));
}

export const accessCpfDigest = (cpf) => authenticatedDigest("request-access-cpf", cpf);

// The access token stores a digest of the contact that received the code.
export function accessContactDigest(channel, value) {
  return value ? authenticatedDigest("request-access-contact", channel, value) : "";
}

export function matchesAccess(request, { channel, contact, cpfDigest }) {
  const cpf = readAccessCpf(request?.cpf);
  const current = accessContactDigest(channel, accessDestination(request, channel));
  return Boolean(cpf && current) && safeDigestEqual(accessCpfDigest(cpf), cpfDigest) && safeDigestEqual(current, contact);
}
