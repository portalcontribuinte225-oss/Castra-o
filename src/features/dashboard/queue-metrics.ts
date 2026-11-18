import type { AnyRecord } from "../../types";
import { RequestStatus } from "../../../shared/request-contract.js";
import type { ChartItem } from "./dashboard-data";
import type { PeriodRange, SeriesGrouping } from "./dashboard-period";
import { pluralize } from "./dashboard-format";
import { average, percent } from "./metric-math";
import {
  CancelCause,
  arrivedInRange,
  cancelCauseOf,
  closedInRange,
  daysToCompleteOf,
  isCancelledRequest,
  isCompletedRequest,
  isNoShowRequest,
  isOpenRequest,
  outcomeDateOf,
  waitingDaysOf,
} from "./request-outcome";
import { averageSeries, type SeriesPoint } from "./time-series";

const WAITING_BANDS = [
  { label: "0 a 2 dias", from: 0, to: 2 },
  { label: "3 a 6 dias", from: 3, to: 6 },
  { label: "7 a 14 dias", from: 7, to: 14 },
  { label: "15 dias ou mais", from: 15, to: Infinity },
];

export interface QueueSnapshot {
  inAnalysis: number;
  waitingProcedure: number;
  averageWait: number | null;
  oldestWait: number | null;
  cancelled: number;
  rescheduled: number;
}

function requestCount(count: number): string {
  return pluralize(count, "solicitação", "solicitações");
}

// Today's queue by stage and how long it has been waiting; what left it cancelled in the period, and how many of the
// requests that arrived in the period had to be rescheduled.
export function queueSnapshot(requests: AnyRecord[], range: PeriodRange, now: Date): QueueSnapshot {
  const open = requests.filter(isOpenRequest);
  const waits = open.map((request) => waitingDaysOf(request, now)).filter((days): days is number => days !== null);
  return {
    inAnalysis: open.filter((request) => request.status === RequestStatus.NEW).length,
    waitingProcedure: open.filter((request) => request.status === RequestStatus.SCHEDULED).length,
    averageWait: average(waits),
    oldestWait: waits.length ? Math.max(...waits) : null,
    cancelled: closedInRange(requests, range).filter(isCancelledRequest).length,
    rescheduled: arrivedInRange(requests, range).filter((request) => Number(request.rescheduleCount) > 0).length,
  };
}

// How long today's open requests have been waiting, in bands.
export function queueAges(requests: AnyRecord[], now: Date): ChartItem[] {
  const ages = requests.filter(isOpenRequest).map((request) => waitingDaysOf(request, now)).filter((days): days is number => days !== null);
  return WAITING_BANDS.map((band) => ({ label: band.label, value: ages.filter((days) => days >= band.from && days <= band.to).length }));
}

// How far the requests that arrived in the period got, as a share of all that arrived: booked (still booked, completed or
// a no-show) and completed.
export function conversionFunnel(requests: AnyRecord[], range: PeriodRange): ChartItem[] {
  const arrived = arrivedInRange(requests, range);
  if (!arrived.length) return [];
  const booked = arrived.filter((request) => request.status === RequestStatus.SCHEDULED || isCompletedRequest(request) || isNoShowRequest(request)).length;
  const completed = arrived.filter(isCompletedRequest).length;
  return [
    { label: "Recebidas", value: 100, detail: requestCount(arrived.length) },
    { label: "Agendadas", value: percent(booked, arrived.length) ?? 0, detail: requestCount(booked) },
    { label: "Realizadas", value: percent(completed, arrived.length) ?? 0, detail: requestCount(completed) },
  ];
}

// Why the requests cancelled in the period left the queue.
export function cancelCauses(requests: AnyRecord[], range: PeriodRange): ChartItem[] {
  const cancelled = closedInRange(requests, range).filter(isCancelledRequest);
  const count = (cause: CancelCause) => cancelled.filter((request) => cancelCauseOf(request) === cause).length;
  return [
    { label: "Indeferidas", value: count(CancelCause.REJECTED) },
    { label: "Não compareceram", value: count(CancelCause.NO_SHOW) },
    { label: "Outros motivos", value: count(CancelCause.OTHER) },
  ];
}

// The mean days from arrival to visit, by the day of the visit.
export function completionTimeSeries(requests: AnyRecord[], range: PeriodRange, grouping: SeriesGrouping, now: Date): SeriesPoint[] {
  const completed = requests
    .filter(isCompletedRequest)
    .map((request) => ({ date: outcomeDateOf(request), value: daysToCompleteOf(request) }))
    .filter((item): item is { date: Date | null; value: number } => item.value !== null);
  return averageSeries({ days: completed }, range, grouping, now);
}
