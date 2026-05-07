import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import { MUNICIPALITY_ADMIN_ROLE, isGlobalUser } from "../tenant.js";
import { upsertMunicipalityDefaultConfigs } from "../municipalityDefaults.js";

const router = Router();

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const DEFAULT_MUNICIPALITY_ADMIN_PASSWORD = process.env.DEFAULT_MUNICIPALITY_ADMIN_PASSWORD || "qwe12345";

function buildMunicipalityAdminEmail(slug) {
  return `${slug}@adim.com`;
}

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM municipalities WHERE active = TRUE ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin", auth, async (req, res) => {
  if (!isGlobalUser(req.user)) return res.status(403).json({ error: "Acesso restrito ao suporte." });
  try {
    const { rows } = await pool.query("SELECT * FROM municipalities ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  if (!isGlobalUser(req.user)) return res.status(403).json({ error: "Acesso restrito ao suporte." });
  const name = String(req.body?.name || "").trim();
  const state = String(req.body?.state || "").trim().toUpperCase().slice(0, 2);
  const active = req.body?.active !== false;
  const slug = slugify(req.body?.slug || name);
  if (!name || !slug) return res.status(400).json({ error: "Nome do municipio e obrigatorio." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO municipalities (name, state, slug, active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug)
       DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state, active = EXCLUDED.active, updated_at = NOW()
       RETURNING *`,
      [name, state, slug, active],
    );
    const municipality = rows[0];
    const adminEmail = buildMunicipalityAdminEmail(municipality.slug);
    const passwordHash = await bcrypt.hash(DEFAULT_MUNICIPALITY_ADMIN_PASSWORD, 10);
    const adminResult = await client.query(
      `INSERT INTO users (name, email, password, role, municipality_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         municipality_id = EXCLUDED.municipality_id
       RETURNING id, name, email, role, municipality_id`,
      [`Administrador ${municipality.name}`, adminEmail, passwordHash, MUNICIPALITY_ADMIN_ROLE, municipality.id],
    );
    const defaultConfigs = await upsertMunicipalityDefaultConfigs(client, municipality, adminResult.rows[0]);
    await client.query("COMMIT");
    res.status(201).json({
      ...municipality,
      defaultUser: {
        ...adminResult.rows[0],
        sectorIds: defaultConfigs.defaultTeamUser.sectorIds,
        sectorId: defaultConfigs.defaultTeamUser.sectorId,
        temporaryPassword: DEFAULT_MUNICIPALITY_ADMIN_PASSWORD,
      },
      defaultSector: defaultConfigs.defaultSector,
      defaultScheduleRule: defaultConfigs.defaultScheduleRule,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch("/:id", auth, async (req, res) => {
  if (!isGlobalUser(req.user)) return res.status(403).json({ error: "Acesso restrito ao suporte." });
  const fields = [];
  const values = [];
  ["name", "state", "active"].forEach((field) => {
    if (req.body?.[field] !== undefined) {
      values.push(field === "state" ? String(req.body[field]).trim().toUpperCase().slice(0, 2) : req.body[field]);
      fields.push(`${field} = $${values.length}`);
    }
  });
  if (req.body?.slug !== undefined) {
    values.push(slugify(req.body.slug));
    fields.push(`slug = $${values.length}`);
  }
  if (!fields.length) return res.status(400).json({ error: "Nenhum campo valido." });

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE municipalities SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (!rows[0]) return res.status(404).json({ error: "Municipio nao encontrado." });
  res.json(rows[0]);
});

export default router;
