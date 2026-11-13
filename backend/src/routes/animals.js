import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { optionalAuth } from "../middleware/auth.js";
import { normalizeCpf, isValidCpf } from "../utils.js";
import { isInternalUser, pickMunicipalityId } from "../tenant.js";

const router = Router();

function requireAnimalContext(req, res, next) {
  if (!pickMunicipalityId(req)) return res.status(400).json({ error: "Município obrigatório para esta operação." });
  if (!req.user && (!isValidCpf(req.body?.cpf) || !String(req.body?.validationKey || "").trim())) {
    return res.status(403).json({ error: "Autenticação ou credenciais de consulta obrigatórias." });
  }
  next();
}

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

async function fetchAnimalById(client, id, municipalityId) {
  const { rows } = await client.query(
    "SELECT a.* FROM animals a WHERE a.id = $1 AND EXISTS (SELECT 1 FROM animal_records ar WHERE ar.animal_id = a.id AND ar.municipality_id = $2)",
    [id, municipalityId],
  );
  return rows[0] || null;
}

async function fetchAnimalByMicrochip(client, microchip, municipalityId) {
  const { rows } = await client.query(
    "SELECT a.* FROM animals a WHERE a.microchip = $1 AND EXISTS (SELECT 1 FROM animal_records ar WHERE ar.animal_id = a.id AND ar.municipality_id = $2)",
    [microchip, municipalityId],
  );
  return rows[0] || null;
}

function requestOwnerScope(req, alias, parameter) {
  if (isInternalUser(req.user)) return { sql: "", values: [] };
  return req.user
    ? { sql: ` AND ${alias}.tutor_id = $${parameter}`, values: [req.user.id] }
    : { sql: ` AND regexp_replace(COALESCE(${alias}.cpf, ''), '\\D', '', 'g') = $${parameter}`, values: [normalizeCpf(req.body?.cpf)] };
}

async function fetchLegacyAnimalRequest(client, microchip, req) {
  const owner = requestOwnerScope(req, "r", 3);
  const { rows } = await client.query(
    `SELECT r.*, elem AS matched_animal
     FROM requests r
     JOIN LATERAL jsonb_array_elements(COALESCE(r.animals, '[]'::jsonb)) elem ON TRUE
     WHERE regexp_replace(upper(COALESCE(elem->>'microchip', '')), '[^A-Z0-9]', '', 'g') = $1
       AND r.municipality_id = $2${owner.sql}
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [microchip, pickMunicipalityId(req), ...owner.values],
  );
  return rows[0] || null;
}

async function ensureAnimalFromLegacyRequest(client, microchip, req) {
  const existing = await fetchAnimalByMicrochip(client, microchip, pickMunicipalityId(req));
  if (existing) return existing;

  // An externally submitted microchip is not proof of ownership of an existing animal.
  if (!isInternalUser(req.user)) return null;
  const request = await fetchLegacyAnimalRequest(client, microchip, req);
  if (!request) return null;

  const animalData = request.matched_animal || {};
  const { rows } = await client.query(
    `INSERT INTO animals (microchip, name, species, sex, size, breed, color, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (microchip) DO NOTHING
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
  if (!animal) return null;

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

async function hasLegacyCredential(client, cpf, validationKey) {
  const cleanCpf = normalizeCpf(cpf);
  const cleanKey = String(validationKey || "").trim();
  if (!isValidCpf(cleanCpf) || !cleanKey) return false;

  const { rows: keyRows } = await client.query(
    "SELECT 1 FROM request_validation_keys WHERE cpf = $1 AND validation_key = $2",
    [cleanCpf, cleanKey],
  );
  return Boolean(keyRows[0]);
}

async function isCredentialAuthorizedForAnimal(client, animalId, cpf, validationKey, municipalityId) {
  const cleanCpf = normalizeCpf(cpf);
  if (!municipalityId || !await hasLegacyCredential(client, cpf, validationKey)) return false;
  const { rows: tutorRows } = await client.query(
    `SELECT 1
     FROM animal_tutors
     WHERE animal_id = $1
       AND active = TRUE
       AND regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $2
       AND EXISTS (SELECT 1 FROM animal_records ar JOIN requests r ON r.id = ar.request_id
         WHERE ar.animal_id = $1 AND ar.municipality_id = $3
           AND regexp_replace(COALESCE(r.cpf, ''), '\\D', '', 'g') = $2)
     LIMIT 1`,
    [animalId, cleanCpf, municipalityId],
  );
  return Boolean(tutorRows[0]);
}

async function isUserAuthorizedForAnimal(client, user, animal, municipalityId) {
  if (!user) return false;
  if (isInternalUser(user)) {
    const { rows: recordRows } = await client.query(
      "SELECT 1 FROM animal_records WHERE animal_id = $1 AND municipality_id = $2 LIMIT 1",
      [animal.id, municipalityId],
    );
    return recordRows.length > 0;
  }

  const { rows } = await client.query(
    `SELECT 1
     FROM animal_tutors at
     JOIN users u ON u.id = at.user_id
     WHERE at.animal_id = $1
       AND at.active = TRUE
       AND at.user_id = $2 AND u.municipality_id = $3
     LIMIT 1`,
    [animal.id, user.id, municipalityId],
  );
  return Boolean(rows[0]);
}

async function ensureAuthorized(client, req, animal) {
  const municipalityId = pickMunicipalityId(req);
  if (await isUserAuthorizedForAnimal(client, req.user, animal, municipalityId)) return true;
  return isCredentialAuthorizedForAnimal(client, animal.id, req.body?.cpf, req.body?.validationKey, municipalityId);
}

async function fetchActiveTutor(client, animalId, req) {
  const owner = isInternalUser(req.user) ? { sql: "", values: [] }
    : req.user ? { sql: " AND at.user_id = $3", values: [req.user.id] }
    : { sql: " AND regexp_replace(COALESCE(at.cpf, ''), '\\D', '', 'g') = $3", values: [normalizeCpf(req.body?.cpf)] };
  const { rows } = await client.query(
    `SELECT at.*
     FROM animal_tutors at
     WHERE at.animal_id = $1 AND at.active = TRUE${owner.sql}
       AND EXISTS (SELECT 1 FROM animal_records ar JOIN requests r ON r.id = ar.request_id
         WHERE ar.animal_id = $1 AND ar.municipality_id = $2
           AND regexp_replace(COALESCE(r.cpf, ''), '\\D', '', 'g') = regexp_replace(COALESCE(at.cpf, ''), '\\D', '', 'g'))
     ORDER BY at.started_at DESC, at.created_at DESC
     LIMIT 1`,
    [animalId, pickMunicipalityId(req), ...owner.values],
  );
  return rows[0] || null;
}

async function buildAnimalHistory(client, animal, req) {
  const recordOwner = requestOwnerScope(req, "r", 3);
  const { rows: records } = await client.query(
    `SELECT id, request_id, record_type, title, notes, data, occurred_at, created_at
     FROM animal_records ar
     WHERE animal_id = $1 AND municipality_id = $2
       ${recordOwner.sql ? `AND EXISTS (SELECT 1 FROM requests r WHERE r.id = ar.request_id${recordOwner.sql})` : ""}
     ORDER BY occurred_at DESC, created_at DESC`,
    [animal.id, pickMunicipalityId(req), ...recordOwner.values],
  );

  const requestOwner = requestOwnerScope(req, "r", 4);
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
        )) AND r.municipality_id = $3${requestOwner.sql}
     ORDER BY created_at DESC`,
    [animal.id, animal.microchip, pickMunicipalityId(req), ...requestOwner.values],
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

router.post("/lookup", optionalAuth, requireAnimalContext, async (req, res) => {
  const microchip = normalizeMicrochip(req.body?.microchip);
  if (microchip.length < 4 || microchip.length > 32) {
    return res.status(400).json({ error: "Microchip invalido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await ensureAnimalFromLegacyRequest(client, microchip, req);
    if (!animal || !await ensureAuthorized(client, req, animal)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal não encontrado ou consulta não autorizada." });
    }
    await client.query("COMMIT");
    res.json({ found: true, animal: publicAnimal(animal) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/consult", optionalAuth, requireAnimalContext, async (req, res) => {
  const microchip = normalizeMicrochip(req.body?.microchip);
  if (microchip.length < 4 || microchip.length > 32) {
    return res.status(400).json({ error: "Microchip invalido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await ensureAnimalFromLegacyRequest(client, microchip, req);
    if (!animal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal nao encontrado." });
    }

    const authorized = await ensureAuthorized(client, req, animal);
    if (!authorized) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Consulta nao autorizada para este animal." });
    }

    const tutor = await fetchActiveTutor(client, animal.id, req);
    const history = await buildAnimalHistory(client, animal, req);
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

router.post("/:id/death", optionalAuth, requireAnimalContext, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await fetchAnimalById(client, req.params.id, pickMunicipalityId(req));
    if (!animal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal nao encontrado." });
    }

    const authorized = await ensureAuthorized(client, req, animal);
    if (!authorized) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Solicitacao nao autorizada para este animal." });
    }

    const tutor = await fetchActiveTutor(client, animal.id, req);
    const protocol = await nextProtocol(client);
    const cpf = pick(tutor?.cpf, req.user?.cpf, req.body?.cpf);
    const validationKey = randomValidationKey();
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
        req.user && !isInternalUser(req.user) ? req.user.id : tutor?.user_id || null,
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

router.post("/:id/transfer", optionalAuth, requireAnimalContext, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const animal = await fetchAnimalById(client, req.params.id, pickMunicipalityId(req));
    if (!animal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Animal nao encontrado." });
    }

    const authorized = await ensureAuthorized(client, req, animal);
    if (!authorized) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Solicitacao nao autorizada para este animal." });
    }

    const tutor = await fetchActiveTutor(client, animal.id, req);
    const targetCpf = normalizeCpf(pick(req.body?.target_tutor_cpf, req.body?.targetTutorCpf, req.body?.newTutorCpf));
    const targetName = pick(req.body?.target_tutor_name, req.body?.targetTutorName, req.body?.newTutorName);
    if (!targetName || targetCpf.length !== 11) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nome e CPF do novo tutor sao obrigatorios." });
    }

    const protocol = await nextProtocol(client);
    const cpf = pick(tutor?.cpf, req.user?.cpf, req.body?.cpf);
    const validationKey = randomValidationKey();
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
        req.user && !isInternalUser(req.user) ? req.user.id : tutor?.user_id || null,
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
