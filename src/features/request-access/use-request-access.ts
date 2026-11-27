import { useReducer } from "react";
import { api, ApiError } from "../../api";
import { ACCESS_CODE_PATTERN } from "../../../shared/request-access-contract.js";
import type { SessionUser } from "../tutor-access/auth-types";
import { useAuthChallengeClock } from "../tutor-access/use-auth-challenge-clock";
import { useAuthOperation } from "../tutor-access/use-auth-operation";
import { AccessActionType, accessFailureAction, accessReducer, initialAccessState } from "./access-state";
import type { AccessFields } from "./access-state";
import type { AccessChannel } from "./access-types";
import { useAccessChannels } from "./use-access-channels";

export function useRequestAccess(municipalityId: string, prefill: { cpf?: string } = {}) {
  const [state, dispatch] = useReducer(accessReducer, prefill, initialAccessState);
  const operation = useAuthOperation(municipalityId);
  const clock = useAuthChallengeClock(state.challenge, state.retryUntil);
  const availableChannels = useAccessChannels(municipalityId);
  // The chosen channel while the municipality offers it; otherwise the first one it offers.
  const channel: AccessChannel | "" = state.channel && availableChannels.channels.includes(state.channel)
    ? state.channel : availableChannels.channels[0] || "";
  const fail = (failure: unknown, fallback: string) => dispatch(accessFailureAction(failure instanceof ApiError ? failure : undefined, fallback));

  async function send() {
    if (state.loading || clock.retryIn > 0 || !municipalityId || !channel || !state.cpf.trim()) return;
    const request = operation.begin();
    dispatch({ type: AccessActionType.START });
    try {
      const challenge = await api.requestAccess.start({ municipalityId, cpf: state.cpf, channel }, request);
      if (request.isCurrent()) dispatch({ type: AccessActionType.SENT, challenge });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível enviar o código."); }
  }

  async function open() {
    if (state.loading || !state.challenge || clock.expiresIn === 0 || !ACCESS_CODE_PATTERN.test(state.code)) return;
    const request = operation.begin();
    dispatch({ type: AccessActionType.START });
    try {
      const session = await api.requestAccess.confirm(state.challenge.challengeId, { code: state.code, cpf: state.cpf }, request);
      const view = await api.requestAccess.view(session.token, request);
      if (request.isCurrent()) dispatch({ type: AccessActionType.OPENED, token: session.token, view });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível abrir as solicitações."); }
  }

  // Answers the signed-in tutor once the account exists, or null when it could not be created.
  async function createPassword(password: string): Promise<SessionUser | null> {
    if (state.loading || !state.token) return null;
    const request = operation.begin();
    dispatch({ type: AccessActionType.START });
    try {
      const user = await api.requestAccess.createPassword(state.token, password, request);
      return request.isCurrent() ? user : null;
    } catch (failure) {
      if (request.isCurrent()) fail(failure, "Não foi possível criar a senha.");
      return null;
    }
  }

  return {
    ...state, channel, availableChannels, clock, send, open, createPassword,
    edit: (fields: AccessFields) => dispatch({ type: AccessActionType.EDIT, fields }),
    correct: () => { operation.cancel(); dispatch({ type: AccessActionType.CORRECT }); },
  };
}
