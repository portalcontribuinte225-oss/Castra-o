import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { auth, optionalAuth, requireInternalUser } from "../middleware/auth.js";
import { isGlobalUser, isInternalUser, requireMunicipality } from "../tenant.js";
import { DeliveryStatus } from "../../../shared/notification-contract.js";
import { loadRequestSettings, loadDocumentReviewSettings } from "../repositories/request-settings.js";
import { prepareRequestSubmission, mergeProtectedWorkflow } from "../services/request-submission.js";
import { updateRequestProcedures } from "../services/request-procedures.js";
import { notifyRequestChanges } from "../services/request-change-notifications.js";
import { notifyRequestRegistered } from "../services/notify-request-registered.js";
import { resolveRequestTutor } from "../services/auth/request-tutor.js";
import { validateRequestAnimalLink } from "../services/request-animal-link.js";
import { prepareRegisteredRequest, registerRequestAnimals } from "../services/registered-animals/registered-request.js";
import { applyAnimalRequestTransition } from "../services/registered-animals/animal-transitions.js";
import { prepareRequestDocuments, assertMaterializedRequestSize } from "../services/documents/request-documents.js";
import { applyDocumentReviews, decorateRequestDocuments } from "../services/documents/document-reviews.js";
import { visibleRequest } from "../services/request-visibility.js";
import { lockMunicipalSchedule } from "../services/schedule/schedule-lock.js";
import { lockRequestForUpdate } from "../services/locked-request.js";
import { appendRequestHistory } from "../repositories/request-history.js";
import { getRequestHistory } from "../services/request-history.js";
import { insertRequestCreatedNotification } from "../repositories/staff-notifications.js";
import { recordRequestAssignmentNotification } from "../services/staff-notification-events.js";
import { resolveRequestAssignment } from "../services/request-assignment.js";
import { REQUESTED_SCHEDULE_KEY, scheduleFromRequest } from "../../../shared/request-procedure-contract.js";
import { RequestHistoryCategory } from "../../../shared/request-history-contract.js";
import { handleProcedureAction } from "../services/procedure-actions/procedure-action-handler.js";
import { assertProcedurePatchPreservesState, protectStoredProcedures, stripSuppliedProcedures } from "../services/procedure-actions/procedure-request-state.js";
import { reserveRequestSchedule, bookingChanged } from "../services/schedule/schedule-booking.js";
import { nextDocumentNumber } from "../repositories/document-numbers.js";
import { DocumentSequence } from "../../../shared/document-number-contract.js";
import { isProcedureRequest, RequestOrigin, RequestStatus, RequestTag, withoutRequestContactCpf } from "../../../shared/request-contract.js";

const router = Router();
const ALLOWED_REQUEST_STATUSES = new Set(Object.values(RequestStatus));
const ALLOWED_REQUEST_TAGS = new Set(Object.values(RequestTag));

function pick(...values) {
  return values.find((value) => value !== undefined);
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
    const visible = rows.map((row) => visibleRequest(row, req.user));
    const catalogs = await loadDocumentReviewSettings(visible.filter((row) => row.documents?.length).map((row) => row.municipality_id));
    res.json(visible.map((request) => request.documents?.length ? decorateRequestDocuments(request, catalogs.get(request.municipality_id)) : request));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/history", auth, requireInternalUser, getRequestHistory);

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
    body = await prepareRegisteredRequest(client, { body, user: req.user, municipalityId });
    const { cpf, workflow: submittedWorkflow, requestType, animals: procedureAnimals, internal } = prepareRequestSubmission({
      body, user: req.user, municipalityId,
      workflow: parseJsonObject(body.workflow_data || body.workflowData), settings,
    });
    // The request type is derived from the procedures of the animals.
    body = { ...body, request_type: requestType, ...(procedureAnimals ? { animals: procedureAnimals } : {}) };
    await validateRequestAnimalLink(client, { body, user: req.user, municipalityId });
    body = await reserveRequestSchedule(client, { body: { ...body, status: RequestStatus.NEW, workflow_data: submittedWorkflow }, municipalityId, user: req.user });
    const workflow = body.workflow_data;
    // No account is made here: the tutor creates the password on the first access, with a code sent to the request's contact.
    const tutorId = await resolveRequestTutor(client, { cpf, municipalityId, user: req.user });
    const protocol = await nextDocumentNumber(client, { municipalityId, sequence: DocumentSequence.PROTOCOL });
    const requestId = crypto.randomUUID();
    const animals = stripSuppliedProcedures(body.animals);
    const firstAnimal = animals[0] || {};
    const scheduleDate = pick(body.schedule_date, body.preferredSchedule, body.appointment);
    if (isProcedureRequest(requestType)) {
      workflow.procedureScheduleDates = scheduleDate ? [scheduleDate] : [];
      workflow[REQUESTED_SCHEDULE_KEY] = scheduleDate ? scheduleFromRequest(body) : null;
    }

    const { rows } = await client.query(
      `INSERT INTO requests (
        tutor_id,
        protocol,
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
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
        $18, $19, $20, $21, 'NOVA', $22, $23, $24, $25,
        $26, $27, $28, $29, $30::jsonb, $31::jsonb, $32::jsonb,
        $33, $34, $35, $36, $37
      )
      RETURNING *`,
      [
        tutorId,
        protocol,
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
        // The electronic acceptance is the moment the server received the declaration accepted on the web; nothing else sets it.
        !internal && isProcedureRequest(requestType) && body.declarationAccepted === true ? new Date() : null,
        JSON.stringify([]),
        JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
        JSON.stringify(workflow),
        pick(body.latitude, body.lat) || null,
        pick(body.longitude, body.lng) || null,
        internal ? RequestOrigin.INTERNAL : RequestOrigin.PUBLIC,
        Boolean(body.is_confidential || body.isConfidential),
        requestId,
      ]
    );

    rows[0] = await registerRequestAnimals(client, { body, request: rows[0], user: req.user, tutorId, municipalityId, requestTypes: settings.requestTypes });
    rows[0].documents = await prepareRequestDocuments(client, {
      body, user: req.user, tutorId, municipalityId, settings, requestId,
      animalIds: (rows[0].animals || []).map((animal) => animal.id).filter(Boolean),
    });
    assertMaterializedRequestSize(rows[0]);
    await client.query("UPDATE requests SET documents = $1::jsonb WHERE id = $2 AND municipality_id = $3", [JSON.stringify(rows[0].documents), requestId, municipalityId]);
    await insertRequestCreatedNotification(client, rows[0]);

    await client.query("COMMIT");
    committed = true;
    client.release();
    released = true;
    res.set("Cache-Control", "no-store");
    res.status(201).json({ request: rows[0] });
    // After the answer, so the notice never delays the request nor undoes it.
    notifyRequestRegistered(rows[0], { appendHistory: appendRequestHistory }).catch(() => {});
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
    "responsible_unit", "veterinarian",
    "documents", "assigned_sector", "tags", "workflow_data",
    "latitude", "longitude", "animal_id", "animal_microchip",
    "target_tutor_name", "target_tutor_email", "target_tutor_cpf",
    "target_tutor_phone", "target_tutor_address", "target_tutor_neighborhood",
    "target_tutor_city", "target_tutor_state", "target_tutor_cep",
    "death_date", "death_cause", "origin",
  ];
  const ignoredKeys = new Set(["history_note", "historyNote", "documentReviews", "documentEvidence"]);
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

  const changesDocuments = body.documents !== undefined || body.documentReviews !== undefined || body.documentEvidence !== undefined;
  if (!dedupedEntries.length && !Object.keys(workflowPatch).length && !historyNote && !changesDocuments) {
    return res.status(400).json({ error: "Nenhum campo válido." });
  }

  let client;
  let committed = false;
  let released = false;
  let savedRequest;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const existing = await lockRequestForUpdate(client, { id: req.params.id, user: req.user });
    const existingRows = existing ? [existing] : [];
    if (!existingRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Não encontrado" });
    }

    const currentWorkflow = parseJsonObject(existingRows[0].workflow_data);
    const incomingWorkflow = { ...workflowPatch, ...parseJsonObject(new Map(dedupedEntries).get("workflow_data")) };
    let nextWorkflow = mergeProtectedWorkflow(currentWorkflow, incomingWorkflow);
    const assignmentRequested = Object.hasOwn(workflowPatch, "assignedSectorId") || Object.hasOwn(workflowPatch, "assignedUserId");
    if (assignmentRequested && body.expectedUpdatedAt !== undefined
      && (typeof body.expectedUpdatedAt !== "string" || body.expectedUpdatedAt !== (existing.updated_at ? new Date(existing.updated_at).toISOString() : ""))) {
      throw Object.assign(new Error("O processo foi atualizado. Reabra para conferir a situação atual."), { status: 409 });
    }
    const assignment = await resolveRequestAssignment(client, existing, workflowPatch);
    if (assignment) Object.assign(nextWorkflow, assignment);
    if (!assignment && assignmentRequested && Object.keys(body).every((key) => ["assignedSectorId", "assignedUserId", "expectedUpdatedAt", "tags", "history_note", "historyNote"].includes(key))) {
      throw Object.assign(new Error("O setor e o responsável já estão definidos assim."), { status: 409 });
    }
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
    if (Object.hasOwn(normalizedPatch, "animals")) {
      nextRequest = protectStoredProcedures(existingRows[0], nextRequest);
      dedupedEntries[dedupedEntries.findIndex(([key]) => key === "animals")] = ["animals", nextRequest.animals];
    }
    assertProcedurePatchPreservesState(existingRows[0], nextRequest);
    if (dedupedEntries.some(([key]) => ["animals", "animal_id"].includes(key))) {
      await validateRequestAnimalLink(client, { body: nextRequest, user: req.user, municipalityId: existingRows[0].municipality_id });
    }
    const settings = await loadRequestSettings(existingRows[0].municipality_id, client);
    const procedureUpdate = Object.hasOwn(normalizedPatch, "animals") ? updateRequestProcedures({
      previousAnimals: existingRows[0].animals, nextAnimals: nextRequest.animals, workflow: nextWorkflow,
      municipalityId: existingRows[0].municipality_id, settings,
    }) : null;
    if (procedureUpdate) {
      nextWorkflow = procedureUpdate.workflow;
      nextRequest = { ...nextRequest, animals: procedureUpdate.animals, request_type: procedureUpdate.requestType, workflow_data: nextWorkflow };
      for (const [key, value] of [["animals", procedureUpdate.animals], ["request_type", procedureUpdate.requestType]]) {
        const position = dedupedEntries.findIndex(([entry]) => entry === key);
        if (position >= 0) dedupedEntries[position] = [key, value];
        else dedupedEntries.push([key, value]);
      }
    }
    if (changesDocuments) {
      const documents = await applyDocumentReviews(client, { previous: existingRows[0], patch: body, user: req.user, municipalityId: existingRows[0].municipality_id, settings });
      const position = dedupedEntries.findIndex(([key]) => key === "documents");
      if (position >= 0) dedupedEntries[position] = ["documents", documents];
      else dedupedEntries.push(["documents", documents]);
      nextRequest.documents = documents;
    }
    const changesBooking = bookingChanged(existingRows[0], nextRequest);
    if (changesBooking) {
      nextRequest = await reserveRequestSchedule(client, {
        body: nextRequest, user: req.user,
        internal: existingRows[0].origin === RequestOrigin.INTERNAL, municipalityId: existingRows[0].municipality_id, excludeId: req.params.id,
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
      return [key, value];
    });

    if ((assignment || Object.keys(workflowPatch).length || procedureUpdate || changesBooking) && !dedupedEntries.some(([key]) => key === "workflow_data")) {
      preparedEntries.push(["workflow_data", JSON.stringify(nextWorkflow)]);
    }

    const previousStatus = existing.status;
    const historyEntry = historyNote
      ? [{ status: nextRequest.status, notes: historyNote, by: req.user.id, at: new Date(),
        ...(changesDocuments ? { category: RequestHistoryCategory.DOCUMENTS } : {}),
        ...(nextRequest.status !== previousStatus ? { previousStatus } : {}) }]
      : [];
    const keys = preparedEntries.map(([k]) => k);
    const values = preparedEntries.map(([, v]) => v);
    const setParts = keys.map((k, i) => `${k} = $${i + 1}`);
    if (historyEntry.length) {
      values.push(JSON.stringify(historyEntry));
      setParts.push(`history = COALESCE(history, '[]'::jsonb) || $${values.length}::jsonb`);
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
    await recordRequestAssignmentNotification(client, { previous: existingRows[0], request: rows[0], actor: req.user });
    await client.query("COMMIT");
    committed = true;
    savedRequest = rows[0];
    client.release();
    released = true;
    const requestWithDocuments = decorateRequestDocuments(savedRequest, settings);
    const beforeNotice = body.documentReviews?.length ? decorateRequestDocuments(existingRows[0], settings) : existingRows[0];
    requestWithDocuments.notificationResults = await notifyRequestChanges(beforeNotice, requestWithDocuments, { appendHistory: appendRequestHistory });
    res.json({ ...requestWithDocuments, workflow_data: withoutRequestContactCpf(requestWithDocuments.workflow_data) });
  } catch (err) {
    if (committed) return res.json({ ...savedRequest, workflow_data: withoutRequestContactCpf(savedRequest.workflow_data),
      notificationResults: [{ status: DeliveryStatus.FAILED, reason: "Operação salva; não foi possível concluir os avisos." }] });
    if (client && !committed) await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.status ? err.message : "Não foi possível atualizar a solicitação." });
  } finally {
    if (client && !released) client.release();
  }
});

router.post("/:id/procedures/action", auth, handleProcedureAction);

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
