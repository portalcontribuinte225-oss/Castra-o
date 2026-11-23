import { RequestStatus, isProcedureRequest } from "./request-contract.js";
import { NO_SHOW_CANCEL_REASON, REJECTED_CANCEL_REASON } from "./notification-contract.js";
import { animalRequestTypeIds } from "./request-types-contract.js";

// Each procedure of each animal of a request has its own state, kept in `animals[i].procedures`:
//   { requestTypeId, status, schedule: { date, occurrenceKey, slotTime, locationName, address, addressUrl } | null,
//     microchip, prescription: { text, professionalName, professionalRegistry, issuedAt, issuedBy } | null,
//     rejection: { reason, note } | null, updatedAt, updatedBy }
// A procedure that is not stored yet is read from the request's own status and agenda.
// The request's status is derived from its procedures (deriveRequestStatus), so lists, filters and notices keep working.
export const ProcedureStatus = Object.freeze({
  WAITING: "AGUARDANDO", SCHEDULED: "AGENDADO", DONE: "REALIZADO", NO_SHOW: "NAO_COMPARECEU", REJECTED: "INDEFERIDO",
});

export const ProcedureAction = Object.freeze({
  SAVE: "save", CONFIRM_SCHEDULE: "confirm_schedule", ATTEND: "attend", NO_SHOW: "no_show",
  REJECT: "reject", RESCHEDULE: "reschedule", CANCEL_SCHEDULE: "cancel_schedule", PRESCRIPTION: "prescription",
});

export const MAX_HEALTH_TEXT = 2000;
export const MAX_PROCEDURE_NOTE = 1000;
export const MAX_PRESCRIPTION_TEXT = 5000;
export const MAX_PROFESSIONAL_TEXT = 120;

const { WAITING, SCHEDULED, DONE, NO_SHOW, REJECTED } = ProcedureStatus;
const OPEN = [WAITING, SCHEDULED];
const STATUSES = Object.values(ProcedureStatus);

// The statuses an action can start from; the status it leads to (actions not listed keep the status).
const ACTION_FROM = Object.freeze({
  [ProcedureAction.SAVE]: OPEN,
  [ProcedureAction.CONFIRM_SCHEDULE]: [WAITING],
  [ProcedureAction.ATTEND]: [SCHEDULED],
  [ProcedureAction.NO_SHOW]: [SCHEDULED],
  [ProcedureAction.REJECT]: OPEN,
  [ProcedureAction.RESCHEDULE]: OPEN,
  [ProcedureAction.CANCEL_SCHEDULE]: [SCHEDULED],
  [ProcedureAction.PRESCRIPTION]: OPEN,
});
const ACTION_RESULT = Object.freeze({
  [ProcedureAction.CONFIRM_SCHEDULE]: SCHEDULED, [ProcedureAction.ATTEND]: DONE,
  [ProcedureAction.NO_SHOW]: NO_SHOW, [ProcedureAction.REJECT]: REJECTED,
  [ProcedureAction.CANCEL_SCHEDULE]: WAITING,
});

export function canApplyProcedureAction(status, action) {
  return Boolean(ACTION_FROM[action]?.includes(status));
}

export function procedureStatusAfter(status, action) {
  return ACTION_RESULT[action] || status;
}

export function isOpenProcedure(procedure) {
  return OPEN.includes(procedure?.status);
}

// Open procedures keep a place until they are completed, rejected or marked absent.
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

function scheduleFromRequest(request) {
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
  return { status: RequestStatus.CANCELLED, cancelReason: statuses.every((status) => status === NO_SHOW) ? NO_SHOW_CANCEL_REASON : REJECTED_CANCEL_REASON };
}
