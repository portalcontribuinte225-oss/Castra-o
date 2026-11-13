import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { normalizeCpf, isValidCpf } from "../utils.js";
import { isGlobalUser, isInternalUser, requireMunicipality } from "../tenant.js";
import { DeliveryStatus } from "../../../shared/notification-contract.js";
import { loadRequestSettings, loadDocumentReviewSettings } from "../repositories/request-settings.js";
import { prepareRequestSubmission, mergeProtectedWorkflow } from "../services/request-submission.js";
import { notifyRequestChanges } from "../services/request-change-notifications.js";
import { enrollTutorForRequest } from "../services/auth/tutor-enrollment.js";
import { deliverAuthMessage } from "../services/auth/auth-message-delivery.js";
import { AuthPurpose } from "../../../shared/auth-contract.js";
import { validateRequestAnimalLink } from "../services/request-animal-link.js";
import { prepareRegisteredRequest, registerRequestAnimals } from "../services/registered-animals/registered-request.js";
import { applyAnimalRequestTransition } from "../services/registered-animals/animal-transitions.js";
import { prepareRequestDocuments, assertMaterializedRequestSize } from "../services/documents/request-documents.js";
import { applyDocumentReviews, decorateRequestDocuments } from "../services/documents/document-reviews.js";
import { lockMunicipalSchedule } from "../services/schedule/schedule-lock.js";
import { reserveRequestSchedule, bookingChanged } from "../services/schedule/schedule-booking.js";
import { isProcedureRequest, RequestStatus } from "../../../shared/request-contract.js";

const router = Router();
const ALLOWED_REQUEST_STATUSES = new Set(Object.values(RequestStatus));
const ALLOWED_REQUEST_TAGS = new Set([
  "ATRIBUIDA",
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

function withoutValidationKey(request) {
  const visible = { ...request };
  delete visible.validation_key;
  delete visible.validationKey;
  return visible;
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
      ? { text: "SELECT * FROM requests WHERE tutor_id = $1 AND municipality_id = $2 ORDER BY created_at DESC", values: [req.user.id, req.user.municipalityId] }
      : isGlobalUser(req.user)
      ? { text: "SELECT * FROM requests ORDER BY created_at DESC", values: [] }
      : { text: "SELECT * FROM requests WHERE municipality_id = $1 ORDER BY created_at DESC", values: [req.user.municipalityId] };
    const { rows } = await pool.query(query.text, query.values);
    const catalogs = await loadDocumentReviewSettings(rows.filter((row) => row.documents?.length).map((row) => row.municipality_id));
    const visible = rows.map((row) => row.documents?.length ? decorateRequestDocuments(row, catalogs.get(row.municipality_id)) : row);
    res.json(req.user.role === "tutor" ? visible.map(withoutValidationKey) : visible);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/public/:validationKey", async (req, res) => {
  try {
    const municipalityId = requireMunicipality(req, res);
    if (!municipalityId) return;
    const values = [req.params.validationKey, municipalityId];
    const scope = " AND municipality_id = $2";
    const { rows } = await pool.query(
      `SELECT * FROM requests WHERE validation_key = $1${scope} ORDER BY created_at DESC`,
      values
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/consult", async (req, res) => {
  try {
    const { validationKey, cpf, municipalityId } = req.body || {};
    if (!municipalityId) return res.status(400).json({ error: "Município obrigatório para consulta." });
    const cleanCpf = normalizeCpf(cpf);
    if (!isValidCpf(cleanCpf)) return res.status(400).json({ error: "CPF obrigatorio para consulta." });
    if (!validationKey) return res.status(400).json({ error: "Chave de consulta obrigatoria." });

    const { rows: keyRows } = await pool.query(
      "SELECT cpf FROM request_validation_keys WHERE cpf = $1 AND validation_key = $2",
      [cleanCpf, validationKey.trim()],
    );
    if (!keyRows[0]) {
      return res.status(404).json({ error: "CPF e chave de validacao nao conferem." });
    }

    const scope = municipalityId ? " AND municipality_id = $2" : "";
    const values = municipalityId ? [cleanCpf, municipalityId] : [cleanCpf];
    const { rows } = await pool.query(
      `SELECT * FROM requests WHERE regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $1${scope} ORDER BY created_at DESC`,
      values
    );
    res.json(rows.map((row) => ({ ...row, validation_key: row.validation_key || validationKey.trim() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", optionalAuth, async (req, res) => {
  let body = req.body || {};
  const municipalityId = requireMunicipality(req, res);
  if (!municipalityId) return;
  let client;
  let committed = false;
  let released = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await lockMunicipalSchedule(client, municipalityId);
    const settings = await loadRequestSettings(municipalityId, client);
    body = await prepareRegisteredRequest(client, { body, user: req.user, municipalityId, settings });
    const { cpf, workflow: submittedWorkflow, requestType, internal, tutorRequired } = prepareRequestSubmission({
      body, user: req.user, municipalityId,
      workflow: parseJsonObject(body.workflow_data || body.workflowData), settings,
    });
    body = { ...body, request_type: requestType };
    await validateRequestAnimalLink(client, { body, user: req.user, municipalityId });
    body = await reserveRequestSchedule(client, { body: { ...body, status: RequestStatus.NEW, workflow_data: submittedWorkflow }, municipalityId, settings, user: req.user });
    const workflow = body.workflow_data;
    const selectedType = settings.requestTypes.find((item) => item.id === body.requestTypeId || item.name === requestType || item.id === requestType);
    if (selectedType) workflow.requestTypeId = selectedType.id;
    else delete workflow.requestTypeId;
    const { tutorId, enrollment } = await enrollTutorForRequest(client, {
      body: { ...body, cpf }, workflow, municipalityId, user: req.user, ip: req.ip,
      tutorRequired: tutorRequired && !internal && requestType !== "DENUNCIA",
    });
    const protocol = await nextProtocol(client);
    const validationKey = randomValidationKey();
    const requestId = crypto.randomUUID();
    const animals = Array.isArray(body.animals) ? body.animals : [];
    const firstAnimal = animals[0] || {};
    const scheduleDate = pick(body.schedule_date, body.preferredSchedule, body.appointment);

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
        municipality_id,
        notes,
        status,
        schedule_date,
        schedule_location_name,
        schedule_address,
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
        longitude,
        origin,
        is_confidential,
        id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
        $19, $20, $21, $22, 'NOVA', $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32::jsonb, $33::jsonb, $34::jsonb,
        $35, $36, $37, $38, $39
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
        municipalityId,
        body.notes,
        scheduleDate,
        pick(body.schedule_location_name, body.scheduleLocationName),
        pick(body.schedule_address, body.scheduleAddress),
        pick(body.schedule_address_url, body.scheduleAddressUrl),
        pick(body.schedule_municipality, body.scheduleMunicipality),
        pick(body.responsible_unit, body.responsibleUnit),
        body.veterinarian,
        !internal && isProcedureRequest(requestType) ? null : pick(body.signature_data_url, body.signatureDataUrl),
        !internal && isProcedureRequest(requestType) ? (body.declarationAccepted === true ? new Date() : null) : parseSignedAt(pick(body.signed_at, body.signedAt)),
        JSON.stringify([]),
        JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
        JSON.stringify(workflow),
        pick(body.latitude, body.lat) || null,
        pick(body.longitude, body.lng) || null,
        internal ? "INTERNA" : "PUBLICA",
        Boolean(body.is_confidential || body.isConfidential),
        requestId,
      ]
    );

    rows[0] = await registerRequestAnimals(client, { body, request: rows[0], user: req.user, tutorId, municipalityId });
    rows[0].documents = await prepareRequestDocuments(client, {
      body, user: req.user, tutorId, municipalityId, settings, requestId,
      animalIds: (rows[0].animals || []).map((animal) => animal.id).filter(Boolean),
    });
    assertMaterializedRequestSize(rows[0]);
    await client.query("UPDATE requests SET documents = $1::jsonb WHERE id = $2 AND municipality_id = $3", [JSON.stringify(rows[0].documents), requestId, municipalityId]);

    await client.query("COMMIT");
    committed = true;
    client.release();
    released = true;
    if (enrollment) {
      try {
        enrollment.delivery = await deliverAuthMessage({
          purpose: AuthPurpose.INITIAL_PASSWORD, municipalityId,
          user: { name: rows[0].tutor_name },
          email: workflow.followUp?.enabled ? workflow.followUp.email : "",
          phone: workflow.followUp?.enabled ? workflow.followUp.phone : "",
          temporaryPassword: enrollment.temporaryPassword,
        });
      } catch {
        enrollment.delivery = [{ status: DeliveryStatus.FAILED, reason: "Acesso criado; não foi possível enviar a senha inicial." }];
      }
    }
    res.set("Cache-Control", "no-store");
    res.status(201).json({ request: withoutValidationKey(rows[0]), ...(enrollment ? { enrollment } : {}) });
  } catch (err) {
    if (client && !committed) await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.status ? err.message : "Não foi possível salvar a solicitação." });
  } finally {
    if (client && !released) client.release();
  }
});

router.patch("/:id", auth, async (req, res) => {
  if (!isInternalUser(req.user)) return res.status(403).json({ error: "Operação restrita à equipe de atendimento." });
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
    "scheduleTime",
    "scheduleSlotTime",
    "scheduleOccurrenceKey",
  ];
  const columnAliases = {
    assignedSectorName: "assigned_sector",
    responsible: "responsible_unit",
    preferredSchedule: "schedule_date",
    appointment: "schedule_date",
    signatureDataUrl: "signature_data_url",
    signedAt: "signed_at",
    scheduleLocationName: "schedule_location_name",
    scheduleAddress: "schedule_address",
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
    "schedule_location_name", "schedule_address", "schedule_address_url", "schedule_municipality",
    "responsible_unit", "veterinarian", "signature_data_url", "signed_at",
    "documents", "assigned_sector", "tags", "workflow_data",
    "latitude", "longitude", "animal_id", "animal_microchip",
    "target_tutor_name", "target_tutor_email", "target_tutor_cpf",
    "target_tutor_phone", "target_tutor_address", "target_tutor_neighborhood",
    "target_tutor_city", "target_tutor_state", "target_tutor_cep",
    "death_date", "death_cause", "origin",
  ];
  const ignoredKeys = new Set(["history_note", "historyNote", "documentReviews"]);
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

  if (!dedupedEntries.length && !Object.keys(workflowPatch).length && !historyNote && body.documentReviews === undefined) {
    return res.status(400).json({ error: "Nenhum campo válido." });
  }

  let client;
  let committed = false;
  let released = false;
  let savedRequest;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const scope = isGlobalUser(req.user) ? "" : " AND municipality_id = $2";
    const scopeValues = isGlobalUser(req.user) ? [req.params.id] : [req.params.id, req.user.municipalityId];
    const lockMunicipality = isGlobalUser(req.user)
      ? (await client.query("SELECT municipality_id FROM requests WHERE id = $1", [req.params.id])).rows[0]?.municipality_id
      : req.user.municipalityId;
    if (lockMunicipality) await lockMunicipalSchedule(client, lockMunicipality);
    const { rows: existingRows } = await client.query(
      `SELECT * FROM requests WHERE id = $1${scope} FOR UPDATE`,
      scopeValues,
    );
    if (!existingRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Não encontrado" });
    }

    const currentWorkflow = parseJsonObject(existingRows[0].workflow_data);
    const incomingWorkflow = { ...workflowPatch, ...parseJsonObject(new Map(dedupedEntries).get("workflow_data")) };
    let nextWorkflow = mergeProtectedWorkflow(currentWorkflow, incomingWorkflow);
    const normalizedPatch = Object.fromEntries(dedupedEntries);
    if (Object.hasOwn(normalizedPatch, "schedule_date") && normalizedPatch.schedule_date !== existingRows[0].schedule_date && !incomingWorkflow.scheduleOccurrenceKey) {
      delete nextWorkflow.scheduleOccurrenceKey;
      delete nextWorkflow.scheduleSlotTime;
      delete nextWorkflow.scheduleTime;
    }
    if (Object.hasOwn(incomingWorkflow, "scheduleTime") && incomingWorkflow.scheduleTime !== currentWorkflow.scheduleTime
      && (!Object.hasOwn(incomingWorkflow, "scheduleSlotTime") || incomingWorkflow.scheduleSlotTime === currentWorkflow.scheduleSlotTime)) {
      nextWorkflow.scheduleSlotTime = incomingWorkflow.scheduleTime;
    } else if (Object.hasOwn(incomingWorkflow, "scheduleSlotTime")) nextWorkflow.scheduleTime = incomingWorkflow.scheduleSlotTime;
    let nextRequest = { ...existingRows[0], ...normalizedPatch, workflow_data: nextWorkflow };
    if (dedupedEntries.some(([key]) => ["animals", "animal_id"].includes(key))) {
      await validateRequestAnimalLink(client, { body: nextRequest, user: req.user, municipalityId: existingRows[0].municipality_id });
    }
    const settings = await loadRequestSettings(existingRows[0].municipality_id, client);
    if (nextRequest.request_type !== existingRows[0].request_type) {
      const nextType = settings.requestTypes.find((item) => item.name === nextRequest.request_type || item.id === nextRequest.request_type);
      if (nextType) nextWorkflow.requestTypeId = nextType.id;
      else delete nextWorkflow.requestTypeId;
    }
    if (body.documents !== undefined || body.documentReviews !== undefined) {
      const documents = await applyDocumentReviews(client, { previous: existingRows[0], patch: body, user: req.user, municipalityId: existingRows[0].municipality_id, settings });
      const position = dedupedEntries.findIndex(([key]) => key === "documents");
      if (position >= 0) dedupedEntries[position] = ["documents", documents];
      else dedupedEntries.push(["documents", documents]);
      nextRequest.documents = documents;
    }
    if (bookingChanged(existingRows[0], nextRequest)) {
      nextRequest = await reserveRequestSchedule(client, {
        body: { ...nextRequest, requestTypeId: nextWorkflow.requestTypeId }, settings, user: req.user,
        internal: existingRows[0].origin === "INTERNA", municipalityId: existingRows[0].municipality_id, excludeId: req.params.id,
      });
      nextWorkflow = nextRequest.workflow_data;
      for (const key of ["schedule_date", "schedule_location_name", "schedule_address", "schedule_address_url", "schedule_municipality"]) {
        const position = dedupedEntries.findIndex(([entry]) => entry === key);
        if (position >= 0) dedupedEntries[position] = [key, nextRequest[key]];
        else dedupedEntries.push([key, nextRequest[key]]);
      }
    }
    const preparedEntries = dedupedEntries.map(([key, value]) => {
      if (key === "animals" || key === "documents") return [key, JSON.stringify(Array.isArray(value) ? value : [])];
      if (key === "tags") return [key, JSON.stringify(mergeTags(existingRows[0].tags, value))];
      if (key === "workflow_data") return [key, JSON.stringify(nextWorkflow)];
      if (key === "signed_at") return [key, parseSignedAt(value)];
      return [key, value];
    });

    if ((Object.keys(workflowPatch).length || bookingChanged(existingRows[0], nextRequest)) && !dedupedEntries.some(([key]) => key === "workflow_data")) {
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
    const idParam = values.length;
    let updateScope = "";
    if (!isGlobalUser(req.user)) {
      values.push(req.user.municipalityId);
      updateScope = ` AND municipality_id = $${values.length}`;
    }

    const { rows } = await client.query(
      `UPDATE requests SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = $${idParam}${updateScope} RETURNING *`,
      values
    );
    assertMaterializedRequestSize(rows[0]);
    await applyAnimalRequestTransition(client, { previous: existingRows[0], request: rows[0], user: req.user });
    await client.query("COMMIT");
    committed = true;
    savedRequest = rows[0];
    client.release();
    released = true;
    rows[0].notificationResults = await notifyRequestChanges(existingRows[0], rows[0], {
      loadSettings: loadRequestSettings,
      appendHistory: (entries, id, municipalityId) => pool.query(
        "UPDATE requests SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb WHERE id = $2 AND municipality_id = $3",
        [JSON.stringify(entries), id, municipalityId],
      ),
    });
    res.json(decorateRequestDocuments(rows[0], settings));
  } catch (err) {
    if (committed) return res.json({ ...savedRequest, notificationResults: [{ status: DeliveryStatus.FAILED, reason: "Operação salva; não foi possível concluir os avisos." }] });
    if (client && !committed) await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.status ? err.message : "Não foi possível atualizar a solicitação." });
  } finally {
    if (client && !released) client.release();
  }
});

router.delete("/:id", auth, async (req, res) => {
  if (!isInternalUser(req.user)) return res.status(403).json({ error: "Operação restrita à equipe de atendimento." });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const scope = isGlobalUser(req.user) ? "" : " AND municipality_id = $2";
    const values = isGlobalUser(req.user) ? [req.params.id] : [req.params.id, req.user.municipalityId];
    const { rows } = await client.query(`SELECT municipality_id FROM requests WHERE id = $1${scope}`, values);
    if (rows[0]) {
      await lockMunicipalSchedule(client, rows[0].municipality_id);
      await client.query(`DELETE FROM requests WHERE id = $1${scope}`, values);
    }
    await client.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    res.status(error.status || 500).json({ error: error.status ? error.message : "Não foi possível remover a solicitação." });
  } finally { client?.release(); }
});

export default router;
