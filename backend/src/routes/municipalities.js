import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import { MUNICIPALITY_ADMIN_ROLE, isGlobalUser } from "../tenant.js";
import { upsertMunicipalityDefaultConfigs } from "../municipalityDefaults.js";
import { logAudit, auditCtx, AUDIT_ACTIONS } from "../services/audit.js";

const router = Router();

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Gera uma senha segura aleatória para o admin municipal.
 * Usa env var se definida; caso contrário gera 12 chars aleatórios.
 * O desenvolvedor é responsável por trocar esta senha na primeira configuração.
 */
function generateAdminPassword() {
  const envPassword = process.env.DEFAULT_MUNICIPALITY_ADMIN_PASSWORD;
  if (envPassword) return envPassword;
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return Array.from(crypto.randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
}

function buildMunicipalityAdminEmail(slug) {
  return `${slug}@adm.castragestao`;
}

// ── Listagem pública (só municípios ativos) ───────────────────────────────

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM municipalities WHERE active = TRUE ORDER BY name ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Listagem completa (admin global) ─────────────────────────────────────

router.get("/admin", auth, async (req, res) => {
  if (!isGlobalUser(req.user)) return res.status(403).json({ error: "Acesso restrito ao suporte." });
  try {
    const { rows } = await pool.query("SELECT * FROM municipalities ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Criação de município ──────────────────────────────────────────────────

router.post("/", auth, async (req, res) => {
  if (!isGlobalUser(req.user)) return res.status(403).json({ error: "Acesso restrito ao suporte." });
  const name = String(req.body?.name || "").trim();
  const state = String(req.body?.state || "").trim().toUpperCase().slice(0, 2);
  const active = req.body?.active !== false;
  const contact = String(req.body?.contact || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const address = String(req.body?.address || "").trim();
  const cep = String(req.body?.cep || "").trim();
  const slug = slugify(req.body?.slug || name);
  if (!name || !slug) return res.status(400).json({ error: "Nome do municipio e obrigatorio." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO municipalities (name, state, slug, contact, email, address, cep, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug)
       DO UPDATE SET
         name = EXCLUDED.name,
         state = EXCLUDED.state,
         contact = EXCLUDED.contact,
         email = EXCLUDED.email,
         address = EXCLUDED.address,
         cep = EXCLUDED.cep,
         active = EXCLUDED.active,
         updated_at = NOW()
       RETURNING *`,
      [name, state, slug, contact, email, address, cep, active],
    );
    const municipality = rows[0];

    // Cria o admin municipal com senha segura
    const adminEmail = buildMunicipalityAdminEmail(municipality.slug);
    const temporaryPassword = generateAdminPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const adminResult = await client.query(
      `INSERT INTO users (name, email, password, role, municipality_id, is_default_admin, created_by)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)
       ON CONFLICT (email)
       DO UPDATE SET
         name              = EXCLUDED.name,
         password          = EXCLUDED.password,
         role              = EXCLUDED.role,
         municipality_id   = EXCLUDED.municipality_id,
         is_default_admin  = TRUE,
         updated_at        = NOW()
       RETURNING id, name, email, role, municipality_id`,
      [
        `Administrador ${municipality.name}`,
        adminEmail,
        passwordHash,
        MUNICIPALITY_ADMIN_ROLE,
        municipality.id,
        req.user.id,
      ],
    );
    const adminUser = adminResult.rows[0];

    // Upserta configs padrão (setores, tipos, permissões, agenda, etc.)
    const defaultConfigs = await upsertMunicipalityDefaultConfigs(client, municipality, adminUser);

    // Registra o setor padrão na tabela relacional sectors também
    await client.query(
      `INSERT INTO sectors (id, municipality_id, name, active, is_default, created_by)
       VALUES ($1, $2, $3, TRUE, TRUE, $4)
       ON CONFLICT (id, municipality_id) DO NOTHING`,
      [defaultConfigs.defaultSector.id, municipality.id, defaultConfigs.defaultSector.name, adminUser.id],
    );

    // Vincula o admin ao setor padrão na tabela user_sectors
    await client.query(
      `INSERT INTO user_sectors (user_id, sector_id, municipality_id, is_primary)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (user_id, sector_id, municipality_id) DO NOTHING`,
      [adminUser.id, defaultConfigs.defaultSector.id, municipality.id],
    );

    await logAudit(client, {
      ...auditCtx(req),
      municipalityId: municipality.id,
      action: AUDIT_ACTIONS.MUNICIPALITY_CREATE,
      entityType: "municipality",
      entityId: municipality.id,
      changes: { name, state, slug, adminEmail },
    });

    await client.query("COMMIT");
    res.status(201).json({
      ...municipality,
      defaultUser: {
        ...adminUser,
        sectorIds: defaultConfigs.defaultTeamUser.sectorIds,
        sectorId: defaultConfigs.defaultTeamUser.sectorId,
        temporaryPassword,
      },
      defaultSector: defaultConfigs.defaultSector,
      defaultScheduleRule: defaultConfigs.defaultScheduleRule,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Atualização de município ──────────────────────────────────────────────

// Non-global authenticated users can edit only contact/branding data for their
// own municipality. Tenant identity and activation fields remain master/support-only.
const MUNICIPALITY_SELF_EDIT_FIELDS = ["brasao", "contact", "email", "address", "cep"];
const MUNICIPALITY_GLOBAL_EDIT_FIELDS = ["name", "state", "active", ...MUNICIPALITY_SELF_EDIT_FIELDS];

router.patch("/:id", auth, async (req, res) => {
  const isGlobal = isGlobalUser(req.user);
  const ownMunicipalityId = req.user?.municipalityId || req.user?.municipality_id || null;
  if (!isGlobal && ownMunicipalityId !== req.params.id) {
    return res.status(403).json({ error: "Acesso restrito ao proprio municipio." });
  }

  const fields = [];
  const values = [];
  (isGlobal ? MUNICIPALITY_GLOBAL_EDIT_FIELDS : MUNICIPALITY_SELF_EDIT_FIELDS).forEach((field) => {
    if (req.body?.[field] !== undefined) {
      values.push(field === "state" ? String(req.body[field]).trim().toUpperCase().slice(0, 2) : field === "email" ? String(req.body[field] || "").trim().toLowerCase() : field === "active" ? req.body[field] : String(req.body[field] || "").trim());
      fields.push(`${field} = $${values.length}`);
    }
  });
  if (isGlobal && req.body?.slug !== undefined) {
    values.push(slugify(req.body.slug));
    fields.push(`slug = $${values.length}`);
  }
  if (!fields.length) return res.status(400).json({ error: "Nenhum campo valido." });

  values.push(req.params.id);
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE municipalities SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows[0]) return res.status(404).json({ error: "Municipio nao encontrado." });

    await logAudit(client, {
      ...auditCtx(req),
      municipalityId: req.params.id,
      action: AUDIT_ACTIONS.MUNICIPALITY_UPDATE,
      entityType: "municipality",
      entityId: req.params.id,
      changes: req.body,
    });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
