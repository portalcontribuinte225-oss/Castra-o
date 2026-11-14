import { useReducer } from "react";
import { api, ApiError } from "../../api";
import { validateNewPassword } from "../../../shared/auth-contract.js";
import { DeliveryStatus } from "../../../shared/notification-contract.js";
import { initialRecoveryState, RecoveryActionType, recoveryFailureAction, recoveryReducer } from "./recovery-state";
import { useAuthChallengeClock } from "./use-auth-challenge-clock";
import { useAuthOperation } from "./use-auth-operation";
import type { AuthChallenge, RecoveryContext } from "./auth-types";

export function usePasswordRecovery(context: RecoveryContext, onRecovered: () => void, initialIdentifier = "") {
  const [state, dispatch] = useReducer(recoveryReducer, initialIdentifier, initialRecoveryState);
  const operation = useAuthOperation(`${context.audience}:${context.municipalityId}`);
  const clock = useAuthChallengeClock(state.challenge, state.retryUntil);
  function fail(failure: unknown, fallback: string) {
    dispatch(recoveryFailureAction(failure instanceof ApiError ? failure : undefined, fallback));
  }
  async function discover() {
    if (state.loading || clock.retryIn > 0 || !state.identifier.trim()) return;
    const request = operation.begin();
    dispatch({ type: RecoveryActionType.START });
    try {
      const result = await api.getRecoveryOptions({ ...context, identifier: state.identifier.trim() }, request);
      if (request.isCurrent()) dispatch({ type: RecoveryActionType.DISCOVERED, result });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível buscar os contatos."); }
  }
  async function send(optionId: string) {
    if (state.loading || clock.retryIn > 0 || !state.recoveryToken || !state.options.some((option) => option.id === optionId)) return;
    const request = operation.begin();
    dispatch({ type: RecoveryActionType.START });
    try {
      const challenge: AuthChallenge = await api.forgotPassword({ ...context, recoveryToken: state.recoveryToken, optionId }, request);
      if (request.isCurrent()) dispatch({ type: RecoveryActionType.SENT, challenge, optionId, error: challenge.delivery?.some((delivery) => delivery.status === DeliveryStatus.SENT) ? "" : "Não foi possível enviar o código. Tente reenviar." });
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível enviar o código."); }
  }
  async function reset() {
    if (state.loading || !state.challenge || clock.expiresIn === 0 || state.code.length !== 6) return;
    const issue = validateNewPassword(state.password);
    if (issue || state.password !== state.confirm) { dispatch({ type: RecoveryActionType.FAILED, error: issue || "As senhas não conferem." }); return; }
    const request = operation.begin();
    dispatch({ type: RecoveryActionType.START });
    try {
      await api.resetPassword({ ...context, challengeId: state.challenge.challengeId, code: state.code, password: state.password }, request);
      if (!request.isCurrent()) return;
      dispatch({ type: RecoveryActionType.CLEAR });
      onRecovered();
    } catch (failure) { if (request.isCurrent()) fail(failure, "Não foi possível salvar a senha."); }
  }
  function restart() { operation.cancel(); dispatch({ type: RecoveryActionType.RESTART }); }
  function cancel() { operation.cancel(); dispatch({ type: RecoveryActionType.CLEAR }); }
  return { ...state, clock, discover, send, reset, restart, cancel, edit: (fields: Partial<Pick<typeof state, "identifier" | "code" | "password" | "confirm">>) => dispatch({ type: RecoveryActionType.EDIT, fields }) };
}
