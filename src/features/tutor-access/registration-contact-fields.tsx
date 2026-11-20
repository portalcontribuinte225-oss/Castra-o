import { useId } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { MOBILE_PHONE_MESSAGE, isMobilePhone } from "../../../shared/phone-contract.js";
import { Input } from "../../components/input";

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
  const issues = registrationContactIssues(email, phone, showErrors, !notices);
  const purpose = notices ? "para os avisos" : "de cadastro";
  return (
    <div className="form-sub-card">
      <span className="form-sub-card-title">{notices ? "Contato para os avisos" : "Contato de cadastro"}</span>
      <div className="two-column-fields">
        <ContactField
          notices={notices}
          label={notices ? "E-mail" : "E-mail (opcional)"}
          error={issues.email}
          aria-label={`E-mail ${purpose}`}
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="E-mail"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
        />
        <ContactField
          notices={notices}
          label={notices ? "Celular" : "Celular *"}
          error={issues.phone}
          aria-label={`Celular ${purpose}`}
          type="tel"
          autoComplete="tel"
          maxLength={16}
          placeholder="Celular com DDD"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          required={!notices}
        />
      </div>
    </div>
  );
}

type ContactFieldProps = ComponentPropsWithoutRef<"input"> & { label: string; error: string; notices: boolean };

function ContactField({ label, error, notices, ...props }: ContactFieldProps) {
  const errorId = useId();
  if (notices) {
    return (
      <label className="tw:grid tw:min-w-0 tw:content-start tw:gap-1">
        <span className="tw:text-[0.8125rem] tw:font-medium tw:text-ui-text">{label}</span>
        <Input {...props} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
        {error && <small id={errorId} className="tw:text-xs tw:text-ui-danger">{error}</small>}
      </label>
    );
  }

  return (
    <div className={`access-field${error ? " is-invalid" : ""}`} data-label={label}>
      <input {...props} aria-invalid={Boolean(error)} />
      {error && <small className="field-error-message">{error}</small>}
    </div>
  );
}
