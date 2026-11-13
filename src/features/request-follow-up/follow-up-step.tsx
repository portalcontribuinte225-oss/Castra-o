import React from "react";
import { formatPhone } from "../../utils";
import { getFollowUpIssues } from "./follow-up";
import type { FollowUpValue } from "./follow-up";

interface FollowUpStepProps {
  value: FollowUpValue;
  onChange: (value: FollowUpValue) => void;
  phoneEnabled: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  showErrors: boolean;
}

export function FollowUpStep({ value, onChange, phoneEnabled, loading, error, onRetry, showErrors }: FollowUpStepProps) {
  const issues = showErrors ? getFollowUpIssues(value, phoneEnabled) : [];
  return (
    <div className="follow-up-card">
      <h3>Quer acompanhar sua solicitação?</h3>
      <p>Receba avisos sobre o agendamento, os documentos e a conclusão do atendimento.</p>
      {loading && <p role="status">Carregando canais de acompanhamento...</p>}
      {error && <div role="alert"><p className="form-error">{error}</p><button type="button" className="ghost-button" onClick={onRetry}>Tentar novamente</button></div>}
      <fieldset className="follow-up-choice" disabled={loading || Boolean(error)}>
        <legend>Deseja receber atualizações?</legend>
        {[true, false].map((enabled) => (
          <label key={String(enabled)} className="checkbox-row">
            <input type="radio" name="follow-up" checked={value.enabled === enabled} onChange={() => onChange(enabled ? { ...value, enabled } : { enabled, email: "", phone: "" })} />
            {enabled ? "Sim" : "Não"}
          </label>
        ))}
      </fieldset>
      {value.enabled === true && !loading && !error && <div className="follow-up-fields">
        <label className="field">
          <span>E-mail <span className="required-asterisk">*</span></span>
          <input type="email" autoComplete="email" required maxLength={254} value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} aria-invalid={showErrors && issues.some((issue) => issue.includes("e-mail"))} />
        </label>
        {phoneEnabled && <label className="field">
          <span>Telefone (opcional)</span>
          <input type="tel" autoComplete="tel" maxLength={16} placeholder="(00) 00000-0000" value={value.phone} onChange={(event) => onChange({ ...value, phone: formatPhone(event.target.value) })} aria-invalid={showErrors && issues.some((issue) => issue.includes("telefone"))} />
        </label>}
        <p className="muted">A prefeitura usa os canais disponíveis para enviar os avisos.</p>
      </div>}
      {value.enabled === false && <p className="follow-up-notice">Sem um contato para acompanhamento, você não receberá avisos, inclusive sobre mudanças na data do atendimento. Guarde seu protocolo.</p>}
      {issues.length > 0 && <ul className="form-error" role="alert">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    </div>
  );
}
