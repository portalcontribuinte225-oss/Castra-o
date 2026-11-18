import React, { useId } from "react";

export interface OptionCardChoice {
  value?: string;
  label: string;
  // A short note beside the label, such as the weight of a size.
  subtitle?: string;
}

interface OptionCardGroupProps {
  label: string;
  // "" while the question has no answer: nothing is chosen for the person.
  value: string;
  options: Array<string | OptionCardChoice>;
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
}

// A question in its own card: the question on top and one radio per answer, one under the other. An option without a value
// stores its label, and a stored label still marks its option.
export function OptionCardGroup({ label, value, options, onChange, required = false, invalid = false }: OptionCardGroupProps) {
  const name = useId();
  return (
    <fieldset className={`option-card${invalid ? " is-invalid" : ""}`}>
      <legend>{label}{required && <span className="required-asterisk">*</span>}</legend>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : { ...option, value: option.value || option.label };
        return (
          <label className="option-card-choice" key={item.value}>
            <input type="radio" name={name} value={item.value} checked={Boolean(value) && (value === item.value || value === item.label)} onChange={() => onChange(item.value)} />
            <span>{item.label}</span>
            {item.subtitle && <small>{item.subtitle}</small>}
          </label>
        );
      })}
    </fieldset>
  );
}
