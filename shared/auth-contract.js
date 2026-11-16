export const AuthAudience = Object.freeze({ TUTOR: "tutor", STAFF: "staff" });
export const AuthErrorCode = Object.freeze({ CPF_REQUIRED: "CPF_REQUIRED", RECOVERY_OPTIONS_EXPIRED: "RECOVERY_OPTIONS_EXPIRED" });
export const AuthPurpose = Object.freeze({
  INITIAL_PASSWORD: "initial_password", PASSWORD_RESET: "password_reset",
  VERIFY_EMAIL: "verify_email", VERIFY_PHONE: "verify_phone", CONTACT_CHANGED: "contact_changed",
  REQUEST_TRACKING: "request_tracking",
});
export const SessionScope = Object.freeze({ FULL: "full", PASSWORD_CHANGE: "password_change" });
export const ContactKind = Object.freeze({ EMAIL: "email", PHONE: "phone" });
export const AUTH_CHALLENGE_SECONDS = 600;
export const AUTH_RETRY_SECONDS = 60;
export const AUTH_MAX_CODE_ATTEMPTS = 5;

export function validateNewPassword(value) {
  if (typeof value !== "string" || Array.from(value).length < 6) return "A senha deve ter pelo menos 6 caracteres.";
  if (new TextEncoder().encode(value).length > 72) return "A senha deve ter no máximo 72 bytes UTF-8.";
  return "";
}
