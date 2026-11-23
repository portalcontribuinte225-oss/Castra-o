import { getRequestDate, isInPeriod } from "../../analytics";
import { getItemMunicipalityId, normalizeScheduleDateText } from "../../domain";
import { normalizeSearchKey, normalizeText } from "../../utils";
import type { AnyRecord } from "../../types";
import { hasStoredProcedures } from "../../../shared/request-procedure-contract.js";
import { buildScheduleOccurrences, requestScheduleBookings, scheduleDate } from "../../../shared/schedule-contract.js";
import {
  NO_NEIGHBORHOOD_FILTER,
  NO_NEIGHBORHOOD_LABEL,
  animalNeighborhoodsOf,
  matchesNeighborhoodFilter,
  tutorNeighborhoodOf,
} from "../neighborhoods/neighborhood-report";
import { initialRequestFilters, RequestFilterDimension, requestFilterDimensionLabels } from "../request-filters/request-filters";
import type { RequestListFilters, RequestFilterOption, ActiveFilterPill } from "../request-filters/request-filters";
import { requestStageOptions } from "../request-filters/request-stage";
import {
  buildRequestFilterResults,
  requestFiltersReducer,
  RequestFiltersActionType,
} from "../request-filters/use-request-filters";

enum ReportFee {
  CHARGED = "charged",
  FREE = "free",
}

enum ReportAgendaKind {
  MUTIRAO = "mutirao",
  STANDARD = "agenda",
}

export enum ReportFilterDimension {
  SEARCH = "search",
  PERIOD = "period",
  FEE = "fee",
  AGENDA = "agendaKind",
  TUTOR_NEIGHBORHOOD = "tutorNeighborhood",
  ANIMAL_NEIGHBORHOOD = "animalNeighborhood",
}

export type ReportDimension = RequestFilterDimension | ReportFilterDimension;

export interface ReportFilters {
  start: string;
  end: string;
  fee: string;
  agendaKind: string;
  tutorNeighborhood: string;
  animalNeighborhood: string;
}

export interface ReportQuery {
  filters: RequestListFilters;
  report: ReportFilters;
  search: string;
  today: string;
}

export const emptyReportFilters: ReportFilters = {
  start: "", end: "", fee: "", agendaKind: "", tutorNeighborhood: "", animalNeighborhood: "",
};

export const emptyReportQuery: ReportQuery = {
  filters: initialRequestFilters,
  report: emptyReportFilters,
  search: "",
  today: "",
};

export const reportFeeOptions: RequestFilterOption[] = [
  { value: ReportFee.CHARGED, label: "Com taxa" },
  { value: ReportFee.FREE, label: "Gratuitas" },
];

export const reportAgendaOptions: RequestFilterOption[] = [
  { value: ReportAgendaKind.MUTIRAO, label: "Mutirão" },
  { value: ReportAgendaKind.STANDARD, label: "Agenda normal" },
];

export function hasReportFilters(filters: ReportFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export function hasInvalidReportPeriod({ start, end }: ReportFilters): boolean {
  return Boolean(start && end && start > end);
}

export function clearReportFilter(query: ReportQuery, dimension: ReportDimension): ReportQuery {
  if (dimension === ReportFilterDimension.SEARCH) return { ...query, search: "" };
  if (dimension === ReportFilterDimension.PERIOD) {
    return { ...query, report: { ...query.report, start: "", end: "" } };
  }
  if (dimension in query.report) return { ...query, report: { ...query.report, [dimension]: "" } };
  return { ...query, filters: requestFiltersReducer(query.filters, {
    type: RequestFiltersActionType.CLEAR_DIMENSION,
    dimension: dimension as RequestFilterDimension,
  }) };
}

function matchesSearch(request: AnyRecord, key: string): boolean {
  if (!key) return true;
  const searchable = normalizeSearchKey([
    request.protocol, request.tutor, request.tutor_name, request.cpf, request.email, request.phone,
    request.animalMicrochip, request.animal_microchip,
    ...request.animals.flatMap((animal) => [animal?.name, animal?.microchip]),
  ].filter(Boolean).join(" "));
  return searchable.includes(key) || normalizeText(searchable).includes(normalizeText(key));
}

function makeAgendaMatcher(scheduleDays: AnyRecord[], scheduleRules: AnyRecord[]) {
  const occurrencesByDate = new Map<string, ReturnType<typeof buildScheduleOccurrences>>();
  function occurrencesFor(municipalityId: string, date: string) {
    const key = `${municipalityId}:${date}`;
    let occurrences = occurrencesByDate.get(key);
    if (!occurrences) {
      const inMunicipality = (item: AnyRecord) => getItemMunicipalityId(item) === municipalityId;
      occurrences = buildScheduleOccurrences(scheduleDays.filter(inMunicipality), scheduleRules.filter(inMunicipality), date, date);
      occurrencesByDate.set(key, occurrences);
    }
    return occurrences;
  }
  return (request: AnyRecord, kind: string): boolean => {
    const municipalityId = getItemMunicipalityId(request);
    const bookings = requestScheduleBookings(request);
    const occurrenceKey = (request.workflowData || request.workflow_data)?.scheduleOccurrenceKey;
    // Historic requests can still carry only the overall appointment fields, even after their places are released.
    const candidates = bookings.length && hasStoredProcedures(request) ? bookings
      : [request.schedule_date, request.appointment, request.preferredSchedule].filter(Boolean).map((date) => ({ date, occurrenceKey }));
    return candidates.some((candidate) => {
      const date = scheduleDate(normalizeScheduleDateText(candidate.date).slice(0, 10));
      if (!date) return false;
      const occurrences = occurrencesFor(municipalityId, date);
      const occurrence = occurrences.find((item) => item.occurrenceKey === candidate.occurrenceKey) || occurrences[0];
      if (!occurrence) return false;
      const actualKind = normalizeText(occurrence.kind) === ReportAgendaKind.MUTIRAO ? ReportAgendaKind.MUTIRAO : ReportAgendaKind.STANDARD;
      return actualKind === kind;
    });
  };
}

export function hasRequestFee(request: AnyRecord): boolean {
  const fee = request.fee || request.billingAmount;
  return Boolean(fee && fee !== "Gratuito");
}

export function buildReportScope(
  requests: AnyRecord[], query: ReportQuery, users: AnyRecord[], scheduleDays: AnyRecord[], scheduleRules: AnyRecord[],
) {
  const { report, filters, search, today } = query;
  const searchKey = normalizeSearchKey(search.trim());
  const matchesAgenda = makeAgendaMatcher(scheduleDays, scheduleRules);
  const listItems = requests.filter((request) => (
    matchesSearch(request, searchKey)
    && ((!report.start && !report.end) || isInPeriod(getRequestDate(request), report.start, report.end))
    && (!report.fee || (report.fee === ReportFee.CHARGED) === hasRequestFee(request))
    && (!report.agendaKind || matchesAgenda(request, report.agendaKind))
    && matchesNeighborhoodFilter([tutorNeighborhoodOf(request)].filter(Boolean), report.tutorNeighborhood)
    && matchesNeighborhoodFilter(animalNeighborhoodsOf(request), report.animalNeighborhood)
  ));
  return buildRequestFilterResults({ filters, normalizedRequests: requests, listItems, users, today });
}

export function reportPeriod({ start, end }: ReportFilters): string {
  if (start && end) return `${normalizeScheduleDateText(start)} até ${normalizeScheduleDateText(end)}`;
  if (start) return `A partir de ${normalizeScheduleDateText(start)}`;
  if (end) return `Até ${normalizeScheduleDateText(end)}`;
  return "Todo o período";
}

function optionLabel(options: RequestFilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label || value;
}

function neighborhoodLabel(value: string): string {
  return value === NO_NEIGHBORHOOD_FILTER ? NO_NEIGHBORHOOD_LABEL : value;
}

function reportFilterDetails({ report }: ReportQuery) {
  return [
    { dimension: ReportFilterDimension.PERIOD, title: "Período", value: report.start || report.end ? reportPeriod(report) : "" },
    { dimension: ReportFilterDimension.FEE, title: "Taxa", value: optionLabel(reportFeeOptions, report.fee) },
    { dimension: ReportFilterDimension.AGENDA, title: "Agenda", value: optionLabel(reportAgendaOptions, report.agendaKind) },
    { dimension: ReportFilterDimension.TUTOR_NEIGHBORHOOD, title: "Bairro do tutor", value: neighborhoodLabel(report.tutorNeighborhood) },
    { dimension: ReportFilterDimension.ANIMAL_NEIGHBORHOOD, title: "Bairro do animal", value: neighborhoodLabel(report.animalNeighborhood) },
  ];
}

export function buildReportPills(
  query: ReportQuery, sharedPills: ActiveFilterPill[],
): ActiveFilterPill<ReportDimension>[] {
  return [
    ...(query.search ? [{ dimension: ReportFilterDimension.SEARCH, label: `Busca: ${query.search}` }] : []),
    ...sharedPills,
    ...reportFilterDetails(query).filter(({ value }) => value).map(({ dimension, title, value }) => ({
      dimension, label: `${title}: ${value}`,
    })),
  ];
}

export function buildReportFilterDetails(
  query: ReportQuery, types: RequestFilterOption[], assignees: RequestFilterOption[],
): [string, string][] {
  const { filters } = query;
  return [
    [requestFilterDimensionLabels[RequestFilterDimension.STAGES], filters.stages.map((value) => optionLabel(requestStageOptions, value)).join(", ") || "Todas"],
    [requestFilterDimensionLabels[RequestFilterDimension.TYPES], filters.types.map((value) => optionLabel(types, value)).join(", ") || "Todos"],
    [requestFilterDimensionLabels[RequestFilterDimension.ASSIGNEES], filters.assignees.map((value) => optionLabel(assignees, value)).join(", ") || "Todos"],
    ...reportFilterDetails(query).map(({ title, value }): [string, string] => [title, value || "Todos"]),
  ];
}
