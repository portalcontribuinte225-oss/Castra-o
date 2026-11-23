import { getSmsUse, smsUses } from "./sms-uses-contract.js";
import { isUseOn, normalizeUseSwitches } from "./use-switches-contract.js";

// Per municipality: which SMS messages the municipality turned on. The platform's token lives in the server's environment.
export const SMS_ACTIVE_USES_CONFIG_KEY = "sms_active_uses";
export const SMS_MAX_TOKEN_LENGTH = 2048;

export const normalizeSmsActiveUses = (stored) => normalizeUseSwitches(stored, smsUses);

export const isSmsUseActive = (switches, key) => isUseOn(switches, getSmsUse(key));

// The rows as the screen shows them: every known use, in order, with its switch (the stored one, or the use's default).
export function normalizeSmsUseRows(rows) {
  const entries = Array.isArray(rows) ? rows : [];
  const active = normalizeSmsActiveUses({ active: Object.fromEntries(entries.map((row) => [row?.key, row?.active])) });
  return smsUses.map(({ key, kind, label, defaultActive }) => ({ key, kind, label, active: active[key] ?? defaultActive }));
}

export function buildDefaultSmsConfig() {
  return { integrated: false, municipalityName: "", uses: normalizeSmsUseRows() };
}

// What the screen reads: whether the server holds a production token (never the token), the municipality's name and its messages.
export function normalizeSmsConfig(value = {}) {
  return { integrated: value?.integrated === true,
    municipalityName: typeof value?.municipalityName === "string" ? value.municipalityName.slice(0, 200) : "",
    uses: normalizeSmsUseRows(value?.uses) };
}

export function validateSmsToken(value) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || value.length > SMS_MAX_TOKEN_LENGTH || !/^[A-Za-z0-9._~+/=-]+$/.test(value)
    || /^Bearer/i.test(value)) return "Informe somente um token de API válido, sem o prefixo Bearer.";
  return "";
}
