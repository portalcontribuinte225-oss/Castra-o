import type { AnyRecord } from "../../types";
import { requestHasTag } from "../../domain";

enum RequestStatus {
  NEW = "NOVA",
  SCHEDULED = "AGENDADA",
  DONE = "REALIZADA",
  CANCELED = "CANCELADA",
}

enum RequestWorkflowTag {
  ASSIGNED = "ATRIBUIDA",
  RESCHEDULED = "REAGENDADA",
}

export enum RequestStage {
  INBOX = "inbox",
  ANALYSIS = "analysis",
  SCHEDULED = "scheduled",
  RESCHEDULED = "rescheduled",
  DONE = "done",
  CANCELED = "canceled",
}

export enum RequestChipId {
  INBOX = "inbox",
  ANALYSIS = "analysis",
  SCHEDULED = "scheduled",
  CLOSED = "closed",
  ALL = "all",
}

export interface RequestStageChip {
  id: RequestChipId;
  label: string;
  stages: RequestStage[];
}

export const requestStageOrder: RequestStage[] = [
  RequestStage.INBOX,
  RequestStage.ANALYSIS,
  RequestStage.SCHEDULED,
  RequestStage.RESCHEDULED,
  RequestStage.DONE,
  RequestStage.CANCELED,
];

export const requestStageLabels: Record<RequestStage, string> = {
  [RequestStage.INBOX]: "Novas",
  [RequestStage.ANALYSIS]: "Em análise",
  [RequestStage.SCHEDULED]: "Agendadas",
  [RequestStage.RESCHEDULED]: "Reagendadas",
  [RequestStage.DONE]: "Realizadas",
  [RequestStage.CANCELED]: "Canceladas",
};

// Chips are shortcuts over the stage filter; an empty stage list means "any stage".
export const requestStageChips: RequestStageChip[] = [
  { id: RequestChipId.INBOX, label: requestStageLabels[RequestStage.INBOX], stages: [RequestStage.INBOX] },
  { id: RequestChipId.ANALYSIS, label: requestStageLabels[RequestStage.ANALYSIS], stages: [RequestStage.ANALYSIS] },
  {
    id: RequestChipId.SCHEDULED,
    label: requestStageLabels[RequestStage.SCHEDULED],
    stages: [RequestStage.SCHEDULED, RequestStage.RESCHEDULED],
  },
  { id: RequestChipId.CLOSED, label: "Encerradas", stages: [RequestStage.DONE, RequestStage.CANCELED] },
  { id: RequestChipId.ALL, label: "Todas", stages: [] },
];

// Expects a normalized request (status already mapped to one of the four statuses).
export function getRequestStage(request: AnyRecord = {}): RequestStage {
  switch (request.status) {
    case RequestStatus.SCHEDULED:
      return requestHasTag(request, RequestWorkflowTag.RESCHEDULED) ? RequestStage.RESCHEDULED : RequestStage.SCHEDULED;
    case RequestStatus.DONE:
      return RequestStage.DONE;
    case RequestStatus.CANCELED:
      return RequestStage.CANCELED;
    case RequestStatus.NEW:
    default:
      return requestHasTag(request, RequestWorkflowTag.ASSIGNED) ? RequestStage.ANALYSIS : RequestStage.INBOX;
  }
}

export function isSameStageSet(first: RequestStage[], second: RequestStage[]): boolean {
  return first.length === second.length && first.every((stage) => second.includes(stage));
}
