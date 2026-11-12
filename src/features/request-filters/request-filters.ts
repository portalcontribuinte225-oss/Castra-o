import type { AnyRecord } from "../../types";
import { isRequestOnScheduleDate, requestTypeLabel } from "../../domain";
import { RequestStage, getRequestStage, requestStageOptions, requestStageOrder } from "./request-stage";

export const ACCESS_REQUEST_SOURCE = "access_request";
export const UNASSIGNED_ASSIGNEE_KEY = "__unassigned__";

const UNASSIGNED_ASSIGNEE_LABEL = "Sem responsável";
const UNKNOWN_ASSIGNEE_LABEL = "Responsável não identificado";
const MAX_PILL_VALUES = 2;
const SHORT_ID_LENGTH = 6;

export enum RequestFilterDimension {
  STAGES = "stages",
  TYPES = "types",
  ASSIGNEES = "assignees",
}

export const requestFilterDimensionLabels: Record<RequestFilterDimension, string> = {
  [RequestFilterDimension.STAGES]: "Etapa",
  [RequestFilterDimension.TYPES]: "Tipo",
  [RequestFilterDimension.ASSIGNEES]: "Responsável",
};

export interface RequestListFilters {
  stages: RequestStage[];
  types: string[];
  assignees: string[];
  todayOnly: boolean;
}

export interface RequestFilterContext {
  today: string;
}

export interface RequestFilterOption {
  value: string;
  label: string;
}

export interface RequestFacetCounts {
  stages: Record<RequestStage, number>;
  today: number;
  types: Record<string, number>;
  assignees: Record<string, number>;
}

export interface ActiveFilterPill {
  dimension: RequestFilterDimension;
  label: string;
}

export interface EmptyListMessage {
  title: string;
  text: string;
  canClear: boolean;
}

// Every group empty means "show everything".
export const initialRequestFilters: RequestListFilters = {
  stages: [],
  types: [],
  assignees: [],
  todayOnly: false,
};

interface ItemFacets {
  isAccessRequest: boolean;
  stage: RequestStage;
  typeKey: string;
  assigneeKey: string;
  isToday: boolean;
}

interface OmittedFilters {
  stages?: boolean;
  types?: boolean;
  assignees?: boolean;
  today?: boolean;
}

function isAccessRequestItem(item: AnyRecord): boolean {
  return item.__source === ACCESS_REQUEST_SOURCE;
}

function describeItem(item: AnyRecord, today: string): ItemFacets {
  const isAccessRequest = isAccessRequestItem(item);
  return {
    isAccessRequest,
    stage: getRequestStage(item),
    typeKey: isAccessRequest ? "" : requestTypeLabel(item),
    assigneeKey: item.assignedUserId || UNASSIGNED_ASSIGNEE_KEY,
    isToday: !isAccessRequest && isRequestOnScheduleDate(item, today),
  };
}

// Access requests only take part in the "inbox" stage, and only when it is explicitly selected.
function matchesStages(facets: ItemFacets, stages: RequestStage[]): boolean {
  if (facets.isAccessRequest) return facets.stage === RequestStage.INBOX && stages.includes(RequestStage.INBOX);
  return stages.length === 0 || stages.includes(facets.stage);
}

function matchesTypes(facets: ItemFacets, types: string[]): boolean {
  return types.length === 0 || (!facets.isAccessRequest && types.includes(facets.typeKey));
}

function matchesAssignees(facets: ItemFacets, assignees: string[]): boolean {
  return assignees.length === 0 || (!facets.isAccessRequest && assignees.includes(facets.assigneeKey));
}

function matchesToday(facets: ItemFacets, todayOnly: boolean): boolean {
  return !todayOnly || facets.isToday;
}

function matchesFilters(facets: ItemFacets, filters: RequestListFilters, omit: OmittedFilters = {}): boolean {
  return (
    (omit.stages || matchesStages(facets, filters.stages))
    && (omit.types || matchesTypes(facets, filters.types))
    && (omit.assignees || matchesAssignees(facets, filters.assignees))
    && (omit.today || matchesToday(facets, filters.todayOnly))
  );
}

export function filterRequestItems(
  items: AnyRecord[],
  filters: RequestListFilters,
  context: RequestFilterContext,
): AnyRecord[] {
  return items.filter((item) => matchesFilters(describeItem(item, context.today), filters));
}

function countBy<K extends string>(keys: readonly K[], count: (key: K) => number): Record<K, number> {
  const result = {} as Record<K, number>;
  keys.forEach((key) => {
    result[key] = count(key);
  });
  return result;
}

// Each count answers "how many items would the list show if this option were applied":
// every other active filter is considered and the option's own filter group is ignored.
export function buildRequestFacetCounts(
  items: AnyRecord[],
  filters: RequestListFilters,
  context: RequestFilterContext,
): RequestFacetCounts {
  const facetsList = items.map((item) => describeItem(item, context.today));
  const count = (predicate: (facets: ItemFacets) => boolean) => facetsList.filter(predicate).length;

  const types: Record<string, number> = {};
  const assignees: Record<string, number> = {};
  facetsList.forEach((facets) => {
    if (facets.isAccessRequest) return;
    if (matchesFilters(facets, filters, { types: true })) types[facets.typeKey] = (types[facets.typeKey] || 0) + 1;
    if (matchesFilters(facets, filters, { assignees: true })) {
      assignees[facets.assigneeKey] = (assignees[facets.assigneeKey] || 0) + 1;
    }
  });

  return {
    stages: countBy(requestStageOrder, (stage) => count(
      (facets) => matchesStages(facets, [stage]) && matchesFilters(facets, filters, { stages: true }),
    )),
    today: count((facets) => facets.isToday && matchesFilters(facets, filters, { today: true })),
    types,
    assignees,
  };
}

function compareLabels(first: string, second: string): number {
  return first.localeCompare(second, "pt-BR");
}

// Two users can share a name; append the e-mail (or a short id) so their options stay distinguishable.
function disambiguateDuplicateLabels(
  options: RequestFilterOption[],
  detailByValue: Map<string, string>,
): RequestFilterOption[] {
  const occurrences = new Map<string, number>();
  options.forEach((option) => occurrences.set(option.label, (occurrences.get(option.label) ?? 0) + 1));
  return options.map((option) => {
    if ((occurrences.get(option.label) ?? 0) < 2) return option;
    const detail = detailByValue.get(option.value) || option.value.slice(0, SHORT_ID_LENGTH);
    return { ...option, label: `${option.label} (${detail})` };
  });
}

// Selected values are always kept as options so a filter that vanished from the data can still be removed.
export function buildTypeOptions(items: AnyRecord[], selected: string[] = []): RequestFilterOption[] {
  const labels = new Set<string>(selected);
  items.forEach((item) => {
    if (!isAccessRequestItem(item)) labels.add(requestTypeLabel(item));
  });
  return [...labels].sort(compareLabels).map((label) => ({ value: label, label }));
}

export function buildAssigneeOptions(
  items: AnyRecord[],
  users: AnyRecord[] = [],
  selected: string[] = [],
): RequestFilterOption[] {
  const userNameById = new Map<string, string>();
  const userEmailById = new Map<string, string>();
  (Array.isArray(users) ? users : []).forEach((user) => {
    if (!user?.id) return;
    if (user.name) userNameById.set(user.id, user.name);
    if (user.email) userEmailById.set(user.id, user.email);
  });

  const responsibleById = new Map<string, string>();
  let hasUnassigned = selected.includes(UNASSIGNED_ASSIGNEE_KEY);
  items.forEach((item) => {
    if (isAccessRequestItem(item)) return;
    if (!item.assignedUserId) {
      hasUnassigned = true;
      return;
    }
    if (!responsibleById.get(item.assignedUserId)) responsibleById.set(item.assignedUserId, item.responsible || "");
  });
  selected.forEach((key) => {
    if (key !== UNASSIGNED_ASSIGNEE_KEY && !responsibleById.has(key)) responsibleById.set(key, "");
  });

  const assigned = disambiguateDuplicateLabels(
    [...responsibleById.entries()].map(([value, responsible]) => ({
      value,
      label: userNameById.get(value) || responsible || UNKNOWN_ASSIGNEE_LABEL,
    })),
    userEmailById,
  ).sort((first, second) => compareLabels(first.label, second.label));

  return hasUnassigned
    ? [{ value: UNASSIGNED_ASSIGNEE_KEY, label: UNASSIGNED_ASSIGNEE_LABEL }, ...assigned]
    : assigned;
}

export function isRequestFiltersEmpty(filters: RequestListFilters): boolean {
  return filters.stages.length === 0
    && filters.types.length === 0
    && filters.assignees.length === 0
    && !filters.todayOnly;
}

function summarizeLabels(labels: string[]): string {
  const visible = labels.slice(0, MAX_PILL_VALUES).join(", ");
  const hidden = labels.length - MAX_PILL_VALUES;
  return hidden > 0 ? `${visible} +${hidden}` : visible;
}

function buildOptionPill(
  dimension: RequestFilterDimension,
  options: RequestFilterOption[],
  selected: string[],
): ActiveFilterPill | null {
  const labels = options.filter((option) => selected.includes(option.value)).map((option) => option.label);
  if (labels.length === 0) return null;
  return { dimension, label: `${requestFilterDimensionLabels[dimension]}: ${summarizeLabels(labels)}` };
}

// The "today" toggle has its own button state, so it never gets a pill.
export function buildActiveFilterPills(
  filters: RequestListFilters,
  options: { types: RequestFilterOption[]; assignees: RequestFilterOption[] },
): ActiveFilterPill[] {
  return [
    buildOptionPill(RequestFilterDimension.STAGES, requestStageOptions, filters.stages),
    buildOptionPill(RequestFilterDimension.TYPES, options.types, filters.types),
    buildOptionPill(RequestFilterDimension.ASSIGNEES, options.assignees, filters.assignees),
  ].filter((pill): pill is ActiveFilterPill => pill !== null);
}

export function formatRequestCount(count: number): string {
  return `${count} ${count === 1 ? "solicitação" : "solicitações"}`;
}

export function getEmptyListMessage(filters: RequestListFilters): EmptyListMessage {
  if (filters.stages.length > 0 || filters.types.length > 0 || filters.assignees.length > 0) {
    return {
      title: "Nenhuma solicitação encontrada",
      text: "Nenhuma solicitação corresponde aos filtros selecionados.",
      canClear: true,
    };
  }
  if (filters.todayOnly) {
    return {
      title: "Nenhuma agenda para hoje",
      text: "Solicitações sem agendamento para hoje não entram neste recorte.",
      canClear: false,
    };
  }
  return {
    title: "Nenhuma solicitação encontrada",
    text: "Quando houver registros, eles aparecerão aqui.",
    canClear: false,
  };
}
