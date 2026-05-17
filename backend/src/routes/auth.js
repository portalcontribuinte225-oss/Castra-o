import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import {
  GLOBAL_ROLES,
  MUNICIPALITY_ADMIN_ROLE,
  isGlobalUser,
  isMunicipalAdmin,
  canAssignRole,
  canManageUser,
  normalizeRole,
} from "../tenant.js";
import { logAudit, auditCtx, AUDIT_ACTIONS } from "../services/audit.js";

const router = Router();

// Roles que podem ser registrados publicamente sem autenticação
const PUBLIC_REGISTER_ROLES = new Set(["tutor"]);

function normalizeWritableRole(role = "") {
  const normalized = normalizeRole(role);
  const aliases = {
    admin: MUNICIPALITY_ADMIN_ROLE,
    administrador: MUNICIPALITY_ADMIN_ROLE,
    administrador_municipal: MUNICIPALITY_ADMIN_ROLE,
    "admin municipal": MUNICIPALITY_ADMIN_ROLE,
    "super admin": "master",
    super_admin: "master",
    servidor_publico: "servidor_publico",
    "servidor publico": "servidor_publico",
  };
  return aliases[normalized] || normalized || "analista";
}

// ── Login ─────────────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const loginEmail = String(email || "").trim().toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  // Permite digitar "master" como e-mail atalho para o admin global
  const normalizedEmail = loginEmail === "master" && adminEmail ? adminEmail : loginEmail;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT u.*, m.name AS municipality_name, m.state AS municipality_state
       FROM users u
       LEFT JOIN municipalities m ON m.id = u.municipality_id
       WHERE lower(u.email) = $1`,
      [normalizedEmail],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciais invalidas" });

    // Bloqueia usuários desativados
    if (user.active === false) {
      return res.status(403).json({ error: "Usuário desativado. Contate o administrador." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Credenciais invalidas" });

    const isEnvAdmin = Boolean(adminEmail && normalizedEmail === adminEmail);
    const role = isEnvAdmin ? "master" : user.role;
    const municipalityId = isEnvAdmin ? null : user.municipality_id || null;
    const token = jwt.sign({ id: user.id, role, municipalityId }, process.env.JWT_SECRET, { expiresIn: "8h" });

    // Atualiza last_login
    await client.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

    await logAudit(client, {
      ...auditCtx({ user: { id: user.id, email: user.email, municipalityId }, headers: req.headers, ip: req.ip }),
      action: AUDIT_ACTIONS.LOGIN,
      entityType: "user",
      entityId: user.id,
    });

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
  } finally {
    client.release();
  }
});

// ── Registro público (apenas tutor) ──────────────────────────────────────

router.post("/register", async (req, res) => {
  const { name, email, password, role = "tutor", municipalityId, municipality_id } = req.body;
  const safeRole = PUBLIC_REGISTER_ROLES.has(normalizeRole(role)) ? normalizeRole(role) : "tutor";
  if (!name || !email || !password) return res.status(400).json({ error: "Nome, email e senha sao obrigatorios." });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role, municipality_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, municipality_id`,
      [name, String(email).trim().toLowerCase(), hash, safeRole, municipality_id || municipalityId || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email ja cadastrado" });
    res.status(500).json({ error: err.message });
  }
});

// ── Criação / atualização de usuários (autenticado) ───────────────────────

router.put("/users", auth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || req.body?.senha || "");
  const role = normalizeWritableRole(req.body?.role || "analista");

  // Resolve o município-alvo: globais podem especificar; municipais ficam no seu
  const requestedMunicipalityId = isGlobalUser(req.user)
    ? (req.body?.municipalityId || req.body?.municipality_id || null)
    : req.user.municipalityId;

  const isTargetGlobal = GLOBAL_ROLES.has(role);
  const municipalityId = isTargetGlobal ? null : requestedMunicipalityId;

  if (!name || !email) return res.status(400).json({ error: "Nome e email sao obrigatorios." });

  // Apenas globais criam outros globais
  if (isTargetGlobal && !isGlobalUser(req.user)) {
    return res.status(403).json({ error: "Somente suporte global pode criar usuarios globais." });
  }

  // Admin municipal só pode atribuir roles permitidos
  if (!isGlobalUser(req.user) && !canAssignRole(req.user, role)) {
    return res.status(403).json({
      error: `Role '${role}' nao pode ser atribuido por administrador municipal.`,
    });
  }

  if (!municipalityId && !isTargetGlobal) {
    return res.status(400).json({ error: "Municipio obrigatorio para este usuario." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Carrega usuário existente (se houver)
    const { rows: current } = await client.query(
      "SELECT id, password, role, municipality_id, is_default_admin FROM users WHERE lower(email) = $1",
      [email],
    );
    const existing = current[0];

    if (existing) {
      // Garante que admin municipal não modifique usuários de outro município
      if (!isGlobalUser(req.user) && !canManageUser(req.user, existing)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Usuario fora do municipio atual ou sem autoridade para modificar." });
      }
      // Protege o admin padrão do município de ter seu role rebaixado por outro admin_municipal
      if (
        existing.is_default_admin &&
        isMunicipalAdmin(req.user) &&
        !isGlobalUser(req.user) &&
        normalizeRole(role) !== MUNICIPALITY_ADMIN_ROLE
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "O administrador padrão do municipio nao pode ter seu perfil alterado." });
      }
    }

    if (!existing && !password) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Senha inicial obrigatoria para criar usuario." });
    }

    const hash = password ? await bcrypt.hash(password, 10) : existing?.password;
    const isCreate = !existing;

    const { rows } = await client.query(
      `INSERT INTO users (name, email, password, role, municipality_id, created_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (email)
       DO UPDATE SET
         name            = EXCLUDED.name,
         password        = EXCLUDED.password,
         role            = EXCLUDED.role,
         municipality_id = EXCLUDED.municipality_id,
         updated_at      = NOW()
       RETURNING id, name, email, role, municipality_id`,
      [name, email, hash, role, municipalityId, isCreate ? req.user.id : null],
    );

    const savedUser = rows[0];

    await logAudit(client, {
      ...auditCtx(req),
      municipalityId: municipalityId || req.user.municipalityId,
      action: isCreate ? AUDIT_ACTIONS.USER_CREATE : AUDIT_ACTIONS.USER_UPDATE,
      entityType: "user",
      entityId: savedUser.id,
      changes: {
        name,
        email,
        role,
        municipalityId,
        ...(isCreate ? { createdBy: req.user.id } : {}),
      },
    });

    await client.query("COMMIT");
    res.json(savedUser);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Recuperação de senha ──────────────────────────────────────────────────

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "E-mail obrigatorio" });
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT id FROM users WHERE lower(email) = $1", [email]);
    if (!rows[0]) return res.json({ ok: true }); // não revela se e-mail existe
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await client.query(
      "UPDATE users SET reset_code = $1, reset_code_expires_at = $2 WHERE id = $3",
      [code, expires, rows[0].id],
    );
    res.json({ ok: true, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/reset-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  const password = String(req.body.password || "");
  if (!email || !code || !password) return res.status(400).json({ error: "Dados incompletos" });
  if (password.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, reset_code, reset_code_expires_at FROM users WHERE lower(email) = $1",
      [email],
    );
    const user = rows[0];
    if (!user || user.reset_code !== code) return res.status(400).json({ error: "Codigo invalido" });
    if (new Date() > new Date(user.reset_code_expires_at)) {
      return res.status(400).json({ error: "Codigo expirado. Solicite um novo." });
    }
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      "UPDATE users SET password = $1, reset_code = NULL, reset_code_expires_at = NULL, updated_at = NOW() WHERE id = $2",
      [hash, user.id],
    );
    await logAudit(client, {
      userId: user.id,
      userEmail: email,
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      entityType: "user",
      entityId: user.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
