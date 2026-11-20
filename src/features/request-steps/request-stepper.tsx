import { CheckCircle2 } from "lucide-react";
import { requestSteps } from "./request-steps";

interface RequestStepperProps {
  stepIndex: number;
  stepInvalid: boolean;
}

const listStyle = [
  "tw:m-0 tw:mx-auto tw:grid tw:min-h-10 tw:w-full tw:min-w-0 tw:max-w-[900px] tw:flex-1 tw:list-none tw:grid-cols-4 tw:items-center tw:gap-1 tw:p-0",
  "tw:@min-[620px]/request-steps:flex tw:@min-[620px]/request-steps:justify-center tw:@min-[620px]/request-steps:gap-2",
].join(" ");
const itemStyle = "tw:flex tw:min-w-0 tw:items-center tw:justify-center tw:gap-2 tw:@min-[620px]/request-steps:grow tw:@min-[620px]/request-steps:last:grow-0";
const labelStyle = [
  "tw:flex tw:min-w-0 tw:flex-col tw:items-center tw:gap-0.5 tw:text-center tw:text-xs tw:leading-tight",
  "tw:@min-[620px]/request-steps:flex-row tw:@min-[620px]/request-steps:gap-2 tw:@min-[620px]/request-steps:text-[0.8125rem]",
].join(" ");
const connectorStyle = "tw:hidden tw:h-px tw:min-w-2 tw:max-w-[150px] tw:flex-1 tw:@min-[620px]/request-steps:block";

export function RequestStepper({ stepIndex, stepInvalid }: RequestStepperProps) {
  return (
    <ol className={listStyle} role="list" aria-label="Etapas da solicitação">
      {requestSteps.map(({ step, label }, index) => {
        const current = index === stepIndex;
        const completed = index < stepIndex;
        const invalid = current && stepInvalid;
        const active = current || completed;
        const labelTone = invalid ? "tw:text-ui-danger" : active ? "tw:text-ui-accent-strong" : "tw:text-ui-muted";
        const numberTone = invalid ? "tw:bg-ui-danger-soft tw:text-ui-danger"
          : active ? "tw:bg-ui-accent tw:text-white" : "tw:bg-slate-100 tw:text-ui-muted";

        return (
          <li key={step} className={itemStyle} aria-current={current ? "step" : undefined}>
            <span className={`${labelStyle} ${labelTone} ${current ? "tw:font-semibold" : "tw:font-medium"}`}>
              <span aria-hidden="true" className={`tw:grid tw:size-[22px] tw:shrink-0 tw:place-items-center tw:rounded-full ${numberTone}`}>
                {completed ? <CheckCircle2 size={13} strokeWidth={2.5} /> : index + 1}
              </span>
              {label}
              {completed && <span className="tw:sr-only">, concluída</span>}
              {invalid && <span className="tw:sr-only">, revise os dados</span>}
            </span>
            {index < requestSteps.length - 1 && (
              <span aria-hidden="true" className={`${connectorStyle} ${completed ? "tw:bg-ui-accent/30" : "tw:bg-card-border"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
