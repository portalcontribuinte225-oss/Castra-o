import { describe, expect, it } from "vitest";
import { TRACKING_EXPIRED_MESSAGE, TrackingActionType, TrackingStep, initialTrackingState, trackingFailureAction, trackingReducer } from "./tracking-state";
import type { TrackedRequest } from "./tracking-types";

const challenge = { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 };
const tracked: TrackedRequest = {
  protocol: "000123/2026", requestType: "Castração", status: "AGENDADA", createdAt: null, updatedAt: null, schedule: null,
  documents: { total: 0, approved: 0, needsCorrection: 0, pending: 0 },
};

describe("request tracking state", () => {
  it("goes from identification to the code and then to the view, clearing the code on the way", () => {
    let state = trackingReducer(initialTrackingState(), { type: TrackingActionType.EDIT, fields: { protocol: "000123/2026", contact: "citizen@example.com" } });
    state = trackingReducer(state, { type: TrackingActionType.START });
    expect(state.loading).toBe(true);
    state = trackingReducer(state, { type: TrackingActionType.SENT, challenge });
    expect(state).toMatchObject({ step: TrackingStep.CODE, challenge, loading: false, code: "", error: "" });
    state = trackingReducer(state, { type: TrackingActionType.EDIT, fields: { code: "123456" } });
    state = trackingReducer(state, { type: TrackingActionType.OPENED, token: "tracking-token", request: tracked });
    expect(state).toMatchObject({ step: TrackingStep.VIEW, token: "tracking-token", request: tracked, code: "", loading: false });
  });

  it("keeps the typed data when correcting and wipes everything on restart", () => {
    const sent = trackingReducer({ ...initialTrackingState(), protocol: "000123/2026", contact: "citizen@example.com" }, { type: TrackingActionType.SENT, challenge });
    const corrected = trackingReducer({ ...sent, code: "123" }, { type: TrackingActionType.CORRECT });
    expect(corrected).toMatchObject({ step: TrackingStep.IDENTIFY, protocol: "000123/2026", contact: "citizen@example.com", challenge: null, code: "" });
    const opened = trackingReducer(sent, { type: TrackingActionType.OPENED, token: "tracking-token", request: tracked });
    expect(trackingReducer(opened, { type: TrackingActionType.RESTART })).toEqual(initialTrackingState());
  });

  it("returns to identification without the token when the short session ends", () => {
    const opened = trackingReducer({ ...initialTrackingState(), protocol: "000123/2026", contact: "citizen@example.com" }, { type: TrackingActionType.OPENED, token: "tracking-token", request: tracked });
    const expired = trackingReducer(opened, { type: TrackingActionType.EXPIRED });
    expect(expired).toMatchObject({ step: TrackingStep.IDENTIFY, token: "", request: null, challenge: null, error: TRACKING_EXPIRED_MESSAGE, protocol: "000123/2026" });
  });

  it("maps a 401 to expiry and any other failure to its own message and waiting time", () => {
    expect(trackingFailureAction({ status: 401, message: "Acompanhamento expirado." }, "fallback")).toEqual({ type: TrackingActionType.EXPIRED });
    expect(trackingFailureAction({ status: 429, message: "Aguarde para tentar novamente.", retryAfter: 60 }, "fallback", 1_000))
      .toEqual({ type: TrackingActionType.FAILED, error: "Aguarde para tentar novamente.", retryUntil: 61_000 });
    expect(trackingFailureAction({ status: 400 }, "fallback")).toEqual({ type: TrackingActionType.FAILED, error: "fallback", retryUntil: undefined });
    expect(trackingFailureAction(undefined, "fallback")).toEqual({ type: TrackingActionType.FAILED, error: "fallback", retryUntil: undefined });
    const failed = trackingReducer({ ...initialTrackingState(), loading: true, retryUntil: 5 }, { type: TrackingActionType.FAILED, error: "x" });
    expect(failed).toMatchObject({ loading: false, error: "x", retryUntil: 5 });
  });
});
