import { useState } from "react";
import type { ReactNode } from "react";
import { Card } from "./card";

interface ChoiceOption {
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
}

interface ChoiceQuestionProps {
  question: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  children?: ReactNode;
}

const choiceStyle = [
  "tw:grid tw:content-center tw:gap-1.5 tw:border-[1.5px] tw:px-5 tw:py-4.5 tw:text-left tw:motion-safe:transition-colors tw:disabled:cursor-default",
  "tw:enabled:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent",
  "tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft",
  "tw:data-[invalid=true]:border-ui-danger/50 tw:data-[invalid=true]:bg-ui-danger-soft tw:data-[invalid=true]:enabled:hover:border-ui-danger tw:data-[invalid=true]:focus-visible:outline-ui-danger",
  "tw:[@media(min-height:600px)]:@min-[720px]/request-form:py-[clamp(20px,4dvh,48px)]",
].join(" ");

export function ChoiceQuestion({ question, options, value, onChange, invalid = false, children }: ChoiceQuestionProps) {
  const [changing, setChanging] = useState(false);
  const answer = options.find((option) => option.value === value);
  if (answer && !changing) {
    return (
      <Card className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-4.5 tw:py-3.5">
        <span className="tw:min-w-0 tw:text-sm tw:text-ui-text tw:[&>strong]:font-semibold">
          {question} <strong>{answer.label}</strong>
        </span>
        <button
          type="button"
          className="tw:shrink-0 tw:rounded-sm tw:border-0 tw:bg-transparent tw:p-1 tw:text-sm tw:text-ui-accent-strong tw:underline tw:underline-offset-2 tw:hover:no-underline tw:focus-visible:outline-2 tw:focus-visible:outline-ui-accent"
          onClick={() => setChanging(true)}
        >Alterar</button>
      </Card>
    );
  }

  return (
    <div className="tw:grid tw:gap-3" role="group" aria-label={question} aria-invalid={invalid || undefined}>
      <p className={`tw:m-0 tw:text-base tw:font-semibold ${invalid ? "tw:text-ui-danger" : "tw:text-ui-ink"}`}>{question}</p>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] tw:gap-3">
        {options.map((option) => (
          <Card
            as="button"
            key={option.value}
            aria-pressed={option.value === value}
            disabled={option.disabled}
            data-invalid={invalid || undefined}
            className={choiceStyle}
            onClick={() => { setChanging(false); onChange(option.value); }}
          >
            <strong className="tw:text-[0.9375rem] tw:font-semibold tw:text-ui-ink">{option.label}</strong>
            <span className="tw:text-sm/relaxed tw:text-ui-text">{option.description}</span>
          </Card>
        ))}
      </div>
      {children}
    </div>
  );
}
