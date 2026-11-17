import type { AnyRecord } from "../../types";
import { RequestStatus } from "../../../shared/request-contract.js";
import type { ChartItem } from "./dashboard-data";
import type { PeriodRange, SeriesGrouping } from "./dashboard-period";
import { average, percent } from "./metric-math";
import {
  arrivedInRange,
  closedInRange,
  createdDateOf,
  daysToCompleteOf,
  isCancelledRequest,
  isCompletedRequest,
  isNoShowRequest,
  isOpenRequest,
  outcomeDateOf,
  waitingDaysOf,
} from "./request-outcome";
import { countSeries, type SeriesPoint } from "./time-series";

export interface PeriodTotals {
  entries: number;
  completed: number;
  attendanceRate: number | null;
  averageDaysToComplete: number | null;
}

export interface QueueAlert {
  label: string;
  detail: string;
  value: number;
}

const LATE_QUEUE_DAYS = 7;

// What happened in a period: the requests that arrived, the visits done, the share of booked tutors who came (completed
// against completed plus no-shows) and how many days a completed request took.
export function periodTotals(requests: AnyRecord[], range: PeriodRange): PeriodTotals {
  const closed = closedInRange(requests, range);
  const completed = closed.filter(isCompletedRequest);
  const noShows = closed.filter(isNoShowRequest).length;
  return {
    entries: arrivedInRange(requests, range).length,
    completed: completed.length,
    attendanceRate: percent(completed.length, completed.length + noShows),
    averageDaysToComplete: average(completed.map(daysToCompleteOf).filter((days): days is number => days !== null)),
  };
}

export function openQueueSize(requests: AnyRecord[]): number {
  return requests.filter(isOpenRequest).length;
}

// Arrivals against completions per bucket: while arrivals run above, the queue grows.
export function flowSeries(requests: AnyRecord[], range: PeriodRange, grouping: SeriesGrouping, now: Date): SeriesPoint[] {
  return countSeries({
    entries: requests.map(createdDateOf),
    completed: requests.filter(isCompletedRequest).map(outcomeDateOf),
  }, range, grouping, now);
}

// Where the work stands: today's queue by stage, and what was completed or cancelled in the period.
export function volumeParts(requests: AnyRecord[], range: PeriodRange): ChartItem[] {
  const closed = closedInRange(requests, range);
  return [
    { label: "Em análise", value: requests.filter((request) => request.status === RequestStatus.NEW).length },
    { label: "Aguardando procedimento", value: requests.filter((request) => request.status === RequestStatus.SCHEDULED).length },
    { label: "Realizadas no período", value: closed.filter(isCompletedRequest).length },
    { label: "Canceladas no período", value: closed.filter(isCancelledRequest).length },
  ];
}

function hasIncompleteRegistration(request: AnyRecord): boolean {
  return !request.phone || !request.cpf || !request.address || !request.neighborhood || !request.cep;
}

// The open requests someone has to act on today.
export function queueAlerts(requests: AnyRecord[], now: Date): QueueAlert[] {
  const open = requests.filter(isOpenRequest);
  return [
    {
      label: "Sem responsável",
      detail: "Em aberto, sem ninguém atribuído.",
      value: open.filter((request) => !request.assignedUserId && !request.responsible).length,
    },
    {
      label: `Na fila há ${LATE_QUEUE_DAYS} dias ou mais`,
      detail: "Esperam há uma semana ou mais.",
      value: open.filter((request) => (waitingDaysOf(request, now) ?? 0) >= LATE_QUEUE_DAYS).length,
    },
    {
      label: "Cadastro incompleto",
      detail: "Em aberto, sem telefone, CPF, endereço, bairro ou CEP.",
      value: open.filter(hasIncompleteRegistration).length,
    },
  ];
}
