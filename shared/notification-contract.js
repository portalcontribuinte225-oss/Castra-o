import { MOBILE_PHONE_MESSAGE, isMobilePhone, onlyPhoneDigits } from "./phone-contract.js";

export const NotificationEvent = Object.freeze({
  SCHEDULE_CONFIRMED: "schedule_confirmed",
  SCHEDULE_CHANGED: "schedule_changed",
  NO_SHOW: "no_show",
  DOCUMENTS_REVIEWED: "documents_reviewed",
  COMPLETED: "completed",
  REQUEST_REJECTED: "request_rejected",
});

// The reason the staff screen stores when the tutor did not come to a scheduled visit; it is what tells a no-show from any other cancellation.
export const NO_SHOW_CANCEL_REASON = "Não compareceu";

// What the staff screen stores when a request is rejected: the cancel reason that tells a rejection from any other cancellation, and the
// reason chosen in the list (`rejectionReason`).
export const REJECTED_CANCEL_REASON = "Indeferido";
export const OTHER_REJECTION_REASON = "Outro";
export const REJECTION_REASONS = Object.freeze([
  "Documentação incompleta",
  "Animal inelegível",
  "Fora da área de atendimento",
  "Solicitação duplicada",
  "Tutor não localizado",
  OTHER_REJECTION_REASON,
]);
const MAX_REJECTION_REASON = 60;

// The reason the tutor is told: the one the staff chose, unless it says nothing ("Outro", or the bare "Indeferido" kept when none was
// given). The staff's internal note is never shared.
export function rejectionReasonText(workflow) {
  const reason = typeof workflow?.rejectionReason === "string" ? workflow.rejectionReason.replace(/\s+/g, " ").trim() : "";
  return reason && reason !== OTHER_REJECTION_REASON && reason !== REJECTED_CANCEL_REASON ? reason.slice(0, MAX_REJECTION_REASON).trim() : "";
}

// What the analysis of the documents ended in: rejected as soon as one document was rejected, approved otherwise.
export const DocumentsOutcome = Object.freeze({ APPROVED: "approved", REJECTED: "rejected" });

export function documentsOutcome(documents) {
  const rejected = (Array.isArray(documents) ? documents : []).some((document) => document?.status === "rejected");
  return rejected ? DocumentsOutcome.REJECTED : DocumentsOutcome.APPROVED;
}

export const NotificationChannel = Object.freeze({ EMAIL: "email", WHATSAPP: "whatsapp", SMS: "sms" });
export const DeliveryStatus = Object.freeze({ SENT: "sent", FAILED: "failed", SKIPPED: "skipped" });
export const DeliveryCode = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  INVALID_CREDENTIALS: "invalid_credentials",
  INSUFFICIENT_BALANCE: "insufficient_balance",
  INVALID_RESPONSE: "invalid_response",
  INVALID_RECIPIENT: "invalid_recipient",
  RATE_LIMITED: "rate_limited",
  PROVIDER_REJECTED: "provider_rejected",
  TIMEOUT: "timeout",
  TRANSPORT_FAILED: "transport_failed",
  PREPARATION_FAILED: "preparation_failed",
  CHANNEL_DISABLED: "channel_disabled",
  QUOTA_UNAVAILABLE: "quota_unavailable",
  TEMPLATE_UNAVAILABLE: "template_unavailable",
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmailAddress = (value) => typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
const isFilled = (value) => value !== undefined && value !== null && value !== "";

// The contacts of a follow-up the municipality can use: the e-mail, and the mobile phone only when it has a phone channel (WhatsApp or SMS).
// A contact that is not usable comes back empty.
export function followUpContacts(value, { phoneEnabled = false } = {}) {
  return {
    email: isEmailAddress(value?.email) ? value.email.trim().toLowerCase() : "",
    phone: phoneEnabled && typeof value?.phone === "string" && value.phone.length <= 30 && isMobilePhone(value.phone) ? onlyPhoneDigits(value.phone) : "",
  };
}

// Accepting the follow-up needs at least one contact that can be reached, and a contact that is given must be valid.
export function validateFollowUp(value, { phoneEnabled = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.enabled !== "boolean") {
    return "Informe se deseja acompanhar a solicitação.";
  }
  if (!value.enabled) return "";
  if (isFilled(value.email) && !isEmailAddress(value.email)) return "Informe um e-mail válido para acompanhar a solicitação.";
  if (phoneEnabled && isFilled(value.phone) && !followUpContacts(value, { phoneEnabled }).phone) return MOBILE_PHONE_MESSAGE;
  const { email, phone } = followUpContacts(value, { phoneEnabled });
  return email || phone ? "" : "Selecione ao menos um contato para acompanhar a solicitação.";
}

export function normalizeFollowUp(value, options = {}) {
  const error = validateFollowUp(value, options);
  if (error) throw Object.assign(new Error(error), { status: 400 });
  return value.enabled ? { enabled: true, ...followUpContacts(value, options) } : { enabled: false, email: "", phone: "" };
}

export function configsAllowStep(configs, key) {
  return configs.every((config) => config?.[key] !== false);
}
