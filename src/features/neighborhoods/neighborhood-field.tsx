import { findNeighborhoodName, neighborhoodChoices } from "./neighborhoods";
import { RequestSelectField } from "../request-steps/request-select-field";
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
    return <RequestTextField label={fieldLabel} type="text" aria-label={label} aria-invalid={invalid} required={required} placeholder={placeholder} maxLength={120} value={value || ""} onChange={(event) => onChange(event.target.value)} />;
  }
  const selected = findNeighborhoodName(names, value) || value || "";
  return (
    <RequestSelectField label={fieldLabel} aria-label={label} aria-invalid={invalid} required={required} value={selected} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione o bairro</option>
      {neighborhoodChoices(names, selected).map((name) => <option key={name} value={name}>{name}</option>)}
    </RequestSelectField>
  );
}
