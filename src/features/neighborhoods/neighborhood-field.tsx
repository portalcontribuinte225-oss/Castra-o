import { neighborhoodChoices } from "./neighborhoods";
import { RequestTextField } from "../request-steps/request-text-field";

interface NeighborhoodFieldProps {
  label?: string;
  value: string;
  // The neighborhoods the municipality registered; with none, the field is free text.
  names: string[];
  onChange: (value: string) => void;
  invalid?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function NeighborhoodField({ label = "Bairro", value, names, onChange, invalid = false, required = false, placeholder = "Bairro" }: NeighborhoodFieldProps) {
  const fieldLabel = required ? `${label} *` : label;
  if (!names.length) {
    return <RequestTextField label={fieldLabel} type="text" aria-label={label} aria-invalid={invalid} placeholder={placeholder} maxLength={120} value={value || ""} onChange={(event) => onChange(event.target.value)} />;
  }
  return (
    <div className={`access-field${invalid ? " is-invalid" : ""}`} data-label={fieldLabel}>
      <select aria-label={label} aria-invalid={invalid} value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione o bairro</option>
        {neighborhoodChoices(names, value).map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
  );
}
