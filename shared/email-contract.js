import { emailUses, getEmailUse } from "./email-uses-contract.js";
import { isUseOn, normalizeUseSwitches } from "./use-switches-contract.js";

export const EMAIL_SETTINGS_PERMISSION = "email_settings";
// The account and the template ids belong to the platform (no municipality); the switches belong to each municipality.
export const EMAIL_ACCOUNT_CONFIG_KEY = "email_account";
export const EMAIL_TEMPLATES_CONFIG_KEY = "email_templates";
export const EMAIL_ACTIVE_USES_CONFIG_KEY = "email_active_uses";
export const EMAIL_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

// What the screen says about each image of the municipality (brasão and department logo), which reaches the e-mail through a public address.
export const EmailImageStatus = Object.freeze({ READY: "ready", MISSING: "missing", NO_PUBLIC_URL: "no_public_url" });

const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

// Reads the stored `email_templates` row: only known uses with a valid id survive.
export function normalizeEmailTemplateIds(stored) {
  const templates = asObject(asObject(stored).templates);
  return Object.fromEntries(emailUses
    .filter(({ key }) => typeof templates[key] === "string" && EMAIL_ID_PATTERN.test(templates[key].trim()))
    .map(({ key }) => [key, templates[key].trim()]));
}

// Reads the stored `email_active_uses` row. An explicit `false` is kept because password recovery is on by default.
export const normalizeEmailActiveUses = (stored) => normalizeUseSwitches(stored, emailUses);

export const isEmailUseActive = (activeUses, key) => isUseOn(activeUses, getEmailUse(key));

// A patch of ids by use; an empty string clears the id of that use.
export function validateEmailTemplateIds(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return "Informe os templates por mensagem.";
  for (const [key, id] of Object.entries(patch)) {
    if (!getEmailUse(key)) return "Mensagem de e-mail desconhecida.";
    if (typeof id !== "string" || (id.trim() !== "" && !EMAIL_ID_PATTERN.test(id.trim()))) return "ID de template inválido. Use apenas letras, números, hífen e sublinhado.";
  }
  return "";
}
