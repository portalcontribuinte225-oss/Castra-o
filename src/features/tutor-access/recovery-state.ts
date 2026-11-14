import type { AuthChallenge, RecoveryOption, RecoveryOptions } from "./auth-types";
import { AuthErrorCode } from "../../../shared/auth-contract.js";

export enum RecoveryStep { IDENTIFY = "identify", OPTIONS = "options", RESET = "reset" }
export enum RecoveryActionType { EDIT = "edit", START = "start", DISCOVERED = "discovered", SENT = "sent", FAILED = "failed", REIDENTIFY = "reidentify", RESTART = "restart", CLEAR = "clear" }
export interface RecoveryState {
  step: RecoveryStep;
  identifier: string;
  recoveryToken: string;
  options: RecoveryOption[];
  selectedOptionId: string;
  challenge: AuthChallenge | null;
  code: string;
  password: string;
  confirm: string;
  loading: boolean;
  error: string;
  retryUntil: number;
}
export function initialRecoveryState(identifier = ""): RecoveryState { return { step: RecoveryStep.IDENTIFY, identifier, recoveryToken: "", options: [], selectedOptionId: "", challenge: null, code: "", password: "", confirm: "", loading: false, error: "", retryUntil: 0 }; }
export type RecoveryAction =
  | { type: RecoveryActionType.EDIT; fields: Partial<Pick<RecoveryState, "identifier" | "code" | "password" | "confirm">> }
  | { type: RecoveryActionType.START }
  | { type: RecoveryActionType.DISCOVERED; result: RecoveryOptions }
  | { type: RecoveryActionType.SENT; challenge: AuthChallenge; optionId: string; error: string }
  | { type: RecoveryActionType.FAILED; error: string; retryUntil?: number }
  | { type: RecoveryActionType.REIDENTIFY; error: string }
  | { type: RecoveryActionType.RESTART | RecoveryActionType.CLEAR };

export function recoveryReducer(state: RecoveryState, action: RecoveryAction): RecoveryState {
  switch (action.type) {
    case RecoveryActionType.EDIT: return { ...state, ...action.fields, error: "" };
    case RecoveryActionType.START: return { ...state, loading: true, error: "" };
    case RecoveryActionType.DISCOVERED: return { ...state, step: RecoveryStep.OPTIONS, recoveryToken: action.result.recoveryToken, options: action.result.options, challenge: null, selectedOptionId: "", code: "", password: "", confirm: "", loading: false, retryUntil: 0 };
    case RecoveryActionType.SENT: return { ...state, step: RecoveryStep.RESET, challenge: action.challenge, selectedOptionId: action.optionId, code: "", password: "", confirm: "", loading: false, error: action.error, retryUntil: 0 };
    case RecoveryActionType.FAILED: return { ...state, loading: false, error: action.error, retryUntil: action.retryUntil || state.retryUntil };
    case RecoveryActionType.REIDENTIFY: return { ...initialRecoveryState(state.identifier), error: action.error, retryUntil: state.retryUntil };
    case RecoveryActionType.RESTART: return { ...initialRecoveryState(state.identifier), retryUntil: state.retryUntil };
    case RecoveryActionType.CLEAR: return initialRecoveryState();
  }
}

export function recoveryFailureAction(failure: { code?: string; message?: string; retryAfter?: number } | undefined, fallback: string, now = Date.now()): RecoveryAction {
  if (failure?.code === AuthErrorCode.RECOVERY_OPTIONS_EXPIRED) return { type: RecoveryActionType.REIDENTIFY, error: "Escolha o contato novamente." };
  return { type: RecoveryActionType.FAILED, error: failure?.code === AuthErrorCode.CPF_REQUIRED ? "Informe seu CPF." : failure?.message || fallback,
    retryUntil: failure?.retryAfter ? now + failure.retryAfter * 1000 : undefined };
}
