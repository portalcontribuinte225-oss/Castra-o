import type { AuthChallenge } from "../tutor-access/auth-types";
import type { TrackedRequest } from "./tracking-types";

export enum TrackingStep { IDENTIFY = "identify", CODE = "code", VIEW = "view" }
export enum TrackingActionType { EDIT = "edit", START = "start", SENT = "sent", OPENED = "opened", FAILED = "failed", EXPIRED = "expired", CORRECT = "correct", RESTART = "restart" }

export const TRACKING_EXPIRED_MESSAGE = "Acompanhamento expirado. Solicite um novo código.";
const UNAUTHORIZED = 401;

export interface TrackingState {
  step: TrackingStep;
  protocol: string;
  contact: string;
  challenge: AuthChallenge | null;
  code: string;
  token: string;
  request: TrackedRequest | null;
  loading: boolean;
  error: string;
  retryUntil: number;
}

export function initialTrackingState(): TrackingState {
  return { step: TrackingStep.IDENTIFY, protocol: "", contact: "", challenge: null, code: "", token: "", request: null, loading: false, error: "", retryUntil: 0 };
}

export type TrackingAction =
  | { type: TrackingActionType.EDIT; fields: Partial<Pick<TrackingState, "protocol" | "contact" | "code">> }
  | { type: TrackingActionType.START }
  | { type: TrackingActionType.SENT; challenge: AuthChallenge }
  | { type: TrackingActionType.OPENED; token: string; request: TrackedRequest }
  | { type: TrackingActionType.FAILED; error: string; retryUntil?: number }
  | { type: TrackingActionType.EXPIRED | TrackingActionType.CORRECT | TrackingActionType.RESTART };

export function trackingReducer(state: TrackingState, action: TrackingAction): TrackingState {
  switch (action.type) {
    case TrackingActionType.EDIT: return { ...state, ...action.fields, error: "" };
    case TrackingActionType.START: return { ...state, loading: true, error: "" };
    case TrackingActionType.SENT: return { ...state, step: TrackingStep.CODE, challenge: action.challenge, code: "", loading: false, error: "", retryUntil: 0 };
    case TrackingActionType.OPENED: return { ...state, step: TrackingStep.VIEW, token: action.token, request: action.request, code: "", loading: false, error: "" };
    case TrackingActionType.FAILED: return { ...state, loading: false, error: action.error, retryUntil: action.retryUntil || state.retryUntil };
    case TrackingActionType.EXPIRED: return { ...initialTrackingState(), protocol: state.protocol, contact: state.contact, error: TRACKING_EXPIRED_MESSAGE };
    case TrackingActionType.CORRECT: return { ...state, step: TrackingStep.IDENTIFY, challenge: null, code: "", error: "" };
    case TrackingActionType.RESTART: return initialTrackingState();
  }
}

// A 401 means the short tracking session ended; any other failure keeps the user where they are.
export function trackingFailureAction(failure: { status?: number; message?: string; retryAfter?: number } | undefined, fallback: string, now = Date.now()): TrackingAction {
  if (failure?.status === UNAUTHORIZED) return { type: TrackingActionType.EXPIRED };
  return { type: TrackingActionType.FAILED, error: failure?.message || fallback, retryUntil: failure?.retryAfter ? now + failure.retryAfter * 1000 : undefined };
}
