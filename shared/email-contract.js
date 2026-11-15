export const EMAIL_SETTINGS_PERMISSION = "email_settings";

export function normalizeEmailStatus(value = {}) {
  return { serviceConfigured: value?.serviceConfigured === true, publicKeyConfigured: value?.publicKeyConfigured === true,
    privateKeyConfigured: value?.privateKeyConfigured === true, recoveryTemplateConfigured: value?.recoveryTemplateConfigured === true };
}
