import React from "react";
import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../shared/phone-contract.js";

// The tutor's mobile is required (it is how the municipality reaches them); the e-mail is optional, but must be valid when given. When the
// contacts are only for the notices of an animal without a tutor, neither is required by itself, and each must be valid when given.
export function registrationContactIssues(email: string, phone: string, active = true, phoneRequired = true) {
  if (!active) return { email: "", phone: "" };
  return {
    email: email && (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ? "Informe um e-mail válido." : "",
    phone: (phoneRequired || phone.trim()) && !isMobilePhone(phone) ? MOBILE_PHONE_MESSAGE : "",
  };
}

interface RegistrationContactFieldsProps {
  email: string;
  phone: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  showErrors?: boolean;
  // The contacts are only for the notices (an animal without a tutor): either one is enough.
  notices?: boolean;
}

export function RegistrationContactFields({ email, phone, onEmailChange, onPhoneChange, showErrors = false, notices = false }: RegistrationContactFieldsProps) {
  const issues = registrationContactIssues(email, phone, true, !notices);
  const purpose = notices ? "para os avisos" : "de cadastro";
  return <div className="form-sub-card">
    <span className="form-sub-card-title">{notices ? "Contato para os avisos" : "Contato de cadastro"}</span>
    <div className="two-column-fields">
      <div className={`access-field${showErrors && issues.email ? " is-invalid" : ""}`} data-label={notices ? "E-mail" : "E-mail (opcional)"}><input aria-label={`E-mail ${purpose}`} type="email" autoComplete="email" maxLength={254} placeholder="E-mail" value={email} onChange={(event) => onEmailChange(event.target.value)} aria-invalid={showErrors && Boolean(issues.email)} />{showErrors && issues.email && <small className="field-error-message">{issues.email}</small>}</div>
      <div className={`access-field${showErrors && issues.phone ? " is-invalid" : ""}`} data-label={notices ? "Celular" : "Celular *"}><input aria-label={`Celular ${purpose}`} type="tel" autoComplete="tel" maxLength={16} placeholder="Celular com DDD" value={phone} onChange={(event) => onPhoneChange(event.target.value)} aria-invalid={showErrors && Boolean(issues.phone)} required={!notices} />{showErrors && issues.phone && <small className="field-error-message">{issues.phone}</small>}</div>
    </div>
  </div>;
}
