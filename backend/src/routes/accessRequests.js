import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import { isGlobalUser, pickMunicipalityId } from "../tenant.js";
import { logAudit, auditCtx, AUDIT_ACTIONS } from "../services/audit.js";
import { isValidCpfOrCnpj, isValidPhone } from "../utils.js";

const router = Router();

const REQUESTER_TYPES = new Set(["ONG", "PROTETOR"]);
const REQUEST_STATUSES = new Set(["PENDENTE", "APROVADO", "RECUSADO"]);

const roleByType = {
  ONG: "ong",
  PROTETOR: "protetor",
};

const sectorByType = {
  ONG: "ONGs",
  PROTETOR: "Protetores",
};

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeType(value = "") {
  const type = String(value).trim().toUpperCase();
  if (["ONGS", "ORGANIZACAO", "ORGANIZACAO_NAO_GOVERNAMENTAL"].includes(type)) return "ONG";
  if (["PROTETOR_ANIMAIS", "PROTETOR_INDEPENDENTE"].includes(type)) return "PROTETOR";
  return type;
}

function temporaryPassword() {
  return `Acesso-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function publicAccessRequest(row = {}) {
  if (!row) return row;
  return {
    ...row,
    temporary_password: row.status === "APROVADO" ? row.temporary_password : "",
  };
}

router.get("/", auth, async (req, res) => {
  try {
    const query = isGlobalUser(req.user)
      ? { text: "SELECT * FROM access_requests ORDER BY created_at DESC", values: [] }
      : { text: "SELECT * FROM access_requests WHERE municipality_id = $1 ORDER BY created_at DESC", values: [req.user.municipalityId] };
    const { rows } = await pool.query(query.text, query.values);
    res.json(rows.map(publicAccessRequest));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const requesterType = normalizeType(body.requester_type || body.requesterType);
  const responsibleName = String(body.responsible_name || body.responsibleName || "").trim();
  const email = normalizeEmail(body.email);
  const assignedSector = String(body.assigned_sector || body.assignedSector || sectorByType[requesterType] || "").trim();
  const municipalityId = pickMunicipalityId(req);
  const phone = String(body.phone || "").trim();
  const document = String(body.document || "").trim();
  const isNumericDocument = /^[0-9.\-/\s]+$/.test(document);

  if (!REQUESTER_TYPES.has(requesterType)) return res.status(400).json({ error: "Tipo de solicitante invalido." });
  if (!responsibleName) return res.status(400).json({ error: "Nome do responsavel e obrigatorio." });
  if (!email) return res.status(400).json({ error: "Email e obrigatorio." });
  if (!municipalityId) return res.status(400).json({ error: "Municipio obrigatorio para esta operacao." });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: "Telefone invalido." });
  if (document && isNumericDocument && !isValidCpfOrCnpj(document)) return res.status(400).json({ error: "CPF ou CNPJ invalido." });

  try {
    const { rows } = await pool.query(
      `INSERT INTO access_requests (
        requester_type,
        organization_name,
        responsible_name,
        email,
        phone,
        document,
        city,
        state,
        municipality_id,
        intended_use,
        assigned_sector,
        history
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING *`,
      [
        requesterType,
        String(body.organization_name || body.organizationName || "").trim(),
        responsibleName,
        email,
        phone,
        document,
        String(body.city || "").trim(),
        String(body.state || "").trim(),
        municipalityId,
        String(body.intended_use || body.intendedUse || "").trim(),
        assignedSector,
        JSON.stringify([{ status: "PENDENTE", notes: "Solicitacao enviada para credenciamento.", at: new Date() }]),
      ],
    );
    res.status(201).json(publicAccessRequest(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/review", auth, async (req, res) => {
  const body = req.body || {};
  const status = String(body.status || "").trim().toUpperCase();
  const reviewNote = String(body.review_note || body.reviewNote || "").trim();

  if (!REQUEST_STATUSES.has(status) || status === "PENDENTE") {
    return res.status(400).json({ error: "Decisao invalida para credenciamento." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const scope = isGlobalUser(req.user) ? "" : " AND municipality_id = $2";
    const scopeValues = isGlobalUser(req.user) ? [req.params.id] : [req.params.id, req.user.municipalityId];
    const { rows: existingRows } = await client.query(`SELECT * FROM access_requests WHERE id = $1${scope} FOR UPDATE`, scopeValues);
    const accessRequest = existingRows[0];
    if (!accessRequest) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitacao de credenciamento nao encontrada." });
    }

    let createdUserId = accessRequest.created_user_id || null;
    let password = accessRequest.temporary_password || "";

    if (status === "APROVADO") {
      password = password || temporaryPassword();
      const hash = await bcrypt.hash(password, 10);
      const { rows: userRows } = await client.query(
        `INSERT INTO users (name, email, password, role, municipality_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email)
         DO UPDATE SET
           name            = EXCLUDED.name,
           password        = EXCLUDED.password,
           role            = EXCLUDED.role,
           municipality_id = EXCLUDED.municipality_id,
           updated_at      = NOW()
         RETURNING id`,
        [
          accessRequest.responsible_name,
          normalizeEmail(accessRequest.email),
          hash,
          roleByType[accessRequest.requester_type] || "protetor",
          accessRequest.municipality_id,
          req.user.id,
        ],
      );
      createdUserId = userRows[0].id;
    }

    const historyEntry = {
      status,
      notes: reviewNote || (status === "APROVADO" ? "Credenciamento aprovado." : "Credenciamento recusado."),
      by: req.user.id,
      at: new Date(),
    };

    const { rows } = await client.query(
      `UPDATE access_requests
       SET status = $1,
           review_note = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           created_user_id = $4,
           temporary_password = $5,
           history = history || $6::jsonb,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [status, reviewNote, req.user.id, createdUserId, status === "APROVADO" ? password : "", JSON.stringify([historyEntry]), req.params.id],
    );

    await logAudit(client, {
      ...auditCtx(req),
      municipalityId: accessRequest.municipality_id,
      action: AUDIT_ACTIONS.ACCESS_REQUEST_REVIEW,
      entityType: "access_request",
      entityId: req.params.id,
      changes: { status, reviewNote, createdUserId },
    });

    await client.query("COMMIT");
    res.json(publicAccessRequest(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
