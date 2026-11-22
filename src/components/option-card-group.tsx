import { useId } from "react";

export interface OptionCardChoice {
  value?: string;
  label: string;
  // A short note below the label, such as a weight range.
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
  stacked?: boolean;
}

const choiceStyle = "option-card-choice tw:[--option-card-accent:var(--ui-action)] tw:[--option-card-active-surface:var(--accent-green-soft)] tw:[--option-card-active-text:var(--ui-action-hover)] tw:[--option-card-radius:var(--radius-lg)]";

// A question in its own card: the question on top and one radio per answer. An option without a value
// stores its label, and a stored label still marks its option.
export function OptionCardGroup({ label, value, options, onChange, required = false, invalid = false, stacked = false }: OptionCardGroupProps) {
  const name = useId();
  return (
    <fieldset className={`option-card${invalid ? " is-invalid" : ""}`}>
      <legend>{label}{required && <span className="required-asterisk">*</span>}</legend>
      <div className={`option-card-tiles${stacked ? " option-card-tiles--stacked" : ""}`}>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : { ...option, value: option.value || option.label };
          return (
            <label className={choiceStyle} key={item.value}>
              <input type="radio" name={name} value={item.value} checked={Boolean(value) && (value === item.value || value === item.label)} onChange={() => onChange(item.value)} />
              <span>{item.label}</span>
              {item.subtitle && <small>{item.subtitle}</small>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
