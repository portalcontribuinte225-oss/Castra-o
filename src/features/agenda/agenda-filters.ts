import { RequestStatus } from "../../../shared/request-contract.js";
import { requestTypeLabels } from "../../domain";
import type { AnyRecord } from "../../types";
import { summarizeLabels } from "../request-filters/request-filters";
import type { ActiveFilterPill, RequestFilterOption } from "../request-filters/request-filters";
import { toggleValue } from "../request-filters/use-request-filters";

export enum AgendaFilterDimension {
  TYPES = "types",
  STATUSES = "statuses",
}

export const agendaFilterDimensionLabels: Record<AgendaFilterDimension, string> = {
  [AgendaFilterDimension.TYPES]: "Tipo de atendimento",
  [AgendaFilterDimension.STATUSES]: "Status",
};

export interface AgendaFilters {
  types: string[];
  statuses: string[];
}

export interface AgendaFacetCounts {
  types: Record<string, number>;
  statuses: Record<string, number>;
}

// Every group empty means "show everything".
export const initialAgendaFilters: AgendaFilters = { types: [], statuses: [] };

export const agendaStatusOptions: RequestFilterOption[] = [
  { value: RequestStatus.NEW, label: "Nova" },
  { value: RequestStatus.SCHEDULED, label: "Agendada" },
  { value: RequestStatus.COMPLETED, label: "Realizada" },
  { value: RequestStatus.CANCELLED, label: "Cancelada" },
];

function matchesTypes(request: AnyRecord, types: string[]): boolean {
  return types.length === 0 || requestTypeLabels(request).some((label) => types.includes(label));
}

function matchesStatuses(request: AnyRecord, statuses: string[]): boolean {
  return statuses.length === 0 || statuses.includes(request.status);
}

export function isAgendaFiltersEmpty(filters: AgendaFilters): boolean {
  return filters.types.length === 0 && filters.statuses.length === 0;
}

// Expects normalized requests, whose status is one of the four request statuses.
export function filterAgendaRequests(requests: AnyRecord[], filters: AgendaFilters): AnyRecord[] {
  return requests.filter((request) => matchesTypes(request, filters.types) && matchesStatuses(request, filters.statuses));
}

// Each option counts what it would show while keeping the selection of the other group.
export function buildAgendaFacetCounts(requests: AnyRecord[], filters: AgendaFilters): AgendaFacetCounts {
  const counts: AgendaFacetCounts = { types: {}, statuses: {} };
  for (const request of requests) {
    if (matchesStatuses(request, filters.statuses)) {
      requestTypeLabels(request).forEach((label) => { counts.types[label] = (counts.types[label] || 0) + 1; });
    }
    if (matchesTypes(request, filters.types)) counts.statuses[request.status] = (counts.statuses[request.status] || 0) + 1;
  }
  return counts;
}

export function toggleAgendaFilter(filters: AgendaFilters, dimension: AgendaFilterDimension, value: string): AgendaFilters {
  return { ...filters, [dimension]: toggleValue(filters[dimension], value) };
}

export function clearAgendaFilter(filters: AgendaFilters, dimension: AgendaFilterDimension): AgendaFilters {
  return { ...filters, [dimension]: [] };
}

function optionPill(
  dimension: AgendaFilterDimension,
  options: RequestFilterOption[],
  selected: string[],
): ActiveFilterPill<AgendaFilterDimension> | null {
  const labels = options.filter((option) => selected.includes(option.value)).map((option) => option.label);
  if (labels.length === 0) return null;
  return { dimension, label: `${agendaFilterDimensionLabels[dimension]}: ${summarizeLabels(labels)}` };
}

export function buildAgendaFilterPills(
  filters: AgendaFilters,
  typeOptions: RequestFilterOption[],
): ActiveFilterPill<AgendaFilterDimension>[] {
  return [
    optionPill(AgendaFilterDimension.TYPES, typeOptions, filters.types),
    optionPill(AgendaFilterDimension.STATUSES, agendaStatusOptions, filters.statuses),
  ].filter((pill): pill is ActiveFilterPill<AgendaFilterDimension> => pill !== null);
}
