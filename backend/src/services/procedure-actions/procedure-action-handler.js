import { pool } from "../../db/index.js";
import { isInternalUser } from "../../tenant.js";
import { DeliveryStatus } from "../../../../shared/notification-contract.js";
import {
  CLOSED_WITHOUT_ATTENDANCE, POSITIVE_CLOSURE, ProcedureAction, REQUESTED_SCHEDULE_KEY, isClosedRequest, resolveRequestProcedures, scheduleFromRequest,
} from "../../../../shared/request-procedure-contract.js";
import { RequestStatus, RequestTag, isProcedureRequest, withoutRequestContactCpf } from "../../../../shared/request-contract.js";
import { loadRequestSettings } from "../../repositories/request-settings.js";
import { appendRequestHistory } from "../../repositories/request-history.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { lockRequestForUpdate } from "../locked-request.js";
import { notifyRequestChanges } from "../request-change-notifications.js";
import { applyProcedureAttendance } from "../registered-animals/animal-transitions.js";
import { assertMaterializedRequestSize } from "../documents/request-documents.js";
import { decorateRequestDocuments } from "../documents/document-reviews.js";
import { parseProcedureActionInput } from "./procedure-action-input.js";
import { applyProcedureAction } from "./procedure-action-apply.js";
import { deriveProcedureRequestState, storeResolvedProcedures } from "./procedure-request-state.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

function timestamp(value) {
  return value ? new Date(value).toISOString() : "";
}

async function saveProcedureAction(client, { request, input, user, settings }) {
  const animals = resolveRequestProcedures(request, settings.requestTypes);
  const { events, outcomes, previousSchedule } = await applyProcedureAction(client, { request, animals, input, user, settings });
  const close = input.action === ProcedureAction.CLOSE;
  const state = deriveProcedureRequestState(request, animals, { close });
  if (!Object.hasOwn(state.workflow, REQUESTED_SCHEDULE_KEY)) state.workflow[REQUESTED_SCHEDULE_KEY] = scheduleFromRequest(request);
  if (close) events.at(-1).title = state.status === RequestStatus.COMPLETED ? POSITIVE_CLOSURE : CLOSED_WITHOUT_ATTENDANCE;
  let tags = request.tags || [];
  if (input.action === ProcedureAction.RESCHEDULE) {
    tags = [...new Set([...tags, RequestTag.RESCHEDULED])];
    state.workflow.previousSchedule = previousSchedule?.date || "";
  }
  const history = events.map((event, index) => ({ ...event, status: state.status,
    ...(index === events.length - 1 && state.status !== request.status ? { previousStatus: request.status } : {}),
  }));
  const primaryChip = outcomes.find(({ animalIndex, chip }) => animalIndex === 0 && chip)?.chip || request.animal_microchip;
  const { rows } = await client.query(
    `UPDATE requests SET animals = $1, status = $2, schedule_date = $3, schedule_location_name = $4, schedule_address = $5,
      schedule_address_url = $6, workflow_data = $7, history = COALESCE(history, '[]'::jsonb) || $8::jsonb,
      animal_microchip = $9, tags = $10, updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 millisecond')
     WHERE id = $11 AND municipality_id = $12 RETURNING *`,
    [JSON.stringify(storeResolvedProcedures(animals)), state.status, state.schedule_date, state.schedule_location_name, state.schedule_address,
      state.schedule_address_url, JSON.stringify(state.workflow), JSON.stringify(history), primaryChip, JSON.stringify(tags), request.id, request.municipality_id],
  );
  const saved = rows[0];
  assertMaterializedRequestSize(saved);
  if (input.action === ProcedureAction.SAVE || close) {
    for (const { animal, animalIndex, procedure, chip } of outcomes) {
      const animalId = animal.id || (animalIndex === 0 ? request.animal_id : "");
      if (animalId) await applyProcedureAttendance(client, { request: saved, user, animalId, animalIndex, procedure, chip });
    }
  }
  return { request: saved, outcomes };
}

// POST /requests/:id/procedures/action applies one operation to the current process version.
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
    if (!request) fail("Não encontrado", 404);
    if (!isProcedureRequest(request.request_type)) fail("Este processo não tem procedimentos.");
    if (!request.municipality_id) fail("Vincule o processo a uma prefeitura antes de atualizar os procedimentos.");
    if (timestamp(input.expectedUpdatedAt) !== timestamp(request.updated_at)) fail("O processo foi atualizado. Reabra para conferir a situação atual.");
    if (isClosedRequest(request)) fail("Este atendimento já foi encerrado.");
    const settings = await loadRequestSettings(request.municipality_id, client);
    const result = await saveProcedureAction(client, { request, input, user: req.user, settings });
    saved = result.request;
    await client.query("COMMIT");
    committed = true;
    client.release();
    client = null;
    saved.notificationResults = await notifyRequestChanges(request, saved, {
      appendHistory: appendRequestHistory, procedureAction: input.action, outcomes: result.outcomes,
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
