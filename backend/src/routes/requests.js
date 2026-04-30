import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { normalizeCpf } from "../utils.js";

const router = Router();
const ALLOWED_REQUEST_STATUSES = new Set(["EM_ANALISE", "AGUARDANDO_CIRURGIA", "ARQUIVADA"]);
const ALLOWED_REQUEST_TAGS = new Set([
  "ATRIBUIDA",
  "DEFERIDA",
  "INDEFERIDA",
  "COMPARECEU",
  "NAO_COMPARECEU",
  "CANCELADA",
  "REAGENDADA",
  "PRIORIDADE",
  "RETORNO_TUTOR",
  "MUTIRAO",
  "PRESENCIAL",
  "MICROCHIP",
  "OBITO",
  "TROCA_TUTOR",
]);

function pick(...values) {
  return values.find((value) => value !== undefined);
}

function randomValidationKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let raw = "";
  while (raw.length < 12) {
    const bytes = crypto.randomBytes(12);
    raw += Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function nextProtocol(client) {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `INSERT INTO request_protocol_counters (year, next_seq)
     VALUES ($1, 2)
     ON CONFLICT (year)
     DO UPDATE SET next_seq = request_protocol_counters.next_seq + 1
     RETURNING next_seq - 1 AS seq`,
    [year]
  );
  return `${String(rows[0].seq).padStart(6, "0")}/${year}`;
}

async function validationKeyForCpf(client, cpf) {
  const normalizedCpf = normalizeCpf(cpf);
  if (!normalizedCpf) return randomValidationKey();

  const { rows: existing } = await client.query(
    "SELECT validation_key FROM request_validation_keys WHERE cpf = $1",
    [normalizedCpf],
  );
  if (existing[0]?.validation_key) return existing[0].validation_key;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomValidationKey();
    try {
      const { rows } = await client.query(
        `INSERT INTO request_validation_keys (cpf, validation_key)
         VALUES ($1, $2)
         RETURNING validation_key`,
        [normalizedCpf, candidate],
      );
      return rows[0].validation_key;
    } catch (error) {
      if (error?.code !== "23505") throw error;
    }
  }

  throw new Error("Nao foi possivel gerar uma chave de validacao unica.");
}

function parseSignedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeTags(current, next) {
  return [...new Set([...parseJsonArray(current), ...parseJsonArray(next)].filter(Boolean))];
}

function validateStatus(value) {
  return value === undefined || ALLOWED_REQUEST_STATUSES.has(value);
}

function validateTags(value) {
  return parseJsonArray(value).every((tag) => ALLOWED_REQUEST_TAGS.has(tag));
}

router.get("/", auth, async (req, res) => {
  try {
    const query = req.user.role === "tutor"
      ? { text: "SELECT * FROM requests WHERE tutor_id = $1 ORDER BY created_at DESC", values: [req.user.id] }
      : { text: "SELECT * FROM requests ORDER BY created_at DESC", values: [] };
    const { rows } = await pool.query(query.text, query.values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/public/:validationKey", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM requests
       WHERE validation_key = $1
       ORDER BY created_at DESC`,
      [req.params.validationKey]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/consult", async (req, res) => {
  try {
    const { validationKey, cpf } = req.body || {};
    const cleanCpf = normalizeCpf(cpf);
    if (cleanCpf.length !== 11) return res.status(400).json({ error: "CPF obrigatorio para consulta." });
    if (!validationKey) return res.status(400).json({ error: "Chave de consulta obrigatoria." });

    const { rows: keyRows } = await pool.query(
      "SELECT cpf FROM request_validation_keys WHERE cpf = $1 AND validation_key = $2",
      [cleanCpf, validationKey.trim()],
    );
    if (!keyRows[0]) {
      return res.status(404).json({ error: "CPF e chave de validacao nao conferem." });
    }

    const { rows } = await pool.query(
      `SELECT *
       FROM requests
       WHERE regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $1
       ORDER BY created_at DESC`,
      [cleanCpf]
    );
    res.json(rows.map((row) => ({ ...row, validation_key: row.validation_key || validationKey.trim() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", optionalAuth, async (req, res) => {
  const body = req.body || {};
  const tutorId = req.user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const protocol = await nextProtocol(client);
    const cpf = pick(body.cpf, body.tutor_cpf);
    const cleanCpf = normalizeCpf(cpf);
    if (cleanCpf.length !== 11) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "CPF valido e obrigatorio para gerar codigo do tutor." });
    }
    const validationKey = await validationKeyForCpf(client, cpf);
    const animals = Array.isArray(body.animals) ? body.animals : [];
    const firstAnimal = animals[0] || {};
    const scheduleDate = pick(body.schedule_date, body.preferredSchedule, body.appointment);
    const requestType = pick(body.request_type, body.requestType, body.requestTypeId, body.type);

    const { rows } = await client.query(
      `INSERT INTO requests (
        tutor_id,
        protocol,
        validation_key,
        tutor_name,
        tutor_email,
        cpf,
        phone,
        address,
        neighborhood,
        city,
        state,
        cep,
        animal_name,
        species,
        size,
        animal_id,
        animal_microchip,
        animals,
        request_type,
        municipality,
        notes,
        status,
        schedule_date,
        schedule_location_name,
        schedule_address_url,
        schedule_municipality,
        responsible_unit,
        veterinarian,
        signature_data_url,
        signed_at,
        documents,
        tags,
        workflow_data,
        latitude,
        longitude
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
        $19, $20, $21, 'EM_ANALISE', $22, $23, $24, $25,
        $26, $27, $28, $29, $30::jsonb, $31::jsonb, $32::jsonb,
        $33, $34
      )
      RETURNING *`,
      [
        tutorId,
        protocol,
        validationKey,
        pick(body.tutor_name, body.tutorName, body.tutor),
        pick(body.tutor_email, body.tutorEmail, body.email),
        cpf,
        body.phone,
        body.address,
        body.neighborhood,
        body.city,
        body.state,
        body.cep,
        pick(body.animal_name, body.animalName, firstAnimal.name),
        pick(body.species, firstAnimal.species),
        pick(body.size, firstAnimal.size),
        pick(body.animal_id, body.animalId, firstAnimal.id) || null,
        pick(body.animal_microchip, body.animalMicrochip, firstAnimal.microchip) || null,
        JSON.stringify(animals),
        requestType,
        pick(body.municipality, body.scheduleMunicipality),
        body.notes,
        scheduleDate,
        pick(body.schedule_location_name, body.scheduleLocationName),
        pick(body.schedule_address_url, body.scheduleAddressUrl),
        pick(body.schedule_municipality, body.scheduleMunicipality),
        pick(body.responsible_unit, body.responsibleUnit),
        body.veterinarian,
        pick(body.signature_data_url, body.signatureDataUrl),
        parseSignedAt(pick(body.signed_at, body.signedAt)),
        JSON.stringify(Array.isArray(body.documents) ? body.documents : []),
        JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
        JSON.stringify(parseJsonObject(body.workflow_data || body.workflowData)),
        pick(body.latitude, body.lat) || null,
        pick(body.longitude, body.lng) || null,
      ]
    );

    if (rows[0].animal_id) {
      await client.query(
        `INSERT INTO animal_records (animal_id, request_id, record_type, title, notes, data, created_by)
         VALUES ($1, $2, 'SOLICITACAO_PROCEDIMENTO', 'Solicitacao de procedimento aberta', $3, $4::jsonb, $5)`,
        [
          rows[0].animal_id,
          rows[0].id,
          body.notes || null,
          JSON.stringify({ protocol, request_type: requestType || null, animal_microchip: rows[0].animal_microchip || null }),
          req.user?.id || null,
        ],
      );
    }

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch("/:id", auth, async (req, res) => {
  const body = req.body || {};
  const historyNote = body.history_note || body.historyNote || "";
  const workflowKeys = [
    "assignedSectorId",
    "assignedUserId",
    "assignedSectorName",
    "responsible",
    "previousSchedule",
    "rejectionReason",
    "rejectionNote",
  ];
  const columnAliases = {
    assignedSectorName: "assigned_sector",
    responsible: "responsible_unit",
    preferredSchedule: "schedule_date",
    appointment: "schedule_date",
    signatureDataUrl: "signature_data_url",
    signedAt: "signed_at",
    scheduleLocationName: "schedule_location_name",
    scheduleAddressUrl: "schedule_address_url",
    scheduleMunicipality: "schedule_municipality",
    responsibleUnit: "responsible_unit",
    animalId: "animal_id",
    animalMicrochip: "animal_microchip",
    targetTutorName: "target_tutor_name",
    targetTutorEmail: "target_tutor_email",
    targetTutorCpf: "target_tutor_cpf",
    targetTutorPhone: "target_tutor_phone",
    targetTutorAddress: "target_tutor_address",
    targetTutorNeighborhood: "target_tutor_neighborhood",
    targetTutorCity: "target_tutor_city",
    targetTutorState: "target_tutor_state",
    targetTutorCep: "target_tutor_cep",
    deathDate: "death_date",
    deathCause: "death_cause",
  };
  const allowed = [
    "tutor_name", "tutor_email", "cpf", "phone", "address", "neighborhood",
    "city", "state", "cep", "animal_name", "species", "size", "animals",
    "request_type", "municipality", "notes", "status", "schedule_date",
    "schedule_location_name", "schedule_address_url", "schedule_municipality",
    "responsible_unit", "veterinarian", "signature_data_url", "signed_at",
    "documents", "assigned_sector", "tags", "workflow_data",
    "latitude", "longitude", "animal_id", "animal_microchip",
    "target_tutor_name", "target_tutor_email", "target_tutor_cpf",
    "target_tutor_phone", "target_tutor_address", "target_tutor_neighborhood",
    "target_tutor_city", "target_tutor_state", "target_tutor_cep",
    "death_date", "death_cause",
  ];
  const ignoredKeys = new Set(["history_note", "historyNote"]);
  const workflowPatch = {};
  const entries = [];

  if (!validateStatus(body.status)) {
    return res.status(400).json({ error: "Status invalido para solicitacao." });
  }
  if (body.tags !== undefined && !validateTags(body.tags)) {
    return res.status(400).json({ error: "Tag invalida para solicitacao." });
  }

  for (const [key, value] of Object.entries(body)) {
    if (ignoredKeys.has(key)) continue;
    if (workflowKeys.includes(key)) {
      workflowPatch[key] = value;
      continue;
    }
    const column = columnAliases[key] || key;
    if (allowed.includes(column)) entries.push([column, value]);
  }

  const dedupedEntries = Array.from(new Map(entries).entries());

  if (!dedupedEntries.length && !Object.keys(workflowPatch).length && !historyNote) {
    return res.status(400).json({ error: "Nenhum campo válido." });
  }

  try {
    const { rows: existingRows } = await pool.query(
      "SELECT tags, workflow_data FROM requests WHERE id = $1",
      [req.params.id],
    );
    if (!existingRows[0]) return res.status(404).json({ error: "Não encontrado" });

    const currentWorkflow = parseJsonObject(existingRows[0].workflow_data);
    const nextWorkflow = { ...currentWorkflow, ...workflowPatch };
    const preparedEntries = dedupedEntries.map(([key, value]) => {
      if (key === "animals" || key === "documents") return [key, JSON.stringify(Array.isArray(value) ? value : [])];
      if (key === "tags") return [key, JSON.stringify(mergeTags(existingRows[0].tags, value))];
      if (key === "workflow_data") return [key, JSON.stringify({ ...nextWorkflow, ...parseJsonObject(value) })];
      if (key === "signed_at") return [key, parseSignedAt(value)];
      return [key, value];
    });

    if (Object.keys(workflowPatch).length && !dedupedEntries.some(([key]) => key === "workflow_data")) {
      preparedEntries.push(["workflow_data", JSON.stringify(nextWorkflow)]);
    }

    const historyEntry = historyNote
      ? [{ status: body.status, notes: historyNote, by: req.user.id, at: new Date() }]
      : [];
    const keys = preparedEntries.map(([k]) => k);
    const values = preparedEntries.map(([, v]) => v);
    const setParts = keys.map((k, i) => `${k} = $${i + 1}`);
    if (historyEntry.length) {
      values.push(JSON.stringify(historyEntry));
      setParts.push(`history = history || $${values.length}::jsonb`);
    }
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE requests SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM requests WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
