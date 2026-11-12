import { describe, expect, it } from "vitest";
import { RequestFilterDimension, initialRequestFilters } from "./request-filters";
import type { RequestListFilters } from "./request-filters";
import { RequestStage } from "./request-stage";
import { RequestFiltersActionType, requestFiltersReducer } from "./use-request-filters";
import type { RequestFiltersAction } from "./use-request-filters";

function apply(state: RequestListFilters, ...actions: RequestFiltersAction[]): RequestListFilters {
  return actions.reduce(requestFiltersReducer, state);
}

describe("requestFiltersReducer", () => {
  it("starts with everything unfiltered", () => {
    expect(initialRequestFilters).toEqual({ stages: [], types: [], assignees: [], todayOnly: false });
  });

  it("toggles today without touching the other groups", () => {
    const withTypes = apply(initialRequestFilters, { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" });
    const on = apply(withTypes, { type: RequestFiltersActionType.TOGGLE_TODAY });
    expect(on).toEqual({ stages: [], types: ["Ninhada"], assignees: [], todayOnly: true });
    expect(apply(on, { type: RequestFiltersActionType.TOGGLE_TODAY })).toEqual(withTypes);
  });

  it("combines today with a stage selection", () => {
    const state = apply(
      initialRequestFilters,
      { type: RequestFiltersActionType.TOGGLE_TODAY },
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.SCHEDULED },
    );
    expect(state).toMatchObject({ todayOnly: true, stages: [RequestStage.SCHEDULED] });
  });

  it("toggles stage, type and assignee values without touching the other groups", () => {
    const added = apply(
      initialRequestFilters,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.INBOX },
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.ANALYSIS },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value: "u1" },
    );
    expect(added).toEqual({
      stages: [RequestStage.INBOX, RequestStage.ANALYSIS],
      types: ["Ninhada"],
      assignees: ["u1"],
      todayOnly: false,
    });
    const removed = apply(
      added,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.INBOX },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value: "u1" },
    );
    expect(removed).toEqual({ stages: [RequestStage.ANALYSIS], types: [], assignees: [], todayOnly: false });
  });

  it("clears a single group", () => {
    const base = apply(
      initialRequestFilters,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.INBOX },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value: "u1" },
    );
    expect(
      apply(base, { type: RequestFiltersActionType.CLEAR_DIMENSION, dimension: RequestFilterDimension.STAGES }),
    ).toMatchObject({ stages: [], types: ["Ninhada"], assignees: ["u1"] });
    expect(
      apply(base, { type: RequestFiltersActionType.CLEAR_DIMENSION, dimension: RequestFilterDimension.TYPES }),
    ).toMatchObject({ stages: [RequestStage.INBOX], types: [], assignees: ["u1"] });
    expect(
      apply(base, { type: RequestFiltersActionType.CLEAR_DIMENSION, dimension: RequestFilterDimension.ASSIGNEES }),
    ).toMatchObject({ stages: [RequestStage.INBOX], types: ["Ninhada"], assignees: [] });
  });

  it("clearing everything also turns today off", () => {
    const state = apply(
      initialRequestFilters,
      { type: RequestFiltersActionType.TOGGLE_TODAY },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.CLEAR_ALL },
    );
    expect(state).toEqual({ stages: [], types: [], assignees: [], todayOnly: false });
  });

  it("does not mutate the previous state", () => {
    const before = JSON.stringify(initialRequestFilters);
    apply(
      initialRequestFilters,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.DONE },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.TOGGLE_TODAY },
    );
    expect(JSON.stringify(initialRequestFilters)).toBe(before);
  });
});
