import { isDeepStrictEqual } from "node:util";
import { ProcedureStatus, deriveRequestStatus, hasStoredProcedures, holdsSchedulePlace, isOpenProcedure } from "../../../../shared/request-procedure-contract.js";
import { animalRequestTypeIds } from "../../../../shared/request-types-contract.js";
import { REJECTED_CANCEL_REASON } from "../../../../shared/notification-contract.js";
import { RequestStatus } from "../../../../shared/request-contract.js";
import { scheduleDate } from "../../../../shared/schedule-contract.js";

const SCHEDULE_WORKFLOW_KEYS = ["scheduleOccurrenceKey", "scheduleSlotTime", "scheduleTime"];
const SCHEDULE_COLUMNS = ["schedule_date", "schedule_location_name", "schedule_address", "schedule_address_url", "schedule_municipality"];
const PROCEDURE_WORKFLOW_KEYS = ["requestTypeId", "procedureScheduleDates", "performedProcedures", "cancelReason", "rejectionReason", "rejectionNote", "previousSchedule"];
const PROCEDURE_ANIMAL_FIELDS = ["procedures", "doencas", "alergias", "confirmedMicrochip", "microchip", "hasChip", "microchipStatus"];

export function storeResolvedProcedures(animals) {
  return animals.map(({ procedures, ...animal }) => ({ ...animal, procedures: procedures.map(({ name: _name, ...procedure }) => procedure) }));
}

function compareSchedule(a, b) {
  return scheduleDate(a.schedule.date).localeCompare(scheduleDate(b.schedule.date))
    || (a.schedule.slotTime || "").localeCompare(b.schedule.slotTime || "");
}

function latestRejection(procedures) {
  return procedures.filter((item) => item.status === ProcedureStatus.REJECTED && item.rejection)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0]?.rejection || null;
}

// The nearest open procedure supplies the process's agenda. Closed processes retain a date for history and reports.
export function deriveProcedureRequestState(previous, animals) {
  const procedures = animals.flatMap((animal) => animal.procedures || []);
  const derived = deriveRequestStatus(animals) || { status: previous.status, cancelReason: "" };
  const workflow = { ...(previous.workflow_data || {}) };
  if (derived.status === RequestStatus.CANCELLED) {
    workflow.cancelReason = derived.cancelReason;
    const rejection = derived.cancelReason === REJECTED_CANCEL_REASON ? latestRejection(procedures) : null;
    if (rejection) Object.assign(workflow, { rejectionReason: rejection.reason, rejectionNote: rejection.note });
  }
  const done = procedures.filter((item) => item.status === ProcedureStatus.DONE).map((item) => item.name);
  workflow.performedProcedures = [...new Set(done)].join(", ");
  const placed = procedures.filter((item) => holdsSchedulePlace(item) && scheduleDate(item.schedule.date));
  workflow.procedureScheduleDates = [...new Set(placed.map((item) => item.schedule.date))];
  const hasOpen = procedures.some(isOpenProcedure);
  const nearest = hasOpen ? placed.sort(compareSchedule)[0] : procedures
    .filter((item) => scheduleDate(item.schedule?.date) && (derived.status !== RequestStatus.COMPLETED || item.status === ProcedureStatus.DONE))
    .sort(compareSchedule).at(-1);
  const columns = nearest ? {
    schedule_date: nearest.schedule.date, schedule_location_name: nearest.schedule.locationName || "",
    schedule_address: nearest.schedule.address || "", schedule_address_url: nearest.schedule.addressUrl || "",
  } : {
    schedule_date: hasOpen ? null : previous.schedule_date,
    schedule_location_name: hasOpen ? "" : previous.schedule_location_name,
    schedule_address: hasOpen ? "" : previous.schedule_address,
    schedule_address_url: hasOpen ? "" : previous.schedule_address_url,
  };
  if (nearest || hasOpen) {
    for (const key of SCHEDULE_WORKFLOW_KEYS) delete workflow[key];
    if (nearest?.schedule.occurrenceKey) workflow.scheduleOccurrenceKey = nearest.schedule.occurrenceKey;
    if (nearest?.schedule.slotTime) Object.assign(workflow, { scheduleSlotTime: nearest.schedule.slotTime, scheduleTime: nearest.schedule.slotTime });
  }
  return { status: derived.status, workflow, ...columns };
}

function procedureConflict() {
  throw Object.assign(new Error("Use as ações de cada procedimento para mudar os animais, a situação ou a agenda deste processo."), { status: 409 });
}

export function stripSuppliedProcedures(animals) {
  return Array.isArray(animals) ? animals.map((animal) => {
    if (!animal || typeof animal !== "object" || Array.isArray(animal)) return animal;
    const { procedures: _ignored, ...rest } = animal;
    return rest;
  }) : [];
}

function profileWithoutProcedureFields(animal) {
  return Object.fromEntries(Object.entries(animal).filter(([key]) => !PROCEDURE_ANIMAL_FIELDS.includes(key)));
}

// The generic PATCH must keep each animal's identity, procedure selection and state together.
export function protectStoredProcedures(previous, next) {
  const supplied = stripSuppliedProcedures(next.animals);
  if (!hasStoredProcedures(previous)) return { ...next, animals: supplied };
  const stored = previous.animals;
  if (supplied.length !== stored.length) procedureConflict();
  const animals = supplied.map((animal, index) => {
    const oldAnimal = stored[index];
    if (!animal || typeof animal !== "object" || Array.isArray(animal) || !oldAnimal
      || (animal.id || "") !== (oldAnimal.id || "")
      || !isDeepStrictEqual(animalRequestTypeIds(animal), animalRequestTypeIds(oldAnimal))
      || (!oldAnimal.id && !isDeepStrictEqual(profileWithoutProcedureFields(animal), profileWithoutProcedureFields(oldAnimal)))) procedureConflict();
    const result = profileWithoutProcedureFields(animal);
    for (const key of PROCEDURE_ANIMAL_FIELDS) if (Object.hasOwn(oldAnimal, key)) result[key] = oldAnimal[key];
    return result;
  });
  return { ...next, animals };
}

export function assertProcedurePatchPreservesState(previous, next) {
  if (!hasStoredProcedures(previous)) return;
  const before = previous.workflow_data || {};
  const after = next.workflow_data || {};
  if (["status", "request_type", "animal_id", "animal_microchip", ...SCHEDULE_COLUMNS].some((key) => previous[key] !== next[key])
    || [...SCHEDULE_WORKFLOW_KEYS, ...PROCEDURE_WORKFLOW_KEYS].some((key) => !isDeepStrictEqual(before[key], after[key]))) procedureConflict();
}
