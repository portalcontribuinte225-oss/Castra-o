import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import { GLOBAL_ROLES, MUNICIPALITY_ADMIN_ROLE, isGlobalUser, normalizeRole } from "../tenant.js";

const router = Router();
const PUBLIC_REGISTER_ROLES = new Set(["tutor"]);

function normalizeWritableRole(role = "") {
  const normalized = normalizeRole(role);
  if (["admin", "administrador", "administrador_municipal", "admin municipal"].includes(normalized)) return MUNICIPALITY_ADMIN_ROLE;
  if (["super admin", "super_admin"].includes(normalized)) return "master";
  if (["servidor publico", "servidor_publico"].includes(normalized)) return "servidor_publico";
  return normalized || "analista";
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const loginEmail = String(email || "").trim().toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  const normalizedEmail = loginEmail === "master" && adminEmail ? adminEmail : loginEmail;
  try {
    const { rows } = await pool.query(
      `SELECT u.*, m.name AS municipality_name, m.state AS municipality_state
       FROM users u
       LEFT JOIN municipalities m ON m.id = u.municipality_id
       WHERE lower(u.email) = $1`,
      [normalizedEmail],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciais invalidas" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Credenciais invalidas" });

    const isEnvAdmin = Boolean(adminEmail && normalizedEmail === adminEmail);
    const role = isEnvAdmin ? "master" : user.role;
    const municipalityId = isEnvAdmin ? null : user.municipality_id || null;
    const token = jwt.sign({ id: user.id, role, municipalityId }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        municipalityId,
        municipalityName: isEnvAdmin ? "" : user.municipality_name || "",
        municipalityState: isEnvAdmin ? "" : user.municipality_state || "",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/register", async (req, res) => {
  const { name, email, password, role = "tutor", municipalityId, municipality_id } = req.body;
  const safeRole = PUBLIC_REGISTER_ROLES.has(normalizeRole(role)) ? normalizeRole(role) : "tutor";
  if (!name || !email || !password) return res.status(400).json({ error: "Nome, email e senha sao obrigatorios." });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password, role, municipality_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, municipality_id",
      [name, String(email).trim().toLowerCase(), hash, safeRole, municipality_id || municipalityId || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email ja cadastrado" });
    res.status(500).json({ error: err.message });
  }
});

router.put("/users", auth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || req.body?.senha || "");
  const role = normalizeWritableRole(req.body?.role || "analista");
  const requestedMunicipalityId = isGlobalUser(req.user)
    ? (req.body?.municipalityId || req.body?.municipality_id || null)
    : req.user.municipalityId;
  const isTargetGlobal = GLOBAL_ROLES.has(role);
  const municipalityId = isTargetGlobal ? null : requestedMunicipalityId;

  if (!name || !email) return res.status(400).json({ error: "Nome e email sao obrigatorios." });
  if (isTargetGlobal && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Somente suporte pode criar usuarios globais." });
  }
  if (!municipalityId && !isTargetGlobal) {
    return res.status(400).json({ error: "Municipio obrigatorio para este usuario." });
  }

  try {
    const current = await pool.query("SELECT id, password, role, municipality_id FROM users WHERE lower(email) = $1", [email]);
    const existing = current.rows[0];
    if (existing && !isGlobalUser(req.user)) {
      if (GLOBAL_ROLES.has(normalizeRole(existing.role)) || existing.municipality_id !== municipalityId) {
        return res.status(403).json({ error: "Usuario fora do municipio atual." });
      }
    }
    if (!existing && !password) {
      return res.status(400).json({ error: "Senha inicial obrigatoria para criar usuario." });
    }

    const hash = password ? await bcrypt.hash(password, 10) : existing?.password;
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role, municipality_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         municipality_id = EXCLUDED.municipality_id
       RETURNING id, name, email, role, municipality_id`,
      [name, email, hash, role, municipalityId],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "E-mail obrigatorio" });
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE lower(email) = $1", [email]);
    if (!rows[0]) return res.json({ ok: true });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      "UPDATE users SET reset_code = $1, reset_code_expires_at = $2 WHERE id = $3",
      [code, expires, rows[0].id],
    );
    res.json({ ok: true, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reset-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  const password = String(req.body.password || "");
  if (!email || !code || !password) return res.status(400).json({ error: "Dados incompletos" });
  if (password.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
  try {
    const { rows } = await pool.query(
      "SELECT id, reset_code, reset_code_expires_at FROM users WHERE lower(email) = $1",
      [email],
    );
    const user = rows[0];
    if (!user || user.reset_code !== code) return res.status(400).json({ error: "Codigo invalido" });
    if (new Date() > new Date(user.reset_code_expires_at)) return res.status(400).json({ error: "Codigo expirado. Solicite um novo." });
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE users SET password = $1, reset_code = NULL, reset_code_expires_at = NULL WHERE id = $2",
      [hash, user.id],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
