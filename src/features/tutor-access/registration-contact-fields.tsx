import React from "react";
import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../shared/phone-contract.js";

// The tutor's mobile is required (it is how the municipality reaches them); the e-mail is optional, but must be valid when given.
export function registrationContactIssues(email: string, phone: string, active = true) {
  if (!active) return { email: "", phone: "" };
  return {
    email: email && (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ? "Informe um e-mail válido." : "",
    phone: isMobilePhone(phone) ? "" : MOBILE_PHONE_MESSAGE,
  };
}

export function RegistrationContactFields({ email, phone, onEmailChange, onPhoneChange, showErrors = false }: { email: string; phone: string; onEmailChange: (value: string) => void; onPhoneChange: (value: string) => void; showErrors?: boolean }) {
  const issues = registrationContactIssues(email, phone);
  return <div className="form-sub-card">
    <span className="form-sub-card-title">Contato de cadastro</span>
    <div className="two-column-fields">
      <div className={`access-field${showErrors && issues.email ? " is-invalid" : ""}`} data-label="E-mail (opcional)"><input aria-label="E-mail de cadastro" type="email" autoComplete="email" maxLength={254} placeholder="E-mail" value={email} onChange={(event) => onEmailChange(event.target.value)} aria-invalid={showErrors && Boolean(issues.email)} />{showErrors && issues.email && <small className="field-error-message">{issues.email}</small>}</div>
      <div className={`access-field${showErrors && issues.phone ? " is-invalid" : ""}`} data-label="Celular *"><input aria-label="Celular de cadastro" type="tel" autoComplete="tel" maxLength={16} placeholder="Celular com DDD" value={phone} onChange={(event) => onPhoneChange(event.target.value)} aria-invalid={showErrors && Boolean(issues.phone)} required />{showErrors && issues.phone && <small className="field-error-message">{issues.phone}</small>}</div>
    </div>
  </div>;
}
