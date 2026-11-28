export const AuthAudience = Object.freeze({ TUTOR: "tutor", STAFF: "staff" });
export const AuthErrorCode = Object.freeze({ CPF_REQUIRED: "CPF_REQUIRED", RECOVERY_OPTIONS_EXPIRED: "RECOVERY_OPTIONS_EXPIRED", SESSION_INVALID: "SESSION_INVALID" });
export const AuthPurpose = Object.freeze({
  PASSWORD_RESET: "password_reset",
  VERIFY_EMAIL: "verify_email", VERIFY_PHONE: "verify_phone", CONTACT_CHANGED: "contact_changed",
  REQUEST_TRACKING: "request_tracking",
});
export const SessionScope = Object.freeze({ FULL: "full", PASSWORD_CHANGE: "password_change" });
export const ContactKind = Object.freeze({ EMAIL: "email", PHONE: "phone" });
export const AUTH_CHALLENGE_SECONDS = 600;
export const AUTH_RETRY_SECONDS = 60;
export const AUTH_MAX_CODE_ATTEMPTS = 5;

export const AuthCodeAction = Object.freeze({
  [AuthPurpose.PASSWORD_RESET]: "redefinir sua senha",
  [AuthPurpose.VERIFY_EMAIL]: "confirmar seu e-mail",
  [AuthPurpose.VERIFY_PHONE]: "confirmar seu telefone",
  [AuthPurpose.REQUEST_TRACKING]: "consultar sua solicitação",
});

export function isAuthCode(value) {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function validateNewPassword(value) {
  if (typeof value !== "string" || Array.from(value).length < 6) return "A senha deve ter pelo menos 6 caracteres.";
  if (new TextEncoder().encode(value).length > 72) return "A senha deve ter no máximo 72 bytes UTF-8.";
  return "";
}
