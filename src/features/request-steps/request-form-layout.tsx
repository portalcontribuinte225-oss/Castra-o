import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../../components/button";
import { requestSteps } from "./request-steps";
import type { RequestStep } from "./request-steps";
import { RequestStepper } from "./request-stepper";

interface RequestFormLayoutProps {
  stepIndex: number;
  stepInvalid: boolean;
  internal: boolean;
  exit?: { label: string; onClick: () => void };
  onNavigate: (step: RequestStep) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitDisabled: boolean;
  error: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function RequestFormLayout({
  stepIndex, stepInvalid, internal, exit, onNavigate, onSubmit, submitting, submitDisabled, error, actions, children,
}: RequestFormLayoutProps) {
  const current = requestSteps[stepIndex];
  const previous = requestSteps[stepIndex - 1];
  const next = requestSteps[stepIndex + 1];
  const continueLabel = next ? "Próximo" : submitting ? "Enviando..." : internal ? "Encerrar" : "Enviar";
  const continueAction = next ? () => onNavigate(next.step) : onSubmit;
  const continueDisabled = !next && (submitting || submitDisabled);

  return (
    <div className={`nr-shell nr-shell--${internal ? "internal" : "public"}`}>
      <div className={`nr-topbar${internal ? " nr-topbar--internal" : ""} tw:@container/request-steps`}>
        <RequestStepper stepIndex={stepIndex} stepInvalid={stepInvalid} />
        {exit && <Button variant="outline" className="tw:justify-self-end" onClick={exit.onClick}>{exit.label}</Button>}
      </div>
      <div className="nr-body" key={current.step} role="region" aria-label={current.label} tabIndex={0}>
        <div className="single-request-form clean-form">{children}</div>
      </div>
      {error && <p className="tw:mx-2.5 tw:my-0 tw:rounded-[var(--ui-radius-md)] tw:bg-ui-danger-soft tw:px-3 tw:py-2 tw:text-sm tw:text-ui-danger" role="alert">{error}</p>}
      <div aria-label="Navegação da solicitação" role="group" className="tw:flex tw:shrink-0 tw:flex-wrap tw:items-stretch tw:gap-2 tw:px-2.5 tw:py-1.5">
        {previous && <Button variant="outline" onClick={() => onNavigate(previous.step)}>Voltar</Button>}
        {actions}
        <Button className="tw:ml-auto tw:min-w-[104px]" disabled={continueDisabled} onClick={continueAction}>
          {continueLabel}<ChevronRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
