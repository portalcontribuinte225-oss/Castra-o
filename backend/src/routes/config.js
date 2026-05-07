import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { isGlobalUser, pickMunicipalityId } from "../tenant.js";

const router = Router();

router.get("/:key", optionalAuth, async (req, res) => {
  const municipalityId = pickMunicipalityId(req);
  const query = municipalityId
    ? { text: "SELECT value FROM config WHERE key=$1 AND municipality_id=$2", values: [req.params.key, municipalityId] }
    : { text: "SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", values: [req.params.key] };
  const { rows } = await pool.query(query.text, query.values);
  if (!rows[0]) return res.status(404).json({ error: "Configuração não encontrada" });
  res.json(publicConfigValue(req.params.key, rows[0].value));
});

router.put("/:key", auth, async (req, res) => {
  const municipalityId = isGlobalUser(req.user)
    ? (req.query?.municipalityId || req.query?.municipality_id || req.body?.municipalityId || req.body?.municipality_id || null)
    : req.user.municipalityId;
  const value = await prepareConfigValue(req.params.key, req.body, municipalityId);
  const { rows } = await pool.query(
    `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
     DO UPDATE SET value=$3, updated_at=NOW() RETURNING *`,
    [req.params.key, municipalityId, JSON.stringify(value)],
  );
  res.json({ ...rows[0], value: publicConfigValue(req.params.key, rows[0].value) });
});

function publicConfigValue(key, value = {}) {
  if (!["ai", "whatsapp", "whatsapp_quota"].includes(key) || !value || typeof value !== "object") return value;
  if (key === "whatsapp") {
    const accessToken = String(value.accessToken || "").trim();
    return {
      ...value,
      accessToken: "",
      hasAccessToken: Boolean(accessToken),
    };
  }
  if (key === "whatsapp_quota") {
    return value;
  }
  const apiKey = String(value.apiKey || "").trim();
  return {
    ...value,
    apiKey: "",
    hasApiKey: Boolean(apiKey),
  };
}

async function prepareConfigValue(key, value = {}, municipalityId = null) {
  if (!["ai", "whatsapp", "whatsapp_quota"].includes(key) || !value || typeof value !== "object") return value;
  const query = municipalityId
    ? { text: "SELECT value FROM config WHERE key=$1 AND municipality_id=$2", values: [key, municipalityId] }
    : { text: "SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", values: [key] };
  const { rows } = await pool.query(query.text, query.values);
  const current = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
  if (key === "whatsapp") {
    const nextAccessToken = String(value.accessToken || "").trim();
    return {
      ...current,
      ...value,
      accessToken: nextAccessToken || current.accessToken || "",
    };
  }
  if (key === "whatsapp_quota") {
    return {
      plan: Number(value.plan) || current.plan || 0,
      contractStart: value.contractStart || current.contractStart || "",
      contractEnd: value.contractEnd || current.contractEnd || "",
      currentPeriodStart: current.currentPeriodStart || "",
      currentPeriodUsed: current.currentPeriodUsed || 0,
    };
  }
  const nextApiKey = String(value.apiKey || "").trim();
  return {
    ...current,
    ...value,
    apiKey: nextApiKey || current.apiKey || "",
  };
}

export default router;
