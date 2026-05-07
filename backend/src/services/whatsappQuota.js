import { pool } from "../db/index.js";

const QUOTA_KEY = "whatsapp_quota";

function parseObj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function monthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function readQuota(municipalityId) {
  const { rows } = await pool.query(
    "SELECT value FROM config WHERE key=$1 AND municipality_id=$2",
    [QUOTA_KEY, municipalityId],
  );
  return rows[0]?.value ? parseObj(rows[0].value) : null;
}

async function writeQuota(municipalityId, value) {
  await pool.query(
    `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
     DO UPDATE SET value=$3, updated_at=NOW()`,
    [QUOTA_KEY, municipalityId, JSON.stringify(value)],
  );
}

export async function checkAndConsumeQuota(municipalityId) {
  if (!municipalityId) return { allowed: false, reason: "Município não identificado" };

  const quota = await readQuota(municipalityId);
  if (!quota?.plan) return { allowed: false, reason: "Cota de WhatsApp não configurada para o município" };

  const today = new Date().toISOString().slice(0, 10);
  if (quota.contractStart && today < quota.contractStart)
    return { allowed: false, reason: "Contrato de WhatsApp ainda não vigente" };
  if (quota.contractEnd && today > quota.contractEnd)
    return { allowed: false, reason: "Contrato de WhatsApp expirado" };

  const period = monthKey();
  const used = quota.currentPeriodStart === period ? (quota.currentPeriodUsed || 0) : 0;

  if (used >= quota.plan)
    return { allowed: false, reason: `Cota mensal de ${quota.plan} mensagens esgotada`, remaining: 0 };

  const nextUsed = used + 1;
  await writeQuota(municipalityId, { ...quota, currentPeriodStart: period, currentPeriodUsed: nextUsed });
  return { allowed: true, remaining: quota.plan - nextUsed };
}

export async function getQuotaStatus(municipalityId) {
  if (!municipalityId) return null;
  const quota = await readQuota(municipalityId);
  if (!quota?.plan) return null;

  const period = monthKey();
  const used = quota.currentPeriodStart === period ? (quota.currentPeriodUsed || 0) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const active =
    (!quota.contractStart || today >= quota.contractStart) &&
    (!quota.contractEnd || today <= quota.contractEnd);

  return {
    plan: quota.plan,
    used,
    remaining: Math.max(0, quota.plan - used),
    contractStart: quota.contractStart || null,
    contractEnd: quota.contractEnd || null,
    active,
  };
}
