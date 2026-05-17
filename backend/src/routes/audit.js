import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import { isGlobalUser, isMunicipalAdmin } from "../tenant.js";

const router = Router();

const VALID_ACTIONS = new Set([
  "USER_CREATE", "USER_UPDATE", "USER_DEACTIVATE",
  "MUNICIPALITY_CREATE", "MUNICIPALITY_UPDATE",
  "CONFIG_UPDATE",
  "ACCESS_REQUEST_REVIEW",
  "SUPPORT_ACCESS",
  "LOGIN",
  "PASSWORD_RESET",
]);

const VALID_ENTITY_TYPES = new Set([
  "user", "municipality", "config", "access_request", "sector",
]);

router.get("/", auth, async (req, res) => {
  if (!isGlobalUser(req.user) && !isMunicipalAdmin(req.user)) {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }

  try {
    const municipalityId = isGlobalUser(req.user)
      ? (req.query.municipalityId || null)
      : req.user.municipalityId;

    const action = VALID_ACTIONS.has(req.query.action) ? req.query.action : null;
    const entityType = VALID_ENTITY_TYPES.has(req.query.entityType) ? req.query.entityType : null;
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10) || 0, 0);

    const conditions = [];
    const values = [];

    if (municipalityId) {
      values.push(municipalityId);
      conditions.push(`municipality_id = $${values.length}`);
    }
    if (action) {
      values.push(action);
      conditions.push(`action = $${values.length}`);
    }
    if (entityType) {
      values.push(entityType);
      conditions.push(`entity_type = $${values.length}`);
    }
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (!Number.isNaN(from.getTime())) {
        values.push(from.toISOString());
        conditions.push(`created_at >= $${values.length}`);
      }
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (!Number.isNaN(to.getTime())) {
        values.push(to.toISOString());
        conditions.push(`created_at <= $${values.length}`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(limit, offset);
    const limitParam = values.length - 1;
    const offsetParam = values.length;

    const { rows } = await pool.query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      values,
    );

    const countValues = values.slice(0, values.length - 2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
      countValues,
    );

    res.json({ total: parseInt(countRows[0]?.total || "0", 10), rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
