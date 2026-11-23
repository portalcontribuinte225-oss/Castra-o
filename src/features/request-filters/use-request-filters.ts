import { useMemo, useReducer } from "react";
import type { AnyRecord } from "../../types";
import type { RequestStage } from "./request-stage";
import {
  RequestFilterDimension,
  buildActiveFilterPills,
  buildAssigneeOptions,
  buildRequestFacetCounts,
  buildTypeOptions,
  filterRequestItems,
  initialRequestFilters,
} from "./request-filters";
import type {
  ActiveFilterPill,
  RequestFacetCounts,
  RequestFilterOption,
  RequestListFilters,
} from "./request-filters";

export enum RequestFiltersActionType {
  TOGGLE_TODAY = "toggleToday",
  TOGGLE_STAGE = "toggleStage",
  TOGGLE_TYPE = "toggleType",
  TOGGLE_ASSIGNEE = "toggleAssignee",
  CLEAR_DIMENSION = "clearDimension",
  CLEAR_ALL = "clearAll",
  APPLY = "apply",
}

export type RequestFiltersAction =
  | { type: RequestFiltersActionType.TOGGLE_TODAY }
  | { type: RequestFiltersActionType.TOGGLE_STAGE; stage: RequestStage }
  | { type: RequestFiltersActionType.TOGGLE_TYPE; value: string }
  | { type: RequestFiltersActionType.TOGGLE_ASSIGNEE; value: string }
  | { type: RequestFiltersActionType.CLEAR_DIMENSION; dimension: RequestFilterDimension }
  | { type: RequestFiltersActionType.CLEAR_ALL }
  | { type: RequestFiltersActionType.APPLY; filters: RequestListFilters };

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function clearDimension(filters: RequestListFilters, dimension: RequestFilterDimension): RequestListFilters {
  switch (dimension) {
    case RequestFilterDimension.STAGES:
      return { ...filters, stages: [] };
    case RequestFilterDimension.TYPES:
      return { ...filters, types: [] };
    case RequestFilterDimension.ASSIGNEES:
      return { ...filters, assignees: [] };
    default:
      return filters;
  }
}

export function requestFiltersReducer(filters: RequestListFilters, action: RequestFiltersAction): RequestListFilters {
  switch (action.type) {
    case RequestFiltersActionType.TOGGLE_TODAY:
      return { ...filters, todayOnly: !filters.todayOnly };
    case RequestFiltersActionType.TOGGLE_STAGE:
      return { ...filters, stages: toggleValue(filters.stages, action.stage) };
    case RequestFiltersActionType.TOGGLE_TYPE:
      return { ...filters, types: toggleValue(filters.types, action.value) };
    case RequestFiltersActionType.TOGGLE_ASSIGNEE:
      return { ...filters, assignees: toggleValue(filters.assignees, action.value) };
    case RequestFiltersActionType.CLEAR_DIMENSION:
      return clearDimension(filters, action.dimension);
    case RequestFiltersActionType.CLEAR_ALL:
      return initialRequestFilters;
    case RequestFiltersActionType.APPLY:
      return action.filters;
    default:
      return filters;
  }
}

export function useRequestFilters() {
  const [filters, dispatch] = useReducer(requestFiltersReducer, initialRequestFilters);
  const actions = useMemo(
    () => ({
      toggleToday: () => dispatch({ type: RequestFiltersActionType.TOGGLE_TODAY }),
      clearDimension: (dimension: RequestFilterDimension) =>
        dispatch({ type: RequestFiltersActionType.CLEAR_DIMENSION, dimension }),
      clearAll: () => dispatch({ type: RequestFiltersActionType.CLEAR_ALL }),
      apply: (filters: RequestListFilters) => dispatch({ type: RequestFiltersActionType.APPLY, filters }),
    }),
    [],
  );
  return { filters, actions };
}

export interface RequestFilterResults {
  activeRequests: AnyRecord[];
  counts: RequestFacetCounts;
  typeOptions: RequestFilterOption[];
  assigneeOptions: RequestFilterOption[];
  pills: ActiveFilterPill[];
}

interface RequestFilterResultsInput {
  filters: RequestListFilters;
  normalizedRequests: AnyRecord[];
  listItems: AnyRecord[];
  users: AnyRecord[];
  today: string;
}

// `normalizedRequests` feeds the option lists. `listItems` already respects search and any view-specific filters.
export function buildRequestFilterResults({
  filters, normalizedRequests, listItems, users, today,
}: RequestFilterResultsInput): RequestFilterResults {
  const context = { today };
  const typeOptions = buildTypeOptions(normalizedRequests, filters.types);
  const assigneeOptions = buildAssigneeOptions(normalizedRequests, users, filters.assignees);
  return {
    activeRequests: filterRequestItems(listItems, filters, context),
    counts: buildRequestFacetCounts(listItems, filters, context),
    typeOptions,
    assigneeOptions,
    pills: buildActiveFilterPills(filters, { types: typeOptions, assignees: assigneeOptions }),
  };
}

export function useRequestFilterResults({
  filters, normalizedRequests, listItems, users, today,
}: RequestFilterResultsInput): RequestFilterResults {
  return useMemo(
    () => buildRequestFilterResults({ filters, normalizedRequests, listItems, users, today }),
    [filters, normalizedRequests, listItems, users, today],
  );
}
