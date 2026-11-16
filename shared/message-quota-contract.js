import { NotificationChannel } from "./notification-contract.js";

// The monthly contract of messages a municipality has for each channel. WhatsApp keeps the key it always had.
export const MESSAGE_QUOTA_KEYS = Object.freeze({
  [NotificationChannel.WHATSAPP]: "whatsapp_quota",
  [NotificationChannel.SMS]: "sms_quota",
  [NotificationChannel.EMAIL]: "email_quota",
});

export const MESSAGE_CHANNEL_LABELS = Object.freeze({
  [NotificationChannel.WHATSAPP]: "WhatsApp",
  [NotificationChannel.SMS]: "SMS",
  [NotificationChannel.EMAIL]: "e-mail",
});

export const isMessageChannel = (channel) => typeof channel === "string" && Object.hasOwn(MESSAGE_QUOTA_KEYS, channel);

export const messageQuotaKey = (channel) => (isMessageChannel(channel) ? MESSAGE_QUOTA_KEYS[channel] : null);

// The Brazilian calendar: the month the usage is counted in and the day the contract is checked against.
export function messageQuotaDates(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const period = `${get("year")}-${get("month")}`;
  return { period, today: `${period}-${get("day")}` };
}

// Whether the contract lets messages go today: it has a plan and today is inside its dates. The balance of the month is another matter.
export function isContractInForce(quota, today = messageQuotaDates().today) {
  const plan = Number(quota?.plan);
  if (!Number.isSafeInteger(plan) || plan <= 0) return false;
  if (quota.contractStart && today < quota.contractStart) return false;
  if (quota.contractEnd && today > quota.contractEnd) return false;
  return true;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONTRACT_FIELDS = ["plan", "contractStart", "contractEnd"];

function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// What a save may carry: a whole-number monthly limit and, optionally, the dates of the contract. Answers { value } or { error }.
export function normalizeMessageQuotaInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !CONTRACT_FIELDS.includes(key))) {
    return { error: "Contrato de mensagens inválido." };
  }
  if (!Number.isSafeInteger(input.plan) || input.plan <= 0) return { error: "Informe um limite mensal válido." };
  const contractStart = input.contractStart ?? "";
  const contractEnd = input.contractEnd ?? "";
  if ((contractStart !== "" && !isCalendarDate(contractStart)) || (contractEnd !== "" && !isCalendarDate(contractEnd))) return { error: "Informe datas válidas para o contrato." };
  if (contractStart && contractEnd && contractEnd < contractStart) return { error: "O fim do contrato não pode ser anterior ao início." };
  return { value: { plan: input.plan, contractStart, contractEnd } };
}
