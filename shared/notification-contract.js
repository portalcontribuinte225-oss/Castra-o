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
export const NOTIFICATIONS_CONFIG_KEY = "castragestao:notifications";

export function buildDefaultNotificationConfig() {
  return {
    emailEnabled: true,
    smsEnabled: false,
    emailTemplateId: "",
  };
}

export function normalizeNotificationConfig(value = {}) {
  const defaults = buildDefaultNotificationConfig();
  const text = (input) => typeof input === "string" ? input.trim().slice(0, 200) : "";
  return {
    ...defaults,
    emailTemplateId: text(value?.emailTemplateId),
  };
}

export function validateNotificationConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Configuração de notificações inválida.";
  if (value.emailEnabled !== undefined && value.emailEnabled !== true) return "E-mail deve permanecer habilitado.";
  if (value.smsEnabled !== undefined && value.smsEnabled !== false) return "SMS ainda não está disponível.";
  if (value.emailTemplateId !== undefined && (typeof value.emailTemplateId !== "string" || value.emailTemplateId.length > 200)) {
    return "Identificador do template de e-mail inválido.";
  }
  return "";
}

export function mergeNotificationConfig(current, patch = {}) {
  const previous = normalizeNotificationConfig(current);
  return normalizeNotificationConfig({ ...previous, ...patch });
}

export function validateFollowUp(value, { whatsappEnabled = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.enabled !== "boolean") {
    return "Informe se deseja acompanhar a solicitação.";
  }
  if (!value.enabled) return "";
  if (typeof value.email !== "string" || value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) {
    return "Informe um e-mail válido para acompanhar a solicitação.";
  }
  if (whatsappEnabled && value.phone !== undefined && value.phone !== "") {
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
    ? { enabled: true, email: value.email.trim().toLowerCase(), phone: options.whatsappEnabled ? String(value.phone || "").replace(/\D/g, "") : "" }
    : { enabled: false, email: "", phone: "" };
}

export function configsAllowStep(configs, key) {
  return configs.every((config) => config?.[key] !== false);
}
