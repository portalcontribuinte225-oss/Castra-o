import React from "react";
import { availableFollowUpContacts, getFollowUpIssues, maskFollowUpEmail, maskFollowUpPhone } from "./follow-up";
import type { FollowUpValue, TutorContacts } from "./follow-up";

interface FollowUpStepProps {
  value: FollowUpValue;
  onChange: (value: FollowUpValue) => void;
  // The contacts of the Tutor step (or of the profile): the notices go to the ones chosen here, with nothing to type again.
  contacts: TutorContacts;
  phoneEnabled: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  showErrors: boolean;
  // Back to where the contacts are typed; absent when the form has no such step.
  onEditContacts?: () => void;
}

const NO_CHANNEL_TEXT = "Este município ainda não envia avisos por celular e nenhum e-mail foi informado. Informe um e-mail para receber os avisos.";
const NO_CONTACT_TEXT = "Não há contato disponível para receber avisos. Informe um e-mail ou um celular válido.";

export function FollowUpStep({ value, onChange, contacts, phoneEnabled, loading, error, onRetry, showErrors, onEditContacts }: FollowUpStepProps) {
  const issues = showErrors ? getFollowUpIssues(value, contacts, phoneEnabled) : [];
  const available = availableFollowUpContacts(contacts, phoneEnabled);
  const canAccept = Boolean(available.email || available.phone);
  const ready = !loading && !error;
  return (
    <div className="follow-up-card">
      <h3>Quer acompanhar sua solicitação?</h3>
      <p>Receba avisos sobre o agendamento, os documentos e a conclusão do atendimento.</p>
      {loading && <p role="status">Carregando canais de acompanhamento...</p>}
      {error && <div role="alert"><p className="form-error">{error}</p><button type="button" className="ghost-button" onClick={onRetry}>Tentar novamente</button></div>}
      <fieldset className="follow-up-choice" disabled={!ready}>
        <legend>Deseja receber atualizações?</legend>
        {[true, false].map((enabled) => (
          <label key={String(enabled)} className="checkbox-row">
            <input type="radio" name="follow-up" checked={value.enabled === enabled} disabled={enabled && ready && !canAccept} onChange={() => onChange({ ...value, enabled })} />
            {enabled ? "Sim" : "Não"}
          </label>
        ))}
      </fieldset>
      {ready && !canAccept && (
        <div className="follow-up-notice" role="status">
          <p>{phoneEnabled ? NO_CONTACT_TEXT : NO_CHANNEL_TEXT}</p>
          {onEditContacts && <button type="button" className="anm-add-btn" onClick={onEditContacts}>{phoneEnabled ? "Alterar contatos" : "Informar e-mail"}</button>}
        </div>
      )}
      {value.enabled === true && ready && canAccept && (
        <div className="follow-up-fields" role="group" aria-label="Receber os avisos por">
          <p><strong>Receber os avisos por</strong></p>
          {available.email && (
            <label className="checkbox-row">
              <input type="checkbox" checked={value.useEmail} onChange={(event) => onChange({ ...value, useEmail: event.target.checked })} />
              E-mail <strong>{maskFollowUpEmail(available.email)}</strong>
            </label>
          )}
          {available.phone && (
            <label className="checkbox-row">
              <input type="checkbox" checked={value.usePhone} onChange={(event) => onChange({ ...value, usePhone: event.target.checked })} />
              Celular <strong>{maskFollowUpPhone(available.phone)}</strong>
            </label>
          )}
          {onEditContacts && <button type="button" className="anm-add-btn" onClick={onEditContacts}>Alterar contatos</button>}
          <p className="muted">A prefeitura usa os canais disponíveis para enviar os avisos.</p>
        </div>
      )}
      {value.enabled === false && <p className="follow-up-notice">Você optou por não receber avisos. Sem eles, não saberá de mudanças na data do atendimento. Guarde seu protocolo.</p>}
      {issues.length > 0 && <ul className="form-error" role="alert">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    </div>
  );
}
