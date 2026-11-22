import { secretPreview } from "./secret-preview-contract.js";
import { CredentialIssue } from "./server-credential-contract.js";
import { getSmsUse, smsUses } from "./sms-uses-contract.js";
import { isUseOn, normalizeUseSwitches } from "./use-switches-contract.js";

// The platform's SMS channel switch: one row with no municipality, which only the master changes. The token lives in the environment.
export const SMS_CONFIG_KEY = "castragestao:sms";
// Per municipality: which SMS messages the municipality turned on.
export const SMS_ACTIVE_USES_CONFIG_KEY = "sms_active_uses";
export const SMS_MAX_TOKEN_LENGTH = 2048;
export const SmsProvider = Object.freeze({ SMSMAIS: "smsmais" });
export const SmsEnvironment = Object.freeze({ PRODUCTION: "production", SANDBOX: "sandbox" });

export const normalizeSmsActiveUses = (stored) => normalizeUseSwitches(stored, smsUses);

export const isSmsUseActive = (switches, key) => isUseOn(switches, getSmsUse(key));

// The rows as the screen shows them: every known use, in order, with its switch (the stored one, or the use's default).
export function normalizeSmsUseRows(rows) {
  const entries = Array.isArray(rows) ? rows : [];
  const active = normalizeSmsActiveUses({ active: Object.fromEntries(entries.map((row) => [row?.key, row?.active])) });
  return smsUses.map(({ key, kind, label, defaultActive }) => ({ key, kind, label, active: active[key] ?? defaultActive }));
}

export function buildDefaultSmsConfig() {
  return { provider: SmsProvider.SMSMAIS, active: false, hasToken: false, tokenPreview: "", environment: null, tokenIssue: null,
    municipalityName: "", uses: normalizeSmsUseRows() };
}

// This contract only projects public metadata: of the token, only its start (the preview) is readable; the token itself never
// belongs in a DTO. The issue says why the server holds no usable token.
export function normalizeSmsConfig(value = {}) {
  const hasToken = value?.hasToken === true;
  return { provider: SmsProvider.SMSMAIS, active: value?.active === true, hasToken,
    tokenPreview: hasToken && typeof value?.tokenPreview === "string" ? secretPreview(value.tokenPreview) : "",
    environment: Object.values(SmsEnvironment).includes(value?.environment) ? value.environment : null,
    tokenIssue: Object.values(CredentialIssue).includes(value?.tokenIssue) ? value.tokenIssue : null,
    municipalityName: typeof value?.municipalityName === "string" ? value.municipalityName.slice(0, 200) : "",
    uses: normalizeSmsUseRows(value?.uses) };
}

export function validateSmsToken(value) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || value.length > SMS_MAX_TOKEN_LENGTH || !/^[A-Za-z0-9._~+/=-]+$/.test(value)
    || /^Bearer/i.test(value)) return "Informe somente um token de API válido, sem o prefixo Bearer.";
  return "";
}
