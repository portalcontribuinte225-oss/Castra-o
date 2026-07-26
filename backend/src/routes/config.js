import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { isGlobalUser, pickMunicipalityId } from "../tenant.js";
import { logAudit, auditCtx, AUDIT_ACTIONS } from "../services/audit.js";

const router = Router();

// Keys de configuração que expõem dados sensíveis (usuários, permissões)
// e que portanto exigem autenticação para leitura
const SENSITIVE_CONFIG_KEYS = new Set([
  "castragestao:teams",
  "permission_groups",
]);

// Keys de configuração restritas a usuários globais (configurações de plataforma)
const GLOBAL_ONLY_CONFIG_KEYS = new Set([
  "platform",
]);

// Chaves de configuração global que podem ser lidas publicamente (sem dados
// sensíveis, graças a publicConfigValue), mas cuja escrita deve ficar restrita
// à administração global — evita que um admin municipal sobrescreva a config
// de IA compartilhada por todas as prefeituras.
const GLOBAL_WRITE_ONLY_CONFIG_KEYS = new Set([
  "ai",
]);

// ── Validadores de estrutura para chaves críticas ─────────────────────────

/**
 * Valida a estrutura de um array de permission groups.
 * Impede salvar valores inválidos que corrompam o sistema de permissões.
 */
function validatePermissionGroups(value) {
  if (!Array.isArray(value)) return "permission_groups deve ser um array";
  const VALID_MENU_ITEMS = new Set([
    "dashboard", "admin", "credenciamento", "agenda", "adocao", "relatorios", "config",
  ]);
  const VALID_CONFIG_ITEMS = new Set([
    "environment", "users", "sectors", "permissions", "municipalities", "whatsapp_settings",
  ]);
  for (const group of value) {
    if (!group || typeof group !== "object") return "Cada grupo deve ser um objeto";
    if (!group.id || typeof group.id !== "string") return "Cada grupo deve ter um id (string)";
    if (!group.name || typeof group.name !== "string") return "Cada grupo deve ter um name (string)";
    if (!Array.isArray(group.allowedMenuItems)) return `Grupo '${group.id}': allowedMenuItems deve ser array`;
    if (!Array.isArray(group.allowedConfigItems)) return `Grupo '${group.id}': allowedConfigItems deve ser array`;
    for (const item of group.allowedMenuItems) {
      if (!VALID_MENU_ITEMS.has(item)) return `Item de menu inválido: '${item}'`;
    }
    for (const item of group.allowedConfigItems) {
      if (!VALID_CONFIG_ITEMS.has(item)) return `Item de config inválido: '${item}'`;
    }
  }
  return null; // válido
}

/**
 * Valida a estrutura de castragestao:teams.
 * Garante que setores e usuários do time tenham estrutura mínima esperada.
 */
function validateTeams(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "castragestao:teams deve ser um objeto";
  }
  if (!Array.isArray(value.sectors)) return "teams.sectors deve ser um array";
  if (!Array.isArray(value.users)) return "teams.users deve ser um array";
  for (const sector of value.sectors) {
    if (!sector?.id || !sector?.name) return "Cada setor deve ter id e name";
  }
  for (const user of value.users) {
    if (!user?.id) return "Cada usuário do time deve ter id";
  }
  return null;
}

// ── GET /:key ─────────────────────────────────────────────────────────────

router.get("/:key", optionalAuth, async (req, res) => {
  const key = req.params.key;

  // Chaves sensíveis exigem autenticação
  if (SENSITIVE_CONFIG_KEYS.has(key) && !req.user) {
    return res.status(401).json({ error: "Autenticação necessária para esta configuração." });
  }

  // Chaves globais exigem usuário global
  if (GLOBAL_ONLY_CONFIG_KEYS.has(key) && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Configuração restrita à administração global." });
  }

  const municipalityId = pickMunicipalityId(req);
  const query = municipalityId
    ? { text: "SELECT value FROM config WHERE key=$1 AND municipality_id=$2", values: [key, municipalityId] }
    : { text: "SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", values: [key] };

  try {
    const { rows } = await pool.query(query.text, query.values);
    if (!rows[0]) return res.json(null);
    res.json(publicConfigValue(key, rows[0].value));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:key ─────────────────────────────────────────────────────────────

router.put("/:key", auth, async (req, res) => {
  const key = req.params.key;

  // Chaves globais só podem ser salvas por usuários globais
  if (GLOBAL_ONLY_CONFIG_KEYS.has(key) && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Configuração restrita à administração global." });
  }

  // Chaves de escrita restrita: leitura pública, mas só usuário global pode salvar
  if (GLOBAL_WRITE_ONLY_CONFIG_KEYS.has(key) && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Configuração restrita à administração global." });
  }

  const municipalityId = isGlobalUser(req.user)
    ? (req.query?.municipalityId || req.query?.municipality_id || req.body?.municipalityId || req.body?.municipality_id || null)
    : req.user.municipalityId;

  // Valida estrutura para chaves críticas de permissão
  if (key === "permission_groups") {
    const validationError = validatePermissionGroups(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
  }
  if (key === "castragestao:teams") {
    const validationError = validateTeams(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  const client = await pool.connect();
  try {
    const value = await prepareConfigValue(key, req.body, municipalityId, client);
    const { rows } = await client.query(
      `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$3, updated_at=NOW() RETURNING *`,
      [key, municipalityId, JSON.stringify(value)],
    );

    // Auditoria para chaves sensíveis de permissão e time
    if (SENSITIVE_CONFIG_KEYS.has(key)) {
      await logAudit(client, {
        ...auditCtx(req),
        municipalityId,
        action: AUDIT_ACTIONS.CONFIG_UPDATE,
        entityType: "config",
        entityId: key,
        changes: { key, municipalityId },
      });
    }

    res.json({ ...rows[0], value: publicConfigValue(key, rows[0].value) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────

function publicConfigValue(key, value = {}) {
  if (!["ai", "whatsapp", "whatsapp_quota"].includes(key) || !value || typeof value !== "object") return value;
  if (key === "whatsapp") {
    const accessToken = String(value.accessToken || "").trim();
    return { ...value, accessToken: "", hasAccessToken: Boolean(accessToken) };
  }
  if (key === "whatsapp_quota") return value;
  const apiKey = String(value.apiKey || "").trim();
  return { ...value, apiKey: "", hasApiKey: Boolean(apiKey) };
}

async function prepareConfigValue(key, value = {}, municipalityId = null, client) {
  if (!["ai", "whatsapp", "whatsapp_quota"].includes(key) || !value || typeof value !== "object") return value;
  const query = municipalityId
    ? { text: "SELECT value FROM config WHERE key=$1 AND municipality_id=$2", values: [key, municipalityId] }
    : { text: "SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", values: [key] };
  const db = client || pool;
  const { rows } = await db.query(query.text, query.values);
  const current = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
  if (key === "whatsapp") {
    const nextAccessToken = String(value.accessToken || "").trim();
    return { ...current, ...value, accessToken: nextAccessToken || current.accessToken || "" };
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
  return { ...current, ...value, apiKey: nextApiKey || current.apiKey || "" };
}

export default router;
