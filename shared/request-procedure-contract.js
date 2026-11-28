import { RequestStatus, isProcedureRequest } from "./request-contract.js";
import { NO_SHOW_CANCEL_REASON, REJECTED_CANCEL_REASON } from "./notification-contract.js";
import { MAX_REQUEST_ANIMALS, MAX_REQUEST_TYPES_PER_ANIMAL, animalRequestTypeIds } from "./request-types-contract.js";

// Each procedure of each animal of a request has its own state, kept in `animals[i].procedures`:
//   { requestTypeId, status, schedule: { date, occurrenceKey, slotTime, locationName, address, addressUrl } | null,
//     microchip, prescription: { text, professionalName, professionalRegistry, issuedAt, issuedBy } | null,
//     rejection: { reason, note } | null, updatedAt, updatedBy }
// A procedure that is not stored yet is read from the request's own status and agenda.
// The request keeps its own closure, while the procedures retain their individual outcomes and agenda.
export const ProcedureStatus = Object.freeze({
  WAITING: "AGUARDANDO", SCHEDULED: "AGENDADO", DONE: "REALIZADO", NO_SHOW: "NAO_COMPARECEU", REJECTED: "INDEFERIDO", REMOVED: "REMOVIDO",
});

export const ProcedureAction = Object.freeze({
  SAVE: "save", CONFIRM_SCHEDULE: "confirm_schedule", RESCHEDULE: "reschedule", NO_SHOW: "no_show",
  REMOVE: "remove", CLOSE: "close", PRESCRIPTION: "prescription",
});

export const ProcedureActionErrorCode = Object.freeze({
  RESERVATION_UNAVAILABLE: "RESERVATION_UNAVAILABLE", RESERVATION_AVAILABLE: "RESERVATION_AVAILABLE",
});

export const REQUESTED_SCHEDULE_KEY = "requestedSchedule";
export const CLOSED_WITHOUT_ATTENDANCE = "Encerrado sem realização";
export const POSITIVE_CLOSURE = "Conclusão positiva";
export const MAX_PROCEDURE_BATCH = MAX_REQUEST_ANIMALS * MAX_REQUEST_TYPES_PER_ANIMAL;
export const MAX_HEALTH_TEXT = 2000;
export const MAX_PROCEDURE_NOTE = 1000;
export const MAX_PRESCRIPTION_TEXT = 5000;
export const MAX_PROFESSIONAL_TEXT = 120;

const { WAITING, SCHEDULED, DONE, NO_SHOW, REJECTED } = ProcedureStatus;
const OPEN = [WAITING, SCHEDULED];
const STATUSES = Object.values(ProcedureStatus);

export function isClosedRequest(request) {
  return [RequestStatus.COMPLETED, RequestStatus.CANCELLED].includes(request?.status);
}

export function isOpenProcedure(procedure) {
  return OPEN.includes(procedure?.status);
}

// Only open procedures hold a place.
export function holdsSchedulePlace(procedure) {
  return isOpenProcedure(procedure) && Boolean(procedure?.schedule?.date);
}

// The microchip code is asked only in a microchip procedure, whatever id the municipality gave it.
export function isMicrochipProcedure(name) {
  return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes("microchip");
}

function workflowOf(request) {
  const workflow = request?.workflow_data || request?.workflowData;
  return workflow && typeof workflow === "object" && !Array.isArray(workflow) ? workflow : {};
}

function statusFromRequest(request) {
  const status = request?.status;
  if (status === RequestStatus.SCHEDULED) return SCHEDULED;
  if (status === RequestStatus.COMPLETED) return DONE;
  if (status === RequestStatus.CANCELLED) return workflowOf(request).cancelReason === NO_SHOW_CANCEL_REASON ? NO_SHOW : REJECTED;
  return WAITING;
}

export function scheduleFromRequest(request) {
  const date = request?.schedule_date || request?.preferredSchedule || "";
  if (!date) return null;
  const workflow = workflowOf(request);
  return {
    date, occurrenceKey: workflow.scheduleOccurrenceKey || "", slotTime: workflow.scheduleSlotTime || workflow.scheduleTime || "",
    locationName: request.schedule_location_name || request.scheduleLocationName || "",
    address: request.schedule_address || request.scheduleAddress || "",
    addressUrl: request.schedule_address_url || request.scheduleAddressUrl || "",
  };
}

export function distinctProcedureSchedules(animals, predicate = isOpenProcedure) {
  const schedules = new Map();
  for (const animal of animals) {
    for (const procedure of animal.procedures || []) {
      if (!predicate(procedure) || !procedure.schedule?.date) continue;
      const { date, occurrenceKey, slotTime, locationName } = procedure.schedule;
      schedules.set(JSON.stringify([date, occurrenceKey || "", slotTime || "", occurrenceKey ? "" : locationName || ""]), procedure.schedule);
    }
  }
  return [...schedules.values()];
}

export function appointmentNumberOfAnimals(animals) {
  return animals.filter((animal) => animal.procedures?.some(isOpenProcedure)).length;
}

export function openProcedureSelections(animals) {
  return animals.map((animal) => ({
    requestTypeIds: (animal.procedures || []).filter(isOpenProcedure).map((procedure) => procedure.requestTypeId),
  }));
}

// Legacy emissions on individual procedures are projected into the same list as the per-animal records.
export function animalPrescriptionRecords(animal) {
  if (Array.isArray(animal.prescriptions)) return animal.prescriptions;
  const records = (animal.procedures || []).flatMap(({ prescription, requestTypeId }) =>
    typeof prescription?.text === "string" && prescription.text.trim() ? [{ ...prescription, requestTypeId }] : []);
  records.sort((a, b) => String(a.issuedAt || "").localeCompare(String(b.issuedAt || "")));
  return records.map((record, index) => ({ ...record, archived: index !== records.length - 1 }));
}

export function hasStoredProcedures(request) {
  return (Array.isArray(request?.animals) ? request.animals : []).some((animal) => Array.isArray(animal?.procedures));
}

function requestAnimals(request) {
  if (Array.isArray(request?.animals) && request.animals.length) return request.animals;
  const id = request?.animal_id || request?.animalId || "";
  const name = request?.animal_name || request?.animalName || request?.animal || "";
  const species = request?.species || "";
  const size = request?.size || "";
  const microchip = request?.animal_microchip || request?.animalMicrochip || "";
  return id || (typeof name === "string" && name) || species || size || microchip
    ? [{ id, name: typeof name === "string" ? name : "", species, size, microchip }]
    : [];
}

// The procedures each animal asked for, with their state: the stored one, or the one read from the request for what was never stored.
// `requestTypes` (the municipality's) only give the names. Requests that are not procedures (death, transfer, complaint) have none.
export function resolveRequestProcedures(request, requestTypes = []) {
  const animals = requestAnimals(request);
  const kind = request?.request_type ?? request?.type;
  if (!isProcedureRequest(kind)) return animals.map((animal) => ({ ...animal, procedures: [] }));
  const types = Array.isArray(requestTypes) ? requestTypes : [];
  return animals.map((animal) => {
    const stored = Array.isArray(animal?.procedures) ? animal.procedures : [];
    const procedures = animalRequestTypeIds(animal).map((requestTypeId, index) => {
      const name = types.find((type) => type?.id === requestTypeId)?.name || animal?.requestTypeNames?.[index] || requestTypeId;
      const saved = stored.find((item) => item?.requestTypeId === requestTypeId);
      if (saved && STATUSES.includes(saved.status)) return { ...saved, name };
      return { requestTypeId, name, status: statusFromRequest(request), schedule: scheduleFromRequest(request),
        microchip: isMicrochipProcedure(name) ? String(animal?.confirmedMicrochip || "") : "", prescription: null, rejection: null };
    });
    return { ...animal, procedures };
  });
}

// The request's status from its procedures: scheduled while any is scheduled, new while any waits, done when every one is closed and
// one was done, cancelled otherwise (as a no-show when every one was a no-show). `null` when there is no procedure.
export function deriveRequestStatus(animals) {
  const statuses = (Array.isArray(animals) ? animals : []).flatMap((animal) => (animal?.procedures || []).map((item) => item?.status));
  if (!statuses.length) return null;
  if (statuses.includes(SCHEDULED)) return { status: RequestStatus.SCHEDULED, cancelReason: "" };
  if (statuses.includes(WAITING)) return { status: RequestStatus.NEW, cancelReason: "" };
  if (statuses.includes(DONE)) return { status: RequestStatus.COMPLETED, cancelReason: "" };
  const cancelReason = statuses.every((status) => status === NO_SHOW) ? NO_SHOW_CANCEL_REASON
    : statuses.every((status) => status === REJECTED) ? REJECTED_CANCEL_REASON : CLOSED_WITHOUT_ATTENDANCE;
  return { status: RequestStatus.CANCELLED, cancelReason };
}
