export const AuthAudience = Object.freeze({ TUTOR: "tutor", STAFF: "staff" });
export const AuthErrorCode = Object.freeze({ CPF_REQUIRED: "CPF_REQUIRED", RECOVERY_OPTIONS_EXPIRED: "RECOVERY_OPTIONS_EXPIRED" });
export const AuthPurpose = Object.freeze({
  INITIAL_PASSWORD: "initial_password", PASSWORD_RESET: "password_reset",
  VERIFY_EMAIL: "verify_email", VERIFY_PHONE: "verify_phone", CONTACT_CHANGED: "contact_changed",
});
export const SessionScope = Object.freeze({ FULL: "full", PASSWORD_CHANGE: "password_change" });
export const ContactKind = Object.freeze({ EMAIL: "email", PHONE: "phone" });
export const AUTH_DELIVERY_CONFIG_KEY = "castragestao:auth-delivery";
export const AUTH_CHALLENGE_SECONDS = 600;
export const AUTH_RETRY_SECONDS = 60;
export const AUTH_MAX_CODE_ATTEMPTS = 5;

export function validateNewPassword(value) {
  if (typeof value !== "string" || Array.from(value).length < 6) return "A senha deve ter pelo menos 6 caracteres.";
  if (new TextEncoder().encode(value).length > 72) return "A senha deve ter no máximo 72 bytes UTF-8.";
  return "";
}

export function buildDefaultAuthDeliveryConfig() {
  const templates = () => Object.fromEntries(Object.values(AuthPurpose).map((purpose) => [purpose, ""]));
  return { emailTemplates: templates(), whatsappTemplates: templates() };
}

export function normalizeAuthDeliveryConfig(value = {}) {
  const defaults = buildDefaultAuthDeliveryConfig();
  return Object.fromEntries(Object.entries(defaults).map(([channel, templates]) => [channel,
    Object.fromEntries(Object.keys(templates).map((purpose) => [purpose,
      typeof value?.[channel]?.[purpose] === "string" ? value[channel][purpose].trim().slice(0, 200) : "",
    ])),
  ]));
}

export function validateAuthDeliveryConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Configuração de autenticação inválida.";
  for (const channel of ["emailTemplates", "whatsappTemplates"]) {
    const templates = value[channel];
    if (templates === undefined) continue;
    if (!templates || typeof templates !== "object" || Array.isArray(templates)) return "Templates de autenticação inválidos.";
    if (Object.entries(templates).some(([purpose, template]) => !Object.values(AuthPurpose).includes(purpose)
      || typeof template !== "string" || template.length > 200)) return "Template de autenticação inválido.";
  }
  return "";
}
