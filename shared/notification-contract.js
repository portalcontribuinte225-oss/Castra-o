export const NotificationEvent = Object.freeze({
  SCHEDULE_CONFIRMED: "schedule_confirmed",
  SCHEDULE_CHANGED: "schedule_changed",
  SCHEDULE_CANCELLED: "schedule_cancelled",
  DOCUMENTS_REVIEWED: "documents_reviewed",
  COMPLETED: "completed",
});

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

// The phone is accepted only when the municipality uses a phone channel (WhatsApp or SMS).
export function validateFollowUp(value, { phoneEnabled = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.enabled !== "boolean") {
    return "Informe se deseja acompanhar a solicitação.";
  }
  if (!value.enabled) return "";
  if (typeof value.email !== "string" || value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) {
    return "Informe um e-mail válido para acompanhar a solicitação.";
  }
  if (phoneEnabled && value.phone !== undefined && value.phone !== "") {
    if (typeof value.phone !== "string" || value.phone.length > 30 || !/^\d{10,11}$/.test(value.phone.replace(/\D/g, ""))) {
      return "Informe um telefone válido com DDD.";
    }
  }
  return "";
}

export function normalizeFollowUp(value, options = {}) {
  const error = validateFollowUp(value, options);
  if (error) throw Object.assign(new Error(error), { status: 400 });
  return value.enabled
    ? { enabled: true, email: value.email.trim().toLowerCase(), phone: options.phoneEnabled ? String(value.phone || "").replace(/\D/g, "") : "" }
    : { enabled: false, email: "", phone: "" };
}

export function configsAllowStep(configs, key) {
  return configs.every((config) => config?.[key] !== false);
}
