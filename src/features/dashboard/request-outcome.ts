import type { AnyRecord } from "../../types";
import { normalizeScheduleDateText } from "../../domain";
import { parseAnyDate } from "../../analytics";
import { RequestStatus } from "../../../shared/request-contract.js";
import { NO_SHOW_CANCEL_REASON, REJECTED_CANCEL_REASON } from "../../../shared/notification-contract.js";
import { daysBetween, isInRange, type PeriodRange } from "./dashboard-period";

// Why a cancelled request left the queue.
export enum CancelCause {
  REJECTED = "rejected",
  NO_SHOW = "no_show",
  OTHER = "other",
}

export function isOpenRequest(request: AnyRecord): boolean {
  return request.status === RequestStatus.NEW || request.status === RequestStatus.SCHEDULED;
}

export function isCompletedRequest(request: AnyRecord): boolean {
  return request.status === RequestStatus.COMPLETED;
}

export function isCancelledRequest(request: AnyRecord): boolean {
  return request.status === RequestStatus.CANCELLED;
}

// The reason the staff screen stores on a cancellation tells a rejection and a no-show from any other cancellation.
export function cancelCauseOf(request: AnyRecord): CancelCause | null {
  if (!isCancelledRequest(request)) return null;
  const reason = String((request.workflow_data || request.workflowData || {}).cancelReason || "").trim();
  if (reason === NO_SHOW_CANCEL_REASON) return CancelCause.NO_SHOW;
  if (reason === REJECTED_CANCEL_REASON || request.rejectionReason) return CancelCause.REJECTED;
  return CancelCause.OTHER;
}

export function isNoShowRequest(request: AnyRecord): boolean {
  return cancelCauseOf(request) === CancelCause.NO_SHOW;
}

export function createdDateOf(request: AnyRecord): Date | null {
  return parseAnyDate(request.createdAt || request.created_at);
}

// The agenda day the request is booked for, as "dd/mm/yyyy" (or "" when it has none).
export function scheduleDayTextOf(request: AnyRecord): string {
  const text = normalizeScheduleDateText(request.preferredSchedule || request.appointment);
  return /^\d{2}\/\d{2}\/\d{4}/.test(text) ? text.slice(0, 10) : "";
}

export function scheduleDateOf(request: AnyRecord): Date | null {
  return parseAnyDate(scheduleDayTextOf(request));
}

// When a closed request reached its outcome: the day of its visit for a completed request or a no-show, the last update for
// any other cancellation. An open request has none.
export function outcomeDateOf(request: AnyRecord): Date | null {
  if (isOpenRequest(request)) return null;
  const visit = isCompletedRequest(request) || isNoShowRequest(request) ? scheduleDateOf(request) : null;
  return visit || parseAnyDate(request.updatedAt || request.updated_at) || createdDateOf(request);
}

// The requests whose outcome happened in the range.
export function closedInRange(requests: AnyRecord[], range: PeriodRange): AnyRecord[] {
  return requests.filter((request) => !isOpenRequest(request) && isInRange(outcomeDateOf(request), range));
}

export function arrivedInRange(requests: AnyRecord[], range: PeriodRange): AnyRecord[] {
  return requests.filter((request) => isInRange(createdDateOf(request), range));
}

// Days from the arrival of a completed request to its visit.
export function daysToCompleteOf(request: AnyRecord): number | null {
  if (!isCompletedRequest(request)) return null;
  const created = createdDateOf(request);
  const completed = outcomeDateOf(request);
  if (!created || !completed) return null;
  const days = daysBetween(created, completed);
  return days >= 0 ? days : null;
}

// How many days an open request has been waiting.
export function waitingDaysOf(request: AnyRecord, now: Date): number | null {
  const created = createdDateOf(request);
  return created ? Math.max(daysBetween(created, now), 0) : null;
}
