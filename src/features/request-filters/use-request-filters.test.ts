import { describe, expect, it } from "vitest";
import { RequestFilterDimension } from "./request-filters";
import { RequestStage } from "./request-stage";
import {
  RequestFiltersActionType,
  initialRequestFiltersState,
  requestFiltersReducer,
} from "./use-request-filters";
import type { RequestFiltersAction, RequestFiltersState } from "./use-request-filters";

function apply(state: RequestFiltersState, ...actions: RequestFiltersAction[]): RequestFiltersState {
  return actions.reduce(requestFiltersReducer, state);
}

const toggleToday: RequestFiltersAction = { type: RequestFiltersActionType.TOGGLE_TODAY };

describe("requestFiltersReducer", () => {
  it("starts on the inbox stage", () => {
    expect(initialRequestFiltersState.filters).toEqual({
      stages: [RequestStage.INBOX],
      types: [],
      assignees: [],
      todayOnly: false,
    });
  });

  it("selecting a chip replaces the stages and turns today off", () => {
    const state = apply(
      initialRequestFiltersState,
      toggleToday,
      { type: RequestFiltersActionType.SELECT_CHIP, stages: [RequestStage.DONE, RequestStage.CANCELED] },
    );
    expect(state.filters.stages).toEqual([RequestStage.DONE, RequestStage.CANCELED]);
    expect(state.filters.todayOnly).toBe(false);
    expect(state.stagesBeforeToday).toBeNull();
  });

  it("turning today on clears the stages and turning it off restores them", () => {
    const on = apply(initialRequestFiltersState, toggleToday);
    expect(on.filters).toMatchObject({ todayOnly: true, stages: [] });
    const off = apply(on, toggleToday);
    expect(off.filters).toMatchObject({ todayOnly: false, stages: [RequestStage.INBOX] });
    expect(off.stagesBeforeToday).toBeNull();
  });

  it("keeps stages picked while today was on when turning it off", () => {
    const state = apply(
      initialRequestFiltersState,
      toggleToday,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.SCHEDULED },
      toggleToday,
    );
    expect(state.filters).toMatchObject({ todayOnly: false, stages: [RequestStage.SCHEDULED] });
  });

  it("combines today with a stage selection", () => {
    const state = apply(
      initialRequestFiltersState,
      toggleToday,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.SCHEDULED },
    );
    expect(state.filters).toMatchObject({ todayOnly: true, stages: [RequestStage.SCHEDULED] });
  });

  it("toggles stage, type and assignee values without touching the other groups", () => {
    const added = apply(
      initialRequestFiltersState,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.ANALYSIS },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value: "u1" },
    );
    expect(added.filters).toEqual({
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
    expect(removed.filters).toEqual({ stages: [RequestStage.ANALYSIS], types: [], assignees: [], todayOnly: false });
  });

  it("clears a single group", () => {
    const base = apply(
      initialRequestFiltersState,
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.TOGGLE_ASSIGNEE, value: "u1" },
    );
    const clearedTypes = apply(base, {
      type: RequestFiltersActionType.CLEAR_DIMENSION,
      dimension: RequestFilterDimension.TYPES,
    });
    expect(clearedTypes.filters).toMatchObject({ types: [], assignees: ["u1"], stages: [RequestStage.INBOX] });
    const clearedStages = apply(base, {
      type: RequestFiltersActionType.CLEAR_DIMENSION,
      dimension: RequestFilterDimension.STAGES,
    });
    expect(clearedStages.filters).toMatchObject({ stages: [], types: ["Ninhada"] });
    const clearedAssignees = apply(base, {
      type: RequestFiltersActionType.CLEAR_DIMENSION,
      dimension: RequestFilterDimension.ASSIGNEES,
    });
    expect(clearedAssignees.filters).toMatchObject({ assignees: [], types: ["Ninhada"] });
  });

  it("clearing everything shows all requests instead of going back to the inbox", () => {
    const state = apply(
      initialRequestFiltersState,
      toggleToday,
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      { type: RequestFiltersActionType.CLEAR_ALL },
    );
    expect(state.filters).toEqual({ stages: [], types: [], assignees: [], todayOnly: false });
    expect(state.stagesBeforeToday).toBeNull();
  });

  it("does not mutate the previous state", () => {
    const before = JSON.stringify(initialRequestFiltersState);
    apply(
      initialRequestFiltersState,
      { type: RequestFiltersActionType.TOGGLE_STAGE, stage: RequestStage.DONE },
      { type: RequestFiltersActionType.TOGGLE_TYPE, value: "Ninhada" },
      toggleToday,
    );
    expect(JSON.stringify(initialRequestFiltersState)).toBe(before);
  });
});
