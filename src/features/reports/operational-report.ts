import { RequestStatus } from "../../../shared/request-contract.js";
import { countBy, countByMany, sumValues, topItems } from "../../analytics";
import { requestResultLabel, requestTypeLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { NO_NEIGHBORHOOD_LABEL, animalNeighborhoodsOf, neighborhoodsLabel, tutorNeighborhoodOf } from "../neighborhoods/neighborhood-report";
import { requestAssigneeKey, type RequestFilterOption } from "../request-filters/request-filters";
import { getRequestStage, requestStageLabels } from "../request-filters/request-stage";
import { hasRequestFee } from "./report-filters";

export const reportColumns = [
  "Protocolo", "Tutor", "Microchip", "Bairro do tutor", "Bairro do animal", "Tipo", "Etapa", "Resultado", "Responsável", "Taxa",
];

export function buildOperationalReport(requests: AnyRecord[], assignees: RequestFilterOption[]) {
  const assigneeLabels = new Map(assignees.map(({ value, label }) => [value, label]));
  const assigneeLabel = (request: AnyRecord) => assigneeLabels.get(requestAssigneeKey(request)) || "";
  const stageLabel = (request: AnyRecord) => requestStageLabels[getRequestStage(request)];
  const feeLabel = (request: AnyRecord) => hasRequestFee(request) ? "Com taxa" : "Gratuito";
  const rows = requests.map((request, index) => ({
    key: request.id || `${request.protocol}:${index}`,
    cells: [
      request.protocol || request.id,
      request.tutor || "Não informado",
      request.animalMicrochip || request.animal_microchip || request.animals.find((animal) => animal?.microchip)?.microchip || "-",
      tutorNeighborhoodOf(request) || NO_NEIGHBORHOOD_LABEL,
      neighborhoodsLabel(animalNeighborhoodsOf(request)),
      requestTypeLabels(request).join(", "),
      stageLabel(request),
      requestResultLabel(request),
      assigneeLabel(request),
      request.fee || request.billingAmount || "Gratuito",
    ].map((value) => String(value ?? "")),
  }));
  const allAssignees = countBy(requests, assigneeLabel);
  const breakdowns = [
    { title: "Etapa", items: countBy(requests, stageLabel) },
    { title: "Resultado", items: countBy(requests, requestResultLabel) },
    { title: "Tipos de solicitação", items: countByMany(requests, requestTypeLabels) },
    { title: "Responsáveis", items: topItems(allAssignees), total: sumValues(allAssignees) },
    { title: "Taxas", items: countBy(requests, feeLabel) },
  ].map(({ title, items, total }) => ({ title, items, total: total ?? sumValues(items) }));
  return {
    rows,
    breakdowns,
    activeCount: requests.filter((request) => request.status === RequestStatus.NEW || request.status === RequestStatus.SCHEDULED).length,
    completedCount: requests.filter((request) => request.status === RequestStatus.COMPLETED).length,
  };
}

export type OperationalReport = ReturnType<typeof buildOperationalReport>;
