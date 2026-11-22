import { useEffect, useRef } from "react";
import { AuthAudience } from "../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { Button } from "../../components/button";
import { CloseButton } from "../../components/close-button";
import { Input } from "../../components/input";
import { authErrorStyle, authFieldStyle, authFormStyle, authHeadingStyle, authLabelStyle, authTitleStyle } from "./auth-form-styles";
import { RecoveryStep } from "./recovery-state";
import { usePasswordRecovery } from "./use-password-recovery";
import type { RecoveryContext } from "./auth-types";

type RecoveryFormState = ReturnType<typeof usePasswordRecovery>;
const channelLabels = { [NotificationChannel.EMAIL]: "e-mail", [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.SMS]: "SMS" };

export function PasswordRecoveryFields({ state, audience, onBack, onClose }: { state: RecoveryFormState; audience: RecoveryContext["audience"]; onBack: () => void; onClose?: () => void }) {
  const reset = state.step === RecoveryStep.RESET;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [state.step]);
  return <form className={authFormStyle} onSubmit={(event) => { event.preventDefault(); if (state.step === RecoveryStep.IDENTIFY) void state.discover(); else if (reset) void state.reset(); }}>
    <div className={authHeadingStyle}>
      <h2 className={authTitleStyle} tabIndex={-1} ref={heading}>{reset ? "Redefinir senha" : state.step === RecoveryStep.OPTIONS ? "Escolha o contato" : "Recuperar acesso"}</h2>
      {onClose && <CloseButton aria-label="Fechar acesso" onClick={onClose} />}
    </div>
    {state.step === RecoveryStep.IDENTIFY && <>
      <label className={authFieldStyle}>
        <span className={authLabelStyle}>{audience === AuthAudience.TUTOR ? "CPF ou e-mail" : "E-mail da equipe"}</span>
        <Input autoComplete="username" type={audience === AuthAudience.TUTOR ? "text" : "email"} required maxLength={254} value={state.identifier} onChange={(event) => state.edit({ identifier: event.target.value })} disabled={state.loading} />
      </label>
      <Button type="submit" disabled={state.loading || state.clock.retryIn > 0 || !state.identifier.trim()}>{state.loading ? "Buscando..." : "Continuar"}</Button>
    </>}
    {state.step === RecoveryStep.OPTIONS && <>
      {state.options.length ? state.options.map((option) => (
        <Button variant="outline" key={option.id} disabled={state.loading || state.clock.retryIn > 0} onClick={() => void state.send(option.id)}>
          <span className="tw:whitespace-normal tw:break-all">Receber código por {channelLabels[option.channel]}: {option.maskedDestination}</span>
        </Button>
      )) : <p role="status">Nenhum contato disponível. Procure o atendimento.</p>}
      <Button variant="outline" onClick={state.restart} disabled={state.loading}>Voltar</Button>
    </>}
    {reset && <>
      <label className={authFieldStyle}>
        <span className={authLabelStyle}>Código recebido</span>
        <Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={state.code} onChange={(event) => state.edit({ code: event.target.value.replace(/\D/g, "") })} disabled={state.loading || state.clock.expiresIn === 0} />
      </label>
      <label className={authFieldStyle}>
        <span className={authLabelStyle}>Nova senha</span>
        <Input type="password" autoComplete="new-password" required value={state.password} onChange={(event) => state.edit({ password: event.target.value })} disabled={state.loading} />
      </label>
      <label className={authFieldStyle}>
        <span className={authLabelStyle}>Confirmar nova senha</span>
        <Input type="password" autoComplete="new-password" required value={state.confirm} onChange={(event) => state.edit({ confirm: event.target.value })} disabled={state.loading} />
      </label>
      {state.clock.expiresIn === 0 && <p role="status">Código expirado. Reenvie.</p>}
      <Button type="submit" disabled={state.loading || state.clock.expiresIn === 0 || state.code.length !== 6 || !state.password || !state.confirm}>{state.loading ? "Aguarde..." : "Salvar nova senha"}</Button>
      <Button variant="outline" disabled={state.loading || state.clock.retryIn > 0} onClick={() => void state.send(state.selectedOptionId)}>Reenviar código</Button>
    </>}
    {state.loading && state.step === RecoveryStep.OPTIONS && <p role="status">Enviando código...</p>}
    {state.error && <p className={authErrorStyle} role="alert">{state.error}</p>}
    <Button variant="outline" onClick={() => { state.cancel(); onBack(); }} disabled={state.loading}>Voltar ao login</Button>
  </form>;
}

export function PasswordRecoveryForm({ audience, municipalityId, initialIdentifier = "", onBack, onRecovered, onClose }: RecoveryContext & { initialIdentifier?: string; onBack: () => void; onRecovered: () => void; onClose: () => void }) {
  const state = usePasswordRecovery({ audience, municipalityId }, onRecovered, initialIdentifier);
  return <PasswordRecoveryFields state={state} audience={audience} onBack={onBack} onClose={onClose} />;
}
