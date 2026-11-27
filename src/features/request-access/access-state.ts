import type { AuthChallenge } from "../tutor-access/auth-types";
import type { AccessChannel, AccessView } from "./access-types";

export enum AccessStep { IDENTIFY = "identify", CODE = "code", VERIFIED = "verified" }
export enum AccessActionType {
  EDIT = "edit", START = "start", SENT = "sent", OPENED = "opened", FAILED = "failed", EXPIRED = "expired", ACCOUNT_FOUND = "account-found", CORRECT = "correct",
}

export const ACCESS_EXPIRED_MESSAGE = "Acesso expirado. Solicite um novo código.";
const UNAUTHORIZED = 401;
const CONFLICT = 409;

export interface AccessState {
  step: AccessStep;
  cpf: string;
  // The channel the person chose; empty until they choose, while the first channel offered stands for it.
  channel: AccessChannel | "";
  challenge: AuthChallenge | null;
  code: string;
  token: string;
  view: AccessView | null;
  loading: boolean;
  error: string;
  retryUntil: number;
}

export type AccessFields = Partial<Pick<AccessState, "cpf" | "channel" | "code">>;

// The last screen of a request fills the CPF; the code is always asked.
export function initialAccessState(prefill: { cpf?: string } = {}): AccessState {
  return { step: AccessStep.IDENTIFY, cpf: prefill.cpf || "", channel: "", challenge: null, code: "", token: "", view: null, loading: false, error: "", retryUntil: 0 };
}

export type AccessAction =
  | { type: AccessActionType.EDIT; fields: AccessFields }
  | { type: AccessActionType.START }
  | { type: AccessActionType.SENT; challenge: AuthChallenge }
  | { type: AccessActionType.OPENED; token: string; view: AccessView }
  | { type: AccessActionType.FAILED; error: string; retryUntil?: number }
  | { type: AccessActionType.ACCOUNT_FOUND; error: string }
  | { type: AccessActionType.EXPIRED | AccessActionType.CORRECT };

export function accessReducer(state: AccessState, action: AccessAction): AccessState {
  switch (action.type) {
    case AccessActionType.EDIT: return { ...state, ...action.fields, error: "" };
    case AccessActionType.START: return { ...state, loading: true, error: "" };
    case AccessActionType.SENT: return { ...state, step: AccessStep.CODE, challenge: action.challenge, code: "", loading: false, error: "", retryUntil: 0 };
    case AccessActionType.OPENED: return { ...state, step: AccessStep.VERIFIED, token: action.token, view: action.view, code: "", loading: false, error: "" };
    case AccessActionType.FAILED: return { ...state, loading: false, error: action.error, retryUntil: action.retryUntil || state.retryUntil };
    // The CPF got an account meanwhile: the page offers to sign in instead of creating it again.
    case AccessActionType.ACCOUNT_FOUND:
      return { ...state, loading: false, error: action.error, view: state.view ? { ...state.view, account: { exists: true } } : state.view };
    case AccessActionType.EXPIRED: return { ...initialAccessState({ cpf: state.cpf }), channel: state.channel, error: ACCESS_EXPIRED_MESSAGE };
    case AccessActionType.CORRECT: return { ...state, step: AccessStep.IDENTIFY, challenge: null, code: "", error: "" };
  }
}

// A 401 means the short access ended; a 409 that the CPF already has an account; any other failure keeps the person where they are.
export function accessFailureAction(failure: { status?: number; message?: string; retryAfter?: number } | undefined, fallback: string, now = Date.now()): AccessAction {
  if (failure?.status === UNAUTHORIZED) return { type: AccessActionType.EXPIRED };
  if (failure?.status === CONFLICT) return { type: AccessActionType.ACCOUNT_FOUND, error: failure.message || fallback };
  return { type: AccessActionType.FAILED, error: failure?.message || fallback, retryUntil: failure?.retryAfter ? now + failure.retryAfter * 1000 : undefined };
}
