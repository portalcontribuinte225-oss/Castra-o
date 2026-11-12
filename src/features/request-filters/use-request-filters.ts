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

export interface RequestFiltersState {
  filters: RequestListFilters;
  // Stages selected before "today" was turned on, restored when it is turned off again.
  stagesBeforeToday: RequestStage[] | null;
}

export enum RequestFiltersActionType {
  SELECT_CHIP = "selectChip",
  TOGGLE_TODAY = "toggleToday",
  TOGGLE_STAGE = "toggleStage",
  TOGGLE_TYPE = "toggleType",
  TOGGLE_ASSIGNEE = "toggleAssignee",
  CLEAR_DIMENSION = "clearDimension",
  CLEAR_ALL = "clearAll",
}

export type RequestFiltersAction =
  | { type: RequestFiltersActionType.SELECT_CHIP; stages: RequestStage[] }
  | { type: RequestFiltersActionType.TOGGLE_TODAY }
  | { type: RequestFiltersActionType.TOGGLE_STAGE; stage: RequestStage }
  | { type: RequestFiltersActionType.TOGGLE_TYPE; value: string }
  | { type: RequestFiltersActionType.TOGGLE_ASSIGNEE; value: string }
  | { type: RequestFiltersActionType.CLEAR_DIMENSION; dimension: RequestFilterDimension }
  | { type: RequestFiltersActionType.CLEAR_ALL };

export const initialRequestFiltersState: RequestFiltersState = {
  filters: initialRequestFilters,
  stagesBeforeToday: null,
};

function toggleValue<T>(values: T[], value: T): T[] {
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

// Turning "today" on drops the stage selection (it shows everything scheduled today);
// turning it off restores the previous stages unless the user picked new ones meanwhile.
function toggleToday(state: RequestFiltersState): RequestFiltersState {
  const { filters } = state;
  if (filters.todayOnly) {
    const stages = filters.stages.length > 0 ? filters.stages : state.stagesBeforeToday ?? [];
    return { filters: { ...filters, stages, todayOnly: false }, stagesBeforeToday: null };
  }
  return { filters: { ...filters, stages: [], todayOnly: true }, stagesBeforeToday: filters.stages };
}

export function requestFiltersReducer(state: RequestFiltersState, action: RequestFiltersAction): RequestFiltersState {
  const { filters } = state;
  switch (action.type) {
    case RequestFiltersActionType.SELECT_CHIP:
      return { filters: { ...filters, stages: [...action.stages], todayOnly: false }, stagesBeforeToday: null };
    case RequestFiltersActionType.TOGGLE_TODAY:
      return toggleToday(state);
    case RequestFiltersActionType.TOGGLE_STAGE:
      return { ...state, filters: { ...filters, stages: toggleValue(filters.stages, action.stage) } };
    case RequestFiltersActionType.TOGGLE_TYPE:
      return { ...state, filters: { ...filters, types: toggleValue(filters.types, action.value) } };
    case RequestFiltersActionType.TOGGLE_ASSIGNEE:
      return { ...state, filters: { ...filters, assignees: toggleValue(filters.assignees, action.value) } };
    case RequestFiltersActionType.CLEAR_DIMENSION:
      return { ...state, filters: clearDimension(filters, action.dimension) };
    case RequestFiltersActionType.CLEAR_ALL:
      return { filters: { stages: [], types: [], assignees: [], todayOnly: false }, stagesBeforeToday: null };
    default:
      return state;
  }
}

export function useRequestFilters() {
  const [state, dispatch] = useReducer(requestFiltersReducer, initialRequestFiltersState);
  const actions = useMemo(
    () => ({
      selectChip: (stages: RequestStage[]) => dispatch({ type: RequestFiltersActionType.SELECT_CHIP, stages }),
      toggleToday: () => dispatch({ type: RequestFiltersActionType.TOGGLE_TODAY }),
      toggleStage: (stage: RequestStage) => dispatch({ type: RequestFiltersActionType.TOGGLE_STAGE, stage }),
      toggleType: (value: string) => dispatch({ type: RequestFiltersActionType.TOGGLE_TYPE, value }),
      toggleAssignee: (value: string) => dispatch({ type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value }),
      clearDimension: (dimension: RequestFilterDimension) =>
        dispatch({ type: RequestFiltersActionType.CLEAR_DIMENSION, dimension }),
      clearAll: () => dispatch({ type: RequestFiltersActionType.CLEAR_ALL }),
    }),
    [],
  );
  return { filters: state.filters, actions };
}

export interface RequestFilterResults {
  activeRequests: AnyRecord[];
  counts: RequestFacetCounts;
  typeOptions: RequestFilterOption[];
  assigneeOptions: RequestFilterOption[];
  pills: ActiveFilterPill[];
}

// `normalizedRequests` feeds the option lists (independent of the global search);
// `listItems` is what the list actually shows before filters (after the global search).
export function useRequestFilterResults({
  filters,
  normalizedRequests,
  listItems,
  users,
  today,
}: {
  filters: RequestListFilters;
  normalizedRequests: AnyRecord[];
  listItems: AnyRecord[];
  users: AnyRecord[];
  today: string;
}): RequestFilterResults {
  return useMemo(() => {
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
  }, [filters, normalizedRequests, listItems, users, today]);
}
