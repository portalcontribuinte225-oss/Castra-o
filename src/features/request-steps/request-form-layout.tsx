import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
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

  return (
    <div className={`nr-shell nr-shell--${internal ? "internal" : "public"}`}>
      <div className={`nr-topbar${internal ? " nr-topbar--internal" : ""} tw:@container/request-steps`}>
        <RequestStepper stepIndex={stepIndex} stepInvalid={stepInvalid} />
        {exit && (
          <button className="nr-topbar-continue nr-topbar-home primary-action" type="button" onClick={exit.onClick}>{exit.label}</button>
        )}
      </div>
      <div className="nr-body" key={current.step} role="region" aria-label={current.label} tabIndex={0}>
        <div className="single-request-form clean-form">{children}</div>
      </div>
      {error && <p className="form-error nr-bottom-error" role="alert">{error}</p>}
      <div className="nr-nav-row">
        {previous && (
          <button className="nr-back-btn primary-action" type="button" onClick={() => onNavigate(previous.step)}>Voltar</button>
        )}
        {actions}
        <button
          className="nr-topbar-continue primary-action"
          type="button"
          disabled={!next && (submitting || submitDisabled)}
          onClick={next ? () => onNavigate(next.step) : onSubmit}
        >
          {continueLabel}
          {!internal && <ChevronRight size={15} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
