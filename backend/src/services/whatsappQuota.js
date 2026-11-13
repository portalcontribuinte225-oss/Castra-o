import { pool } from "../db/index.js";

const QUOTA_KEY = "whatsapp_quota";

function calendarKeys(now) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const period = `${get("year")}-${get("month")}`;
  return { period, today: `${period}-${get("day")}` };
}

async function readQuota(municipalityId, db = pool, lock = false) {
  const { rows } = await db.query(
    `SELECT value FROM config WHERE key=$1 AND municipality_id=$2${lock ? " FOR UPDATE" : ""}`,
    [QUOTA_KEY, municipalityId],
  );
  const value = rows[0]?.value;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function writeQuota(municipalityId, value, db) {
  await db.query(
    `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
     DO UPDATE SET value=$3, updated_at=NOW()`,
    [QUOTA_KEY, municipalityId, JSON.stringify(value)],
  );
}

export function evaluateWhatsappQuota(quota, now = new Date()) {
  const plan = Number(quota?.plan);
  if (!Number.isSafeInteger(plan) || plan <= 0) return { allowed: false, reason: "Cota de WhatsApp não configurada para o município." };
  const { today, period } = calendarKeys(now);
  if (quota.contractStart && today < quota.contractStart) return { allowed: false, reason: "Contrato de WhatsApp ainda não vigente." };
  if (quota.contractEnd && today > quota.contractEnd) return { allowed: false, reason: "Contrato de WhatsApp expirado." };
  const storedUsed = Number(quota.currentPeriodUsed);
  const used = quota.currentPeriodStart === period && Number.isSafeInteger(storedUsed) && storedUsed >= 0 ? storedUsed : 0;
  if (used >= plan) return { allowed: false, reason: "Cota mensal de WhatsApp esgotada.", remaining: 0 };
  return { allowed: true, remaining: plan - used - 1, next: { ...quota, currentPeriodStart: period, currentPeriodUsed: used + 1 } };
}

// Adapt the existing quota read/write to one transaction: concurrent requests cannot consume the same last slot.
export async function checkAndConsumeQuota(municipalityId, { db = pool, now = new Date() } = {}) {
  if (!municipalityId) return { allowed: false, reason: "Município não identificado." };
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const quota = await readQuota(municipalityId, client, true);
    const result = evaluateWhatsappQuota(quota, now);
    if (result.allowed) await writeQuota(municipalityId, result.next, client);
    await client.query("COMMIT");
    const { next, ...publicResult } = result;
    return publicResult;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getQuotaStatus(municipalityId) {
  if (!municipalityId) return null;
  const quota = await readQuota(municipalityId);
  if (!quota?.plan) return null;
  const { today, period } = calendarKeys(new Date());
  const used = quota.currentPeriodStart === period ? Number(quota.currentPeriodUsed) || 0 : 0;
  return {
    plan: quota.plan,
    used,
    remaining: Math.max(0, Number(quota.plan) - used),
    contractStart: quota.contractStart || null,
    contractEnd: quota.contractEnd || null,
    active: (!quota.contractStart || today >= quota.contractStart) && (!quota.contractEnd || today <= quota.contractEnd),
  };
}
