import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { optionalAuth } from "../middleware/auth.js";
import { normalizeCpf } from "../utils.js";
import { isGlobalUser, isInternalUser, pickMunicipalityId } from "../tenant.js";

const router = Router();

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeMicrochip(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function publicAnimal(row) {
  if (!row) return null;
  return {
    id: row.id,
    microchip: row.microchip,
    name: row.name,
    species: row.species,
    sex: row.sex,
    size: row.size,
    breed: row.breed,
    color: row.color,
    status: row.status,
  };
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
    [year],
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

async function fetchAnimalById(client, id) {
  const { rows } = await client.query("SELECT * FROM animals WHERE id = $1", [id]);
  return rows[0] || null;
}

async function fetchAnimalByMicrochip(client, microchip) {
  const { rows } = await client.query("SELECT * FROM animals WHERE microchip = $1", [microchip]);
  return rows[0] || null;
}

async function fetchLegacyAnimalRequest(client, microchip) {
  const { rows } = await client.query(
    `SELECT r.*, elem AS matched_animal
     FROM requests r
     JOIN LATERAL jsonb_array_elements(COALESCE(r.animals, '[]'::jsonb)) elem ON TRUE
     WHERE regexp_replace(upper(COALESCE(elem->>'microchip', '')), '[^A-Z0-9]', '', 'g') = $1
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [microchip],
  );
  return rows[0] || null;
}

async function ensureAnimalFromLegacyRequest(client, microchip) {
  const existing = await fetchAnimalByMicrochip(client, microchip);
  if (existing) return existing;

  const request = await fetchLegacyAnimalRequest(client, microchip);
  if (!request) return null;

  const animalData = request.matched_animal || {};
  const { rows } = await client.query(
    `INSERT INTO animals (microchip, name, species, sex, size, breed, color, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (microchip)
     DO UPDATE SET
       name = COALESCE(animals.name, EXCLUDED.name),
       species = COALESCE(animals.species, EXCLUDED.species),
       sex = COALESCE(animals.sex, EXCLUDED.sex),
       size = COALESCE(animals.size, EXCLUDED.size),
       updated_at = NOW()
     RETURNING *`,
    [
      microchip,
      pick(animalData.name, request.animal_name),
      pick(animalData.species, request.species),
      animalData.sex || null,
      pick(animalData.size, request.size),
      animalData.breed || null,
      animalData.color || null,
      JSON.stringify({ source: "requests", request_id: request.id }),
    ],
  );
  const animal = rows[0];

  const cpf = normalizeCpf(request.cpf);
  if (cpf) {
    await client.query(
      `INSERT INTO animal_tutors (
        animal_id, user_id, tutor_name, tutor_email, cpf, phone, address,
        neighborhood, city, state, cep, active, started_at
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, COALESCE($12, NOW())
      WHERE NOT EXISTS (
        SELECT 1 FROM animal_tutors WHERE animal_id = $1 AND cpf = $5 AND active = TRUE
      )`,
      [
        animal.id,
        request.tutor_id,
        request.tutor_name,
        request.tutor_email,
        cpf,
        request.phone,
        request.address,
        request.neighborhood,
        request.city,
        request.state,
        request.cep,
        request.created_at,
      ],
    );
  }

  await client.query(
    `INSERT INTO animal_records (animal_id, request_id, municipality_id, record_type, title, data, occurred_at)
     SELECT $1, $2, $3, 'IMPORTACAO_SOLICITACAO', 'Animal vinculado por microchip', $4::jsonb, COALESCE($5, NOW())
     WHERE NOT EXISTS (
       SELECT 1 FROM animal_records
       WHERE animal_id = $1 AND request_id = $2 AND record_type = 'IMPORTACAO_SOLICITACAO'
     )`,
    [
      animal.id,
      request.id,
      request.municipality_id,
      JSON.stringify({ protocol: request.protocol, microchip }),
      request.created_at,
    ],
  );

  return animal;
}

async function isCredentialAuthorizedForAnimal(client, animalId, cpf, validationKey) {
  const cleanCpf = normalizeCpf(cpf);
  const cleanKey = String(validationKey || "").trim();
  if (cleanCpf.length !== 11 || !cleanKey) return false;

  const { rows: keyRows } = await client.query(
    "SELECT 1 FROM request_validation_keys WHERE cpf = $1 AND validation_key = $2",
    [cleanCpf, cleanKey],
  );
  if (!keyRows[0]) return false;

  const { rows: tutorRows } = await client.query(
    `SELECT 1
     FROM animal_tutors
     WHERE animal_id = $1
       AND active = TRUE
       AND regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $2
     LIMIT 1`,
    [animalId, cleanCpf],
  );
  return Boolean(tutorRows[0]);
}

async function isUserAuthorizedForAnimal(client, user, animal) {
  if (!user) return false;
  if (isGlobalUser(user)) return true;

  if (isInternalUser(user)) {
    const municipalityId = user.municipalityId || user.municipality_id || null;
    const { rows: recordRows } = await client.query(
      "SELECT DISTINCT municipality_id FROM animal_records WHERE animal_id = $1 AND municipality_id IS NOT NULL",
      [animal.id],
    );
    // Animal sem histórico de prefeitura (ex: recém-identificado por microchip):
    // qualquer usuário interno pode operar — será o primeiro vínculo registrado.
    if (recordRows.length === 0) return true;
    // Animal já vinculado a alguma prefeitura: só a equipe interna dessa mesma
    // prefeitura pode operar, preservando isolamento multi-tenant.
    return recordRows.some((row) => row.municipality_id === municipalityId);
  }

  const { rows } = await client.query(
    `SELECT 1
     FROM animal_tutors
     WHERE animal_id = $1
       AND active = TRUE
       AND user_id = $2
     LIMIT 1`,
    [animal.id, user.id],
  );
  return Boolean(rows[0]);
}

async function ensureAuthorized(client, req, animal) {
  if (await isUserAuthorizedForAnimal(client, req.user, animal)) return true;
  return isCredentialAuthorizedForAnimal(client, animal.id, req.body?.cpf, req.body?.validationKey);
}

async function fetchActiveTutor(client, animalId) {
  const { rows } = await client.query(
    `SELECT *
     FROM animal_tutors
     WHERE animal_id = $1 AND active = TRUE
     ORDER BY started_at DESC, created_at DESC
     LIMIT 1`,
    [animalId],
  );
  return rows[0] || null;
}

async function buildAnimalHistory(client, animal) {
  const { rows: records } = await client.query(
    `SELECT id, request_id, record_type, title, notes, data, occurred_at, created_at
     FROM animal_records
     WHERE animal_id = $1
     ORDER BY occurred_at DESC, created_at DESC`,
    [animal.id],
  );

  const { rows: requests } = await client.query(
    `SELECT id, protocol, request_type, status, notes, death_date, death_cause,
            tutor_name, tutor_email, cpf, phone, address, neighborhood, city, state, cep,
            animal_name, animal_microchip, species, size, animals, municipality, municipality_id,
            target_tutor_name, target_tutor_cpf, schedule_date, schedule_location_name,
            schedule_address, schedule_address_url, schedule_municipality,
            responsible_unit, veterinarian, workflow_data, history, documents,
            signature_data_url, signed_at, created_at, updated_at
     FROM requests r
     WHERE (r.animal_id = $1
        OR regexp_replace(upper(COALESCE(r.animal_microchip, '')), '[^A-Z0-9]', '', 'g') = $2
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(r.animals, '[]'::jsonb)) elem
          WHERE regexp_replace(upper(COALESCE(elem->>'microchip', '')), '[^A-Z0-9]', '', 'g') = $2
        ))
     ORDER BY created_at DESC`,
    [animal.id, animal.microchip],
  );

  const recordEntries = records.map((record) => ({
    source: "animal_records",
    type: record.record_type,
    title: record.title,
    notes: record.notes,
    data: record.data || {},
    request_id: record.request_id,
    occurred_at: record.occurred_at || record.created_at,
  }));

  const requestEntries = requests.map((request) => ({
    source: "requests",
    type: request.request_type || "SOLICITACAO",
    title: request.protocol ? `Solicitacao ${request.protocol}` : "Solicitacao",
    status: request.status,
    notes: request.notes,
    request_id: request.id,
    protocol: request.protocol,
    data: {
      registration: {
        protocol: request.protocol,
        request_type: request.request_type,
        status: request.status,
        tutor_name: request.tutor_name,
        tutor_email: request.tutor_email,
        cpf: request.cpf,
        phone: request.phone,
        address: request.address,
        neighborhood: request.neighborhood,
        city: request.city,
        state: request.state,
        cep: request.cep,
        animal_name: request.animal_name,
        animal_microchip: request.animal_microchip,
        species: request.species,
        size: request.size,
        animals: request.animals || [],
        municipality: request.municipality,
        municipality_id: request.municipality_id,
        schedule_date: request.schedule_date,
        schedule_location_name: request.schedule_location_name,
        schedule_address: request.schedule_address,
        schedule_address_url: request.schedule_address_url,
        schedule_municipality: request.schedule_municipality,
        responsible_unit: request.responsible_unit,
        veterinarian: request.veterinarian,
        notes: request.notes,
        documents: request.documents || [],
        signature_data_url: request.signature_data_url,
        signed_at: request.signed_at,
        created_at: request.created_at,
        updated_at: request.updated_at,
        workflow_data: request.workflow_data || {},
      },
      workflow_data: request.workflow_data || {},
      history: request.history || [],
      schedule_date: request.schedule_date,
      schedule_location_name: request.schedule_location_name,
      schedule_address: request.schedule_address,
      responsible_unit: request.responsible_unit,
      veterinarian: request.veterinarian,
      death_date: request.death_date,
      death_cause: request.death_cause,
      target_tutor_name: request.target_tutor_name,
      target_tutor_cpf: request.target_tutor_cpf,
    },
    occurred_at: request.created_at || request.updated_at,
  }));

  return [...recordEntries, ...requestEntries].sort(
    (a, b) => new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime(),
  );
}

router.post("/lookup", async (req, res) => {
  const microchip = normalizeMicrochip(req.body?.microchip);
  if (microchip.length < 4 || microchip.length > 32) {
    return res.status(400).json({ error: "Microchip invalido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await ensureAnimalFromLegacyRequest(client, microchip);
    await client.query("COMMIT");

    if (!animal) return res.status(404).json({ error: "Animal nao encontrado." });
    res.json({ found: true, animal: publicAnimal(animal) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/consult", optionalAuth, async (req, res) => {
  const microchip = normalizeMicrochip(req.body?.microchip);
  if (microchip.length < 4 || microchip.length > 32) {
    return res.status(400).json({ error: "Microchip invalido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await ensureAnimalFromLegacyRequest(client, microchip);
    if (!animal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal nao encontrado." });
    }

    const cleanCpf = normalizeCpf(req.body?.cpf);
    const cleanKey = String(req.body?.validationKey || "").trim();
    const hasCredential = cleanCpf.length === 11 && !/^0+$/.test(cleanCpf) && Boolean(cleanKey);
    const authorized = hasCredential ? await ensureAuthorized(client, req, animal) : true;
    if (!authorized) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Consulta nao autorizada para este animal." });
    }

    const tutor = await fetchActiveTutor(client, animal.id);
    const history = await buildAnimalHistory(client, animal);
    await client.query("COMMIT");

    res.json({
      animal,
      tutor,
      history,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/:id/death", optionalAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await fetchAnimalById(client, req.params.id);
    if (!animal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal nao encontrado." });
    }

    const authorized = await ensureAuthorized(client, req, animal);
    if (!authorized) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Solicitacao nao autorizada para este animal." });
    }

    const tutor = await fetchActiveTutor(client, animal.id);
    const protocol = await nextProtocol(client);
    const cpf = pick(req.body?.cpf, tutor?.cpf);
    const validationKey = await validationKeyForCpf(client, cpf);
    const deathDate = pick(req.body?.death_date, req.body?.deathDate);
    const deathCause = pick(req.body?.death_cause, req.body?.deathCause);
    if (!deathDate || !String(deathCause || "").trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Data e causa do obito sao obrigatorias." });
    }
    const notes = req.body?.notes || null;
    const workflowData = {
      animal_request_type: "death",
      death_date: deathDate || null,
      death_cause: deathCause || null,
    };

    const municipalityId = pickMunicipalityId(req);
    if (!municipalityId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Municipio obrigatorio para esta operacao." });
    }

    const { rows } = await client.query(
      `INSERT INTO requests (
        tutor_id, protocol, validation_key, tutor_name, tutor_email, cpf, phone,
        address, neighborhood, city, state, cep, animal_id, animal_microchip,
        animal_name, species, size, animals, request_type, notes, status,
        death_date, death_cause, tags, workflow_data, municipality_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
        'ANIMAL_OBITO', $19, 'NOVA', $20, $21, $22::jsonb, $23::jsonb, $24
      )
      RETURNING *`,
      [
        req.user?.id || tutor?.user_id || null,
        protocol,
        validationKey,
        pick(req.body?.tutor_name, req.body?.tutorName, tutor?.tutor_name),
        pick(req.body?.tutor_email, req.body?.tutorEmail, tutor?.tutor_email),
        cpf,
        pick(req.body?.phone, tutor?.phone),
        pick(req.body?.address, tutor?.address),
        pick(req.body?.neighborhood, tutor?.neighborhood),
        pick(req.body?.city, tutor?.city),
        pick(req.body?.state, tutor?.state),
        pick(req.body?.cep, tutor?.cep),
        animal.id,
        animal.microchip,
        animal.name,
        animal.species,
        animal.size,
        JSON.stringify([{ id: animal.id, microchip: animal.microchip, name: animal.name, species: animal.species, size: animal.size }]),
        notes,
        deathDate || null,
        deathCause || null,
        JSON.stringify(["MICROCHIP", "OBITO"]),
        JSON.stringify(workflowData),
        municipalityId,
      ],
    );

    await client.query(
      `INSERT INTO animal_records (animal_id, request_id, municipality_id, record_type, title, notes, data, created_by)
       VALUES ($1, $2, $3, 'SOLICITACAO_OBITO', 'Solicitacao de obito aberta', $4, $5::jsonb, $6)`,
      [
        animal.id,
        rows[0].id,
        municipalityId,
        notes,
        JSON.stringify({ protocol, death_date: deathDate || null, death_cause: deathCause || null }),
        req.user?.id || null,
      ],
    );

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/:id/transfer", optionalAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await fetchAnimalById(client, req.params.id);
    if (!animal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal nao encontrado." });
    }

    const authorized = await ensureAuthorized(client, req, animal);
    if (!authorized) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Solicitacao nao autorizada para este animal." });
    }

    const tutor = await fetchActiveTutor(client, animal.id);
    const targetCpf = normalizeCpf(pick(req.body?.target_tutor_cpf, req.body?.targetTutorCpf, req.body?.newTutorCpf));
    const targetName = pick(req.body?.target_tutor_name, req.body?.targetTutorName, req.body?.newTutorName);
    if (!targetName || targetCpf.length !== 11) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nome e CPF do novo tutor sao obrigatorios." });
    }

    const protocol = await nextProtocol(client);
    const cpf = pick(req.body?.cpf, tutor?.cpf);
    const validationKey = await validationKeyForCpf(client, cpf);
    const notes = req.body?.notes || null;
    const target = {
      name: targetName,
      email: pick(req.body?.target_tutor_email, req.body?.targetTutorEmail, req.body?.newTutorEmail),
      cpf: targetCpf,
      phone: pick(req.body?.target_tutor_phone, req.body?.targetTutorPhone, req.body?.newTutorPhone),
      address: pick(req.body?.target_tutor_address, req.body?.targetTutorAddress, req.body?.newTutorAddress),
      neighborhood: pick(req.body?.target_tutor_neighborhood, req.body?.targetTutorNeighborhood, req.body?.newTutorNeighborhood),
      city: pick(req.body?.target_tutor_city, req.body?.targetTutorCity, req.body?.newTutorCity),
      state: pick(req.body?.target_tutor_state, req.body?.targetTutorState, req.body?.newTutorState),
      cep: pick(req.body?.target_tutor_cep, req.body?.targetTutorCep, req.body?.newTutorCep),
    };
    const workflowData = { animal_request_type: "transfer", target_tutor: target };
    const municipalityId = pickMunicipalityId(req);
    if (!municipalityId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Municipio obrigatorio para esta operacao." });
    }

    const { rows } = await client.query(
      `INSERT INTO requests (
        tutor_id, protocol, validation_key, tutor_name, tutor_email, cpf, phone,
        address, neighborhood, city, state, cep, animal_id, animal_microchip,
        animal_name, species, size, animals, request_type, notes, status,
        target_tutor_name, target_tutor_email, target_tutor_cpf, target_tutor_phone,
        target_tutor_address, target_tutor_neighborhood, target_tutor_city,
        target_tutor_state, target_tutor_cep, tags, workflow_data, municipality_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
        'TROCA_TUTOR', $19, 'NOVA', $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29::jsonb, $30::jsonb, $31
      )
      RETURNING *`,
      [
        req.user?.id || tutor?.user_id || null,
        protocol,
        validationKey,
        pick(req.body?.tutor_name, req.body?.tutorName, tutor?.tutor_name),
        pick(req.body?.tutor_email, req.body?.tutorEmail, tutor?.tutor_email),
        cpf,
        pick(req.body?.phone, tutor?.phone),
        pick(req.body?.address, tutor?.address),
        pick(req.body?.neighborhood, tutor?.neighborhood),
        pick(req.body?.city, tutor?.city),
        pick(req.body?.state, tutor?.state),
        pick(req.body?.cep, tutor?.cep),
        animal.id,
        animal.microchip,
        animal.name,
        animal.species,
        animal.size,
        JSON.stringify([{ id: animal.id, microchip: animal.microchip, name: animal.name, species: animal.species, size: animal.size }]),
        notes,
        target.name,
        target.email,
        target.cpf,
        target.phone,
        target.address,
        target.neighborhood,
        target.city,
        target.state,
        target.cep,
        JSON.stringify(["MICROCHIP", "TROCA_TUTOR"]),
        JSON.stringify(workflowData),
        municipalityId,
      ],
    );

    await client.query(
      `INSERT INTO animal_records (animal_id, request_id, municipality_id, record_type, title, notes, data, created_by)
       VALUES ($1, $2, $3, 'SOLICITACAO_TROCA_TUTOR', 'Solicitacao de troca de tutor aberta', $4, $5::jsonb, $6)`,
      [
        animal.id,
        rows[0].id,
        municipalityId,
        notes,
        JSON.stringify({ protocol, target_tutor: target }),
        req.user?.id || null,
      ],
    );

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
