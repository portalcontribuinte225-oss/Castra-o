import React from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { RecoveryStep } from "./recovery-state";
import { usePasswordRecovery } from "./use-password-recovery";
import type { RecoveryContext } from "./auth-types";

type RecoveryFormState = ReturnType<typeof usePasswordRecovery>;
const channelLabels = { [NotificationChannel.EMAIL]: "e-mail", [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.SMS]: "SMS" };

export function PasswordRecoveryFields({ state, audience, onBack }: { state: RecoveryFormState; audience: RecoveryContext["audience"]; onBack: () => void }) {
  const reset = state.step === RecoveryStep.RESET;
  return <form className="tutor-auth-form" onSubmit={(event) => { event.preventDefault(); if (state.step === RecoveryStep.IDENTIFY) void state.discover(); else if (reset) void state.reset(); }}>
    <h2>{reset ? "Redefinir senha" : state.step === RecoveryStep.OPTIONS ? "Escolha o contato" : "Recuperar acesso"}</h2>
    {state.step === RecoveryStep.IDENTIFY && <><label className="field"><span>{audience === AuthAudience.TUTOR ? "CPF ou e-mail" : "E-mail da equipe"}</span><input autoComplete="username" type={audience === AuthAudience.TUTOR ? "text" : "email"} required maxLength={254} value={state.identifier} onChange={(event) => state.edit({ identifier: event.target.value })} disabled={state.loading} /></label><button type="submit" className="primary-action" disabled={state.loading || state.clock.retryIn > 0 || !state.identifier.trim()}>{state.loading ? "Buscando..." : "Continuar"}</button></>}
    {state.step === RecoveryStep.OPTIONS && <>{state.options.length ? state.options.map((option) => <button className="ghost-button" type="button" key={option.id} disabled={state.loading || state.clock.retryIn > 0} onClick={() => void state.send(option.id)}>Receber código por {channelLabels[option.channel]}: {option.maskedDestination}</button>) : <p role="status">Nenhum contato disponível. Procure o atendimento.</p>}<button type="button" className="ghost-button" onClick={state.restart} disabled={state.loading}>Voltar</button></>}
    {reset && <>
      <label className="field"><span>Código recebido</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={state.code} onChange={(event) => state.edit({ code: event.target.value.replace(/\D/g, "") })} disabled={state.loading || state.clock.expiresIn === 0} /></label>
      <label className="field"><span>Nova senha</span><input type="password" autoComplete="new-password" required value={state.password} onChange={(event) => state.edit({ password: event.target.value })} disabled={state.loading} /></label>
      <label className="field"><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" required value={state.confirm} onChange={(event) => state.edit({ confirm: event.target.value })} disabled={state.loading} /></label>
      {state.clock.expiresIn === 0 && <p role="status">Código expirado. Reenvie.</p>}
      <button type="submit" className="primary-action" disabled={state.loading || state.clock.expiresIn === 0 || state.code.length !== 6 || !state.password || !state.confirm}>{state.loading ? "Aguarde..." : "Salvar nova senha"}</button>
      <button type="button" className="ghost-button" disabled={state.loading || state.clock.retryIn > 0} onClick={() => void state.send(state.selectedOptionId)}>Reenviar código</button>
    </>}
    {state.loading && state.step === RecoveryStep.OPTIONS && <p role="status">Enviando código...</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button type="button" className="ghost-button" onClick={() => { state.cancel(); onBack(); }} disabled={state.loading}>Voltar ao login</button>
  </form>;
}

export function PasswordRecoveryForm({ audience, municipalityId, initialIdentifier = "", onBack, onRecovered }: RecoveryContext & { initialIdentifier?: string; onBack: () => void; onRecovered: () => void }) {
  const state = usePasswordRecovery({ audience, municipalityId }, onRecovered, initialIdentifier);
  return <PasswordRecoveryFields state={state} audience={audience} onBack={onBack} />;
}
