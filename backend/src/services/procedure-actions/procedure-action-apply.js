import {
  ProcedureAction, ProcedureActionErrorCode, ProcedureStatus, animalPrescriptionRecords, distinctProcedureSchedules, isMicrochipProcedure, isOpenProcedure,
} from "../../../../shared/request-procedure-contract.js";
import { RequestHistoryCategory } from "../../../../shared/request-history-contract.js";
import { RequestOrigin, RequestStatus } from "../../../../shared/request-contract.js";
import { procedureGroupScheduleSelection, scheduleDate } from "../../../../shared/schedule-contract.js";
import { DocumentSequence } from "../../../../shared/document-number-contract.js";
import { nextDocumentNumber } from "../../repositories/document-numbers.js";
import { checkProcedureSchedule } from "../schedule/schedule-booking.js";
import { pendingRequiredDocuments } from "./procedure-documents.js";

function fail(message, status = 409, code) {
  throw Object.assign(new Error(message), { status, code });
}

const nameOf = (animal, index) => animal.name || `Animal ${index + 1}`;
const scheduleText = (schedule) => [schedule?.date, schedule?.slotTime, schedule?.locationName].filter(Boolean).join(" · ");
const sameSlot = (a, b) => scheduleDate(a?.date) === scheduleDate(b.date) && a?.occurrenceKey === b.occurrenceKey && a?.slotTime === b.slotTime;

function findTarget(animals, { animalIndex, requestTypeId }) {
  const animal = animals[animalIndex];
  const procedure = animal?.procedures.find((item) => item.requestTypeId === requestTypeId);
  if (!procedure) fail("Procedimento não encontrado neste processo.", 404);
  return { animal, procedure };
}

function requireAssignment(request) {
  const { assignedSectorId, assignedUserId } = request.workflow_data || {};
  if (request.origin !== RequestOrigin.INTERNAL && !(assignedSectorId && assignedUserId)) {
    fail("Atribua um setor e um usuário ao processo antes de continuar.");
  }
}

async function applySchedule(client, { request, animals, input, settings, now, stamp, addEvent }) {
  const open = animals.flatMap((animal) => animal.procedures.filter(isOpenProcedure));
  if (!open.length) fail("O processo não tem procedimentos pendentes para agendar.");
  const reschedule = input.action === ProcedureAction.RESCHEDULE;
  const confirmed = request.status === RequestStatus.SCHEDULED || open.some(({ status }) => status === ProcedureStatus.SCHEDULED);
  if (confirmed && !reschedule) fail("A situação do agendamento mudou. Atualize o processo.");
  requireAssignment(request);
  const pending = pendingRequiredDocuments(settings, request, animals);
  if (pending.length) fail(`Resolva os documentos obrigatórios antes de confirmar a agenda: ${pending.join(", ")}.`);
  const previous = distinctProcedureSchedules(animals);
  const booking = { request, animals, now };
  const reservation = confirmed ? null : await checkProcedureSchedule(client, { ...booking, selection: procedureGroupScheduleSelection(previous) });
  if (reschedule && reservation?.schedule) {
    fail("A reserva atual está disponível. Use Confirmar Agenda.", 409, ProcedureActionErrorCode.RESERVATION_AVAILABLE);
  }
  const { schedule, error, status } = reschedule ? await checkProcedureSchedule(client, { ...booking, selection: input.schedule }) : reservation;
  if (!schedule) fail(error, reschedule ? status : 409, reschedule ? undefined : ProcedureActionErrorCode.RESERVATION_UNAVAILABLE);
  if (reschedule && open.every((procedure) => procedure.status === ProcedureStatus.SCHEDULED && sameSlot(procedure.schedule, schedule))) {
    fail("Escolha um horário diferente do agendamento atual.");
  }
  const staysPending = reschedule && !confirmed;
  for (const procedure of open) Object.assign(procedure, stamp, { schedule, status: staysPending ? ProcedureStatus.WAITING : ProcedureStatus.SCHEDULED });
  const detail = [reschedule && previous.length ? `Anterior: ${previous.map(scheduleText).join(" / ")}` : "",
    `Horário: ${scheduleText(schedule)}`, input.schedule?.reason ? `Motivo: ${input.schedule.reason}` : "",
    staysPending ? "Aguardando confirmação" : ""].filter(Boolean).join(" · ");
  addEvent(reschedule ? "Solicitação reagendada" : "Agendamento confirmado", detail, RequestHistoryCategory.SCHEDULE);
  return { previousSchedule: previous[0] };
}

function applyHealth(animals, edits, stamp, addEvent) {
  for (const { animalIndex, doencas, alergias, microchip } of edits) {
    const animal = animals[animalIndex];
    if (!animal) fail("Animal não encontrado neste processo.", 404);
    if (!animal.procedures.some(isOpenProcedure)) fail("Os procedimentos deste animal já foram encerrados.");
    let changed = false;
    for (const [key, value] of Object.entries({ doencas, alergias })) {
      if (value === undefined || value === (animal[key] || "")) continue;
      animal[key] = value;
      changed = true;
    }
    if (microchip !== undefined) {
      const procedures = animal.procedures.filter((item) => isOpenProcedure(item) && isMicrochipProcedure(item.name));
      if (!procedures.length) fail("O código do microchip só pode ser salvo no procedimento de microchipagem.", 400);
      for (const procedure of procedures) {
        if (microchip === (procedure.microchip || "")) continue;
        Object.assign(procedure, stamp, { microchip });
        changed = true;
      }
    }
    if (changed) addEvent("Informações de saúde atualizadas", nameOf(animal, animalIndex), RequestHistoryCategory.HEALTH);
  }
}

function applyOutcomes({ request, animals, input, stamp, addEvent }) {
  const absent = input.action === ProcedureAction.NO_SHOW;
  if (!absent && input.results.length) requireAssignment(request);
  applyHealth(animals, input.health, stamp, addEvent);
  return input.results.map((target) => {
    const { animal, procedure } = findTarget(animals, target);
    if (procedure.status !== ProcedureStatus.SCHEDULED) fail("Só é possível registrar resultado para procedimentos agendados.");
    const chip = !absent && isMicrochipProcedure(procedure.name) ? procedure.microchip : "";
    if (!absent && isMicrochipProcedure(procedure.name)) {
      if (!chip || chip.length < 4) fail("Informe o código do microchip aplicado ou lido (mínimo de 4 caracteres).", 400);
      Object.assign(animal, { hasChip: "Sim", microchip: chip, confirmedMicrochip: chip });
    }
    Object.assign(procedure, stamp, { status: absent ? ProcedureStatus.NO_SHOW : ProcedureStatus.DONE });
    const detail = [nameOf(animal, target.animalIndex), procedure.name, chip && `Microchip: ${chip}`].filter(Boolean).join(" · ");
    addEvent(absent ? "Não comparecimento registrado" : "Procedimento realizado", detail, RequestHistoryCategory.SCHEDULE);
    return { ...target, animal, procedure, chip };
  });
}

function applyRemoval(animals, input, stamp, addEvent) {
  const { animal, procedure } = findTarget(animals, input.target);
  if (!isOpenProcedure(procedure)) fail("Este procedimento já tem um resultado.");
  Object.assign(procedure, stamp, { status: ProcedureStatus.REMOVED, removalReason: input.reason });
  addEvent("Procedimento removido", `${nameOf(animal, input.target.animalIndex)} · ${procedure.name} · Motivo: ${input.reason}`, RequestHistoryCategory.SCHEDULE);
}

async function applyPrescriptions(client, { request, animals, input, stamp, addEvent }) {
  for (const { animalIndex, ...draft } of input.prescriptions) {
    const animal = animals[animalIndex];
    if (!animal) fail("Animal não encontrado neste processo.", 404);
    const procedure = draft.requestTypeId && findTarget(animals, { animalIndex, requestTypeId: draft.requestTypeId }).procedure;
    if (procedure?.status === ProcedureStatus.REMOVED) fail("Este procedimento foi removido.");
    const records = animalPrescriptionRecords(animal);
    const active = records.findLast((entry) => !entry.archived);
    const fields = ["text", "requestTypeId", "professionalName", "professionalRegistry"];
    if ((!draft.text && !active) || (active && fields.every((key) => (active[key] || "") === (draft[key] || "")))) continue;
    animal.prescriptions = records.map((entry) => entry === active ? { ...entry, archived: true } : entry);
    for (const item of animal.procedures) delete item.prescription;
    if (draft.text) {
      const number = await nextDocumentNumber(client, { municipalityId: request.municipality_id, sequence: DocumentSequence.PRESCRIPTION });
      animal.prescriptions.push({ ...draft, number, issuedAt: stamp.updatedAt, issuedBy: stamp.updatedBy });
    }
    addEvent(!draft.text ? "Receita removida" : active ? "Receita alterada" : "Receita emitida",
      [nameOf(animal, animalIndex), procedure?.name].filter(Boolean).join(" · "), RequestHistoryCategory.HEALTH);
  }
}

export async function applyProcedureAction(client, { request, animals, input, settings, user, now = new Date() }) {
  const stamp = { updatedAt: now.toISOString(), updatedBy: user.id };
  const events = [];
  const addEvent = (title, notes, category) => events.push({ title, notes, category, by: user.id, at: now });
  const context = { request, animals, input, settings, now, stamp, addEvent };
  let outcomes = [];
  let previousSchedule;
  switch (input.action) {
    case ProcedureAction.CONFIRM_SCHEDULE:
    case ProcedureAction.RESCHEDULE:
      ({ previousSchedule } = await applySchedule(client, context));
      break;
    case ProcedureAction.SAVE:
    case ProcedureAction.NO_SHOW:
      outcomes = applyOutcomes(context);
      break;
    case ProcedureAction.REMOVE:
      applyRemoval(animals, input, stamp, addEvent);
      break;
    case ProcedureAction.PRESCRIPTION:
      await applyPrescriptions(client, context);
      break;
    case ProcedureAction.CLOSE: {
      outcomes = applyOutcomes(context);
      const procedures = animals.flatMap((animal) => animal.procedures);
      if (!procedures.length || procedures.some(isOpenProcedure) || ![RequestStatus.NEW, RequestStatus.SCHEDULED].includes(request.status)) {
        fail("Classifique todos os procedimentos antes de encerrar o atendimento.");
      }
      const done = procedures.filter(({ status }) => status === ProcedureStatus.DONE).length;
      const removed = procedures.filter(({ status }) => status === ProcedureStatus.REMOVED).length;
      addEvent("Atendimento encerrado", `${done} realizado(s) · ${procedures.length - done - removed} não realizado(s) · ${removed} removido(s)`,
        RequestHistoryCategory.PROCESS);
      break;
    }
  }
  if (!events.length) fail("Nenhuma alteração para salvar.");
  return { events, outcomes, previousSchedule };
}
