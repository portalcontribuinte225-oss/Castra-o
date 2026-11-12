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

export const requestStageOptions: { value: RequestStage; label: string }[] = requestStageOrder.map((stage) => ({
  value: stage,
  label: requestStageLabels[stage],
}));

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
