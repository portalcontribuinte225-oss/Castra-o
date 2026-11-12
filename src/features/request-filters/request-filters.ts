import type { AnyRecord } from "../../types";
import { isRequestOnScheduleDate, requestTypeLabel } from "../../domain";
import {
  RequestChipId,
  RequestStage,
  getRequestStage,
  isSameStageSet,
  requestStageChips,
  requestStageLabels,
  requestStageOrder,
} from "./request-stage";

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
  chips: Record<RequestChipId, number>;
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

export const initialRequestFilters: RequestListFilters = {
  stages: [RequestStage.INBOX],
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

export function filterRequestItems(
  items: AnyRecord[],
  filters: RequestListFilters,
  context: RequestFilterContext,
): AnyRecord[] {
  return items.filter((item) => {
    const facets = describeItem(item, context.today);
    return (
      matchesStages(facets, filters.stages)
      && matchesTypes(facets, filters.types)
      && matchesAssignees(facets, filters.assignees)
      && matchesToday(facets, filters.todayOnly)
    );
  });
}

function countBy<K extends string>(keys: readonly K[], count: (key: K) => number): Record<K, number> {
  const result = {} as Record<K, number>;
  keys.forEach((key) => {
    result[key] = count(key);
  });
  return result;
}

// Each count answers "how many items would the list show if this option were applied",
// considering every other active filter and ignoring the option's own dimension.
// Stage chips and the "today" count intentionally ignore the today toggle and the current stage selection.
export function buildRequestFacetCounts(
  items: AnyRecord[],
  filters: RequestListFilters,
  context: RequestFilterContext,
): RequestFacetCounts {
  const facetsList = items.map((item) => describeItem(item, context.today));
  const matchesTypeAndAssignee = (facets: ItemFacets) =>
    matchesTypes(facets, filters.types) && matchesAssignees(facets, filters.assignees);
  const countStages = (stages: RequestStage[]) =>
    facetsList.filter((facets) => matchesStages(facets, stages) && matchesTypeAndAssignee(facets)).length;

  const types: Record<string, number> = {};
  const assignees: Record<string, number> = {};
  facetsList.forEach((facets) => {
    if (facets.isAccessRequest) return;
    if (!matchesStages(facets, filters.stages) || !matchesToday(facets, filters.todayOnly)) return;
    if (matchesAssignees(facets, filters.assignees)) types[facets.typeKey] = (types[facets.typeKey] || 0) + 1;
    if (matchesTypes(facets, filters.types)) assignees[facets.assigneeKey] = (assignees[facets.assigneeKey] || 0) + 1;
  });

  return {
    chips: countBy(requestStageChips.map((chip) => chip.id), (id) => countStages(
      requestStageChips.find((chip) => chip.id === id)?.stages ?? [],
    )),
    stages: countBy(requestStageOrder, (stage) => countStages([stage])),
    today: facetsList.filter((facets) => matchesToday(facets, true) && matchesTypeAndAssignee(facets)).length,
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

// A stage selection needs its own pill only when no chip already represents it.
function hasCustomStageSelection(filters: RequestListFilters): boolean {
  if (filters.stages.length === 0) return false;
  return filters.todayOnly || !requestStageChips.some((chip) => isSameStageSet(chip.stages, filters.stages));
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

export function buildActiveFilterPills(
  filters: RequestListFilters,
  options: { types: RequestFilterOption[]; assignees: RequestFilterOption[] },
): ActiveFilterPill[] {
  const pills: ActiveFilterPill[] = [];
  if (hasCustomStageSelection(filters)) {
    const labels = requestStageOrder
      .filter((stage) => filters.stages.includes(stage))
      .map((stage) => requestStageLabels[stage]);
    pills.push({
      dimension: RequestFilterDimension.STAGES,
      label: `${requestFilterDimensionLabels[RequestFilterDimension.STAGES]}: ${summarizeLabels(labels)}`,
    });
  }
  const typePill = buildOptionPill(RequestFilterDimension.TYPES, options.types, filters.types);
  const assigneePill = buildOptionPill(RequestFilterDimension.ASSIGNEES, options.assignees, filters.assignees);
  if (typePill) pills.push(typePill);
  if (assigneePill) pills.push(assigneePill);
  return pills;
}

export function getEmptyListMessage(filters: RequestListFilters): EmptyListMessage {
  const isFiltered = filters.types.length > 0 || filters.assignees.length > 0 || hasCustomStageSelection(filters);
  if (isFiltered) {
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
    title: "Nenhuma solicitação nesta etapa",
    text: "Quando houver registros, eles aparecerão aqui.",
    canClear: false,
  };
}
