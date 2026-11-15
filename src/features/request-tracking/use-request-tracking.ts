import { useReducer } from "react";
import { api, ApiError } from "../../api";
import { TRACKING_CODE_PATTERN } from "../../../shared/request-tracking-contract.js";
import { useAuthChallengeClock } from "../tutor-access/use-auth-challenge-clock";
import { useAuthOperation } from "../tutor-access/use-auth-operation";
import { TrackingActionType, initialTrackingState, trackingFailureAction, trackingReducer } from "./tracking-state";
import type { TrackingState } from "./tracking-state";

export function useRequestTracking(municipalityId: string) {
  const [state, dispatch] = useReducer(trackingReducer, undefined, initialTrackingState);
  const operation = useAuthOperation(municipalityId);
  const clock = useAuthChallengeClock(state.challenge, state.retryUntil);
  const fail = (failure: unknown, fallback: string) => dispatch(trackingFailureAction(failure instanceof ApiError ? failure : undefined, fallback));

  async function send() {
    if (state.loading || clock.retryIn > 0 || !municipalityId || !state.protocol.trim() || !state.contact.trim()) return;
    const request = operation.begin();
    dispatch({ type: TrackingActionType.START });
    try {
      const challenge = await api.startRequestTracking({ municipalityId, protocol: state.protocol.trim(), contact: state.contact.trim() }, request);
      if (request.isCurrent()) dispatch({ type: TrackingActionType.SENT, challenge });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível enviar o código."); }
  }

  async function open() {
    if (state.loading || !state.challenge || clock.expiresIn === 0 || !TRACKING_CODE_PATTERN.test(state.code)) return;
    const request = operation.begin();
    dispatch({ type: TrackingActionType.START });
    try {
      const session = await api.confirmRequestTracking(state.challenge.challengeId, state.code, request);
      const result = await api.getTrackedRequest(session.token, request);
      if (request.isCurrent()) dispatch({ type: TrackingActionType.OPENED, token: session.token, request: result.request });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível consultar a solicitação."); }
  }

  async function refresh() {
    if (state.loading || !state.token) return;
    const request = operation.begin();
    dispatch({ type: TrackingActionType.START });
    try {
      const result = await api.getTrackedRequest(state.token, request);
      if (request.isCurrent()) dispatch({ type: TrackingActionType.OPENED, token: state.token, request: result.request });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível atualizar a solicitação."); }
  }

  return {
    ...state, clock, send, open, refresh,
    edit: (fields: Partial<Pick<TrackingState, "protocol" | "contact" | "code">>) => dispatch({ type: TrackingActionType.EDIT, fields }),
    correct: () => { operation.cancel(); dispatch({ type: TrackingActionType.CORRECT }); },
    restart: () => { operation.cancel(); dispatch({ type: TrackingActionType.RESTART }); },
  };
}
