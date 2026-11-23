import { pool } from "../db/index.js";
import { ContractState, MESSAGE_CHANNEL_LABELS, contractState, isMessageChannel, messageQuotaDates, messageQuotaKey, normalizeMessageQuotaInput } from "../../../shared/message-quota-contract.js";
import { readConfigValue, updateConfigValue } from "../repositories/config-values.js";
import { AUDIT_ACTIONS } from "./audit.js";

const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : null);

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function keyOf(channel) {
  const key = messageQuotaKey(channel);
  if (!key) throw invalid("Canal de mensagens inválido.");
  return key;
}

// Whether one more message of the channel may go: the contract is on and in force, and the month still has room.
export function evaluateMessageQuota(channel, quota, now = new Date()) {
  const label = MESSAGE_CHANNEL_LABELS[channel];
  const { today, period } = messageQuotaDates(now);
  const state = contractState(quota, today);
  if (state === ContractState.NONE) return { allowed: false, reason: `Cota de ${label} não configurada para o município.` };
  if (state === ContractState.OFF) return { allowed: false, reason: `Contrato de ${label} desativado para o município.` };
  if (state === ContractState.OUT_OF_PERIOD) {
    return { allowed: false, reason: quota.contractStart && today < quota.contractStart ? `Contrato de ${label} ainda não vigente.` : `Contrato de ${label} expirado.` };
  }
  const plan = Number(quota.plan);
  const storedUsed = Number(quota.currentPeriodUsed);
  const used = quota.currentPeriodStart === period && Number.isSafeInteger(storedUsed) && storedUsed >= 0 ? storedUsed : 0;
  if (used >= plan) return { allowed: false, reason: `Cota mensal de ${label} esgotada.`, remaining: 0 };
  return { allowed: true, remaining: plan - used - 1, next: { ...quota, currentPeriodStart: period, currentPeriodUsed: used + 1 } };
}

// One message of the channel spent from the municipality's month. The read and the write share a transaction lock, so concurrent
// requests cannot consume the same last slot.
export async function checkAndConsumeQuota(channel, municipalityId, { database = pool, now = new Date() } = {}) {
  if (!isMessageChannel(channel)) return { allowed: false, reason: "Canal de mensagens inválido." };
  if (!municipalityId) return { allowed: false, reason: "Município não identificado." };
  let result;
  await updateConfigValue(messageQuotaKey(channel), municipalityId, (stored) => {
    result = evaluateMessageQuota(channel, asObject(stored), now);
    return result.allowed ? result.next : undefined;
  }, { database });
  const { next, ...publicResult } = result;
  return publicResult;
}

// Read-only: answers whether a message could go now, without spending it.
export async function isQuotaAvailable(channel, municipalityId, { database = pool, now = new Date() } = {}) {
  if (!municipalityId || !isMessageChannel(channel)) return false;
  return evaluateMessageQuota(channel, asObject(await readConfigValue(messageQuotaKey(channel), municipalityId, database)), now).allowed;
}

// The contract as its card shows it: the limit, the month's usage, the dates and where it stands today. Null when there is none.
export async function getQuotaStatus(channel, municipalityId, { database = pool, now = new Date() } = {}) {
  if (!municipalityId || !isMessageChannel(channel)) return null;
  const quota = asObject(await readConfigValue(messageQuotaKey(channel), municipalityId, database));
  if (!quota?.plan) return null;
  const { today, period } = messageQuotaDates(now);
  return {
    plan: quota.plan,
    used: quota.currentPeriodStart === period ? Number(quota.currentPeriodUsed) || 0 : 0,
    contractStart: quota.contractStart || null,
    contractEnd: quota.contractEnd || null,
    state: contractState(quota, today),
  };
}

// Saves the contract (the limit, the dates and whether it is on); the usage already counted this month stays.
export async function saveQuota({ channel, municipalityId, input, audit, database = pool }) {
  const key = keyOf(channel);
  const { value, error } = normalizeMessageQuotaInput(input);
  if (error) throw invalid(error);
  await updateConfigValue(key, municipalityId, (current) => {
    const stored = asObject(current) || {};
    return { ...value, currentPeriodStart: stored.currentPeriodStart || "", currentPeriodUsed: stored.currentPeriodUsed || 0 };
  }, {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.CONFIG_UPDATE, entityType: "config", entityId: key, changes: { key, municipalityId, ...value } },
  });
  return getQuotaStatus(channel, municipalityId, { database });
}
