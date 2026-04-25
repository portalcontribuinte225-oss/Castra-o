import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/:key", async (req, res) => {
  const { rows } = await pool.query("SELECT value FROM config WHERE key=$1", [req.params.key]);
  if (!rows[0]) return res.status(404).json({ error: "Configuração não encontrada" });
  res.json(rows[0].value);
});

router.put("/:key", auth, async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW() RETURNING *`,
    [req.params.key, JSON.stringify(req.body)]
  );
  res.json(rows[0]);
});

export default router;
