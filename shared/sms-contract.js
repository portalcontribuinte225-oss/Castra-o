export const SMS_CONFIG_KEY = "castragestao:sms";
export const SMS_MAX_TOKEN_LENGTH = 2048;
export const SmsProvider = Object.freeze({ SMSMAIS: "smsmais" });
export const SmsEnvironment = Object.freeze({ PRODUCTION: "production", SANDBOX: "sandbox" });

export function buildDefaultSmsConfig() {
  return { provider: SmsProvider.SMSMAIS, active: false, hasToken: false, environment: null,
    tokenValid: false, lastValidatedAt: null, secureStorageAvailable: false };
}

// This contract only projects public metadata; neither plaintext nor ciphertext belongs in a DTO.
export function normalizeSmsConfig(value = {}) {
  return { provider: SmsProvider.SMSMAIS, active: value?.active === true, hasToken: value?.hasToken === true,
    environment: Object.values(SmsEnvironment).includes(value?.environment) ? value.environment : null,
    tokenValid: value?.tokenValid === true, lastValidatedAt: typeof value?.lastValidatedAt === "string" ? value.lastValidatedAt : null,
    secureStorageAvailable: value?.secureStorageAvailable === true };
}

export function validateSmsToken(value) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || value.length > SMS_MAX_TOKEN_LENGTH || !/^[A-Za-z0-9._~+/=-]+$/.test(value)
    || /^Bearer/i.test(value)) return "Informe somente um token de API válido, sem o prefixo Bearer.";
  return "";
}
