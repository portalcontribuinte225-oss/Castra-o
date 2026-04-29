import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/:key", async (req, res) => {
  const { rows } = await pool.query("SELECT value FROM config WHERE key=$1", [req.params.key]);
  if (!rows[0]) return res.status(404).json({ error: "Configuração não encontrada" });
  res.json(publicConfigValue(req.params.key, rows[0].value));
});

router.put("/:key", auth, async (req, res) => {
  const value = await prepareConfigValue(req.params.key, req.body);
  const { rows } = await pool.query(
    `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW() RETURNING *`,
    [req.params.key, JSON.stringify(value)],
  );
  res.json({ ...rows[0], value: publicConfigValue(req.params.key, rows[0].value) });
});

function publicConfigValue(key, value = {}) {
  if (key !== "ai" || !value || typeof value !== "object") return value;
  const apiKey = String(value.apiKey || "").trim();
  return {
    ...value,
    apiKey: "",
    hasApiKey: Boolean(apiKey),
  };
}

async function prepareConfigValue(key, value = {}) {
  if (key !== "ai" || !value || typeof value !== "object") return value;
  const { rows } = await pool.query("SELECT value FROM config WHERE key=$1", [key]);
  const current = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
  const nextApiKey = String(value.apiKey || "").trim();
  return {
    ...current,
    ...value,
    apiKey: nextApiKey || current.apiKey || "",
  };
}

export default router;
