import { pool } from "../../db/index.js";
import { isInternalUser } from "../../tenant.js";
import { DeliveryStatus } from "../../../../shared/notification-contract.js";
import { ProcedureAction, canApplyProcedureAction, isMicrochipProcedure, resolveRequestProcedures } from "../../../../shared/request-procedure-contract.js";
import { RequestOrigin, RequestTag, isProcedureRequest, withoutRequestContactCpf } from "../../../../shared/request-contract.js";
import { loadRequestSettings } from "../../repositories/request-settings.js";
import { appendRequestHistory } from "../../repositories/request-history.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { lockRequestForUpdate } from "../locked-request.js";
import { reserveProcedureSchedule } from "../schedule/schedule-booking.js";
import { notifyRequestChanges } from "../request-change-notifications.js";
import { applyProcedureAttendance } from "../registered-animals/animal-transitions.js";
import { assertMaterializedRequestSize } from "../documents/request-documents.js";
import { decorateRequestDocuments } from "../documents/document-reviews.js";
import { parseProcedureActionInput } from "./procedure-action-input.js";
import { applyProcedureAction } from "./procedure-action-apply.js";
import { pendingRequiredDocuments } from "./procedure-documents.js";
import { deriveProcedureRequestState, storeResolvedProcedures } from "./procedure-request-state.js";

const NEEDS_ASSIGNMENT = new Set([ProcedureAction.CONFIRM_SCHEDULE, ProcedureAction.ATTEND, ProcedureAction.REJECT]);
const NEEDS_DOCUMENTS = new Set([ProcedureAction.CONFIRM_SCHEDULE, ProcedureAction.RESCHEDULE]);

function fail(message, status) {
  throw Object.assign(new Error(message), { status });
}

function checkPreconditions(request, input, settings) {
  const workflow = request.workflow_data || {};
  if (NEEDS_ASSIGNMENT.has(input.action) && request.origin !== RequestOrigin.INTERNAL && !(workflow.assignedSectorId && workflow.assignedUserId)) {
    fail("Atribua um setor e um usuário ao processo antes de continuar.", 409);
  }
  if (!NEEDS_DOCUMENTS.has(input.action)) return;
  const pending = pendingRequiredDocuments(settings, request);
  if (pending.length) fail(`Resolva os documentos obrigatórios antes de confirmar a agenda: ${pending.join(", ")}.`, 409);
}

async function saveProcedureAction(client, { request, input, user, settings }) {
  const animals = resolveRequestProcedures(request, settings.requestTypes);
  const procedure = animals[input.animalIndex]?.procedures.find((item) => item.requestTypeId === input.requestTypeId);
  if (!procedure) fail("Procedimento não encontrado neste processo.", 404);
  if (!canApplyProcedureAction(procedure.status, input.action)) fail("Esta ação não está disponível para a situação atual do procedimento.", 409);
  checkPreconditions(request, input, settings);
  const schedule = input.action === ProcedureAction.RESCHEDULE ? await reserveProcedureSchedule(client, {
    request, animals, animalIndex: input.animalIndex, requestTypeId: input.requestTypeId, selection: input.schedule, municipalityId: request.municipality_id,
  }) : null;
  const applied = applyProcedureAction({ animals, procedure, input, schedule, user });
  const state = deriveProcedureRequestState(request, applied.resolved);
  let tags = request.tags || [];
  if (input.action === ProcedureAction.RESCHEDULE) {
    tags = [...new Set([...tags, RequestTag.RESCHEDULED])];
    state.workflow.previousSchedule = applied.previousSchedule?.date || "";
  }
  const attended = input.action === ProcedureAction.ATTEND;
  const chip = attended && isMicrochipProcedure(applied.procedure.name) ? applied.procedure.microchip : "";
  const primaryChip = input.animalIndex === 0 && chip ? chip : request.animal_microchip;
  const history = [{ status: state.status, notes: applied.note, by: user.id, at: new Date() }];
  const { rows } = await client.query(
    `UPDATE requests SET animals = $1, status = $2, schedule_date = $3, schedule_location_name = $4, schedule_address = $5,
      schedule_address_url = $6, workflow_data = $7, history = COALESCE(history, '[]'::jsonb) || $8::jsonb,
      animal_microchip = $9, tags = $10, updated_at = NOW()
     WHERE id = $11 AND municipality_id = $12 RETURNING *`,
    [JSON.stringify(storeResolvedProcedures(applied.resolved)), state.status, state.schedule_date, state.schedule_location_name, state.schedule_address,
      state.schedule_address_url, JSON.stringify(state.workflow), JSON.stringify(history), primaryChip, JSON.stringify(tags), request.id, request.municipality_id],
  );
  assertMaterializedRequestSize(rows[0]);
  const animalId = applied.resolved[input.animalIndex]?.id || (input.animalIndex === 0 ? request.animal_id : "");
  if (attended && animalId) await applyProcedureAttendance(client, {
    request: rows[0], user, animalId, animalIndex: input.animalIndex, procedure: applied.procedure, chip,
  });
  return { request: rows[0], procedureChange: {
    action: input.action, procedure: applied.procedure, previousSchedule: applied.previousSchedule, animal: applied.resolved[input.animalIndex],
  } };
}

// POST /requests/:id/procedures/action updates the addressed procedure and the process fields derived from it.
export async function handleProcedureAction(req, res) {
  if (!isInternalUser(req.user)) return res.status(403).json({ error: "Operação restrita à equipe de atendimento." });
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "Identificador do processo inválido." });
  let input;
  try { input = parseProcedureActionInput(req.body); } catch (err) { return res.status(400).json({ error: err.message }); }
  let client;
  let committed = false;
  let saved;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const request = await lockRequestForUpdate(client, { id: req.params.id, user: req.user });
    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Não encontrado" });
    }
    if (!isProcedureRequest(request.request_type)) fail("Este processo não tem procedimentos.", 409);
    if (!request.municipality_id) fail("Vincule o processo a uma prefeitura antes de atualizar os procedimentos.", 409);
    const settings = await loadRequestSettings(request.municipality_id, client);
    const result = await saveProcedureAction(client, { request, input, user: req.user, settings });
    saved = result.request;
    await client.query("COMMIT");
    committed = true;
    client.release();
    client = null;
    saved.notificationResults = await notifyRequestChanges(request, saved, {
      appendHistory: appendRequestHistory, procedureChange: result.procedureChange,
    });
    res.json(decorateRequestDocuments({ ...saved, workflow_data: withoutRequestContactCpf(saved.workflow_data) }, settings));
  } catch (err) {
    if (committed) return res.json({ ...saved, workflow_data: withoutRequestContactCpf(saved.workflow_data),
      notificationResults: [{ status: DeliveryStatus.FAILED, reason: "Operação salva; não foi possível concluir os avisos." }] });
    if (client) await client.query("ROLLBACK").catch(() => {});
    res.status(err.status || 500).json({ error: err.status ? err.message : "Não foi possível atualizar o procedimento." });
  } finally {
    if (client) client.release();
  }
}
