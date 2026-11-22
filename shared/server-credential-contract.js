// Integration secrets live in the server's environment (the Render variables), never in the database or on a screen.
export const ServerCredential = Object.freeze({
  APP_PUBLIC_URL: "APP_PUBLIC_URL",
  SMS_TOKEN: "SMS_TOKEN",
  EMAILJS_SERVICE_ID: "EMAILJS_SERVICE_ID",
  EMAILJS_PUBLIC_KEY: "EMAILJS_PUBLIC_KEY",
  EMAILJS_PRIVATE_KEY: "EMAILJS_PRIVATE_KEY",
});

// Why a credential cannot be used: the variable is not set, its value has the wrong shape, or (WhatsApp) the municipality chose none.
export const CredentialIssue = Object.freeze({ MISSING: "missing", INVALID: "invalid", UNSET: "unset" });

// Each WhatsApp token sits in its own variable with this prefix; a municipality picks one of them by name.
export const WHATSAPP_TOKEN_VARIABLE_PREFIX = "WHATSAPP_TOKEN_";
export const WHATSAPP_TOKEN_VARIABLE_PATTERN = /^WHATSAPP_TOKEN_[A-Z0-9_]{1,80}$/;
