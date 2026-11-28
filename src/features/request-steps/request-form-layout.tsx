import { useEffect } from "react";
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

const navigationStyle = "tw:flex tw:shrink-0 tw:flex-wrap tw:items-stretch tw:gap-2 tw:px-2.5 tw:py-1.5";
// On a phone (also lying down) the public form scrolls as a page, so its navigation stays at the bottom of the screen.
const phoneStickyNavigation = [
  "tw:[@media(max-width:820px),(max-height:480px)]:sticky tw:[@media(max-width:820px),(max-height:480px)]:bottom-0",
  "tw:[@media(max-width:820px),(max-height:480px)]:z-30 tw:[@media(max-width:820px),(max-height:480px)]:bg-[var(--ui-page)]",
  "tw:[@media(max-width:820px),(max-height:480px)]:pb-[max(0.375rem,env(safe-area-inset-bottom))]",
].join(" ");
// In a narrow public form the extra actions (another animal, the same data again) take a line of their own above Voltar and Próximo.
const actionsStyle = "tw:flex tw:min-w-0 tw:flex-1 tw:gap-2 tw:@max-[520px]/request-form:order-first tw:@max-[520px]/request-form:basis-full";

export function RequestFormLayout({
  stepIndex, stepInvalid, internal, exit, onNavigate, onSubmit, submitting, submitDisabled, error, actions, children,
}: RequestFormLayoutProps) {
  const current = requestSteps[stepIndex];
  const previous = requestSteps[stepIndex - 1];
  const next = requestSteps[stepIndex + 1];
  const continueLabel = next ? "Próximo" : submitting ? "Enviando..." : internal ? "Encerrar" : "Enviar";
  const continueAction = next ? () => onNavigate(next.step) : onSubmit;
  const continueDisabled = !next && (submitting || submitDisabled);

  // A public form that scrolls as a page starts each step at the top.
  useEffect(() => {
    if (!internal && window.scrollY > 0) window.scrollTo({ top: 0 });
  }, [internal, current.step]);

  return (
    <div className={`nr-shell nr-shell--${internal ? "internal" : "public"}`}>
      <div className={`nr-topbar${internal ? " nr-topbar--internal" : ""} tw:@container/request-steps`}>
        <RequestStepper stepIndex={stepIndex} stepInvalid={stepInvalid} />
        {exit && <Button variant="outline" className="tw:shrink-0 tw:justify-self-end" onClick={exit.onClick}>{exit.label}</Button>}
      </div>
      <div className="nr-body" key={current.step} role="region" aria-label={current.label} tabIndex={0}>
        <div className="single-request-form clean-form">{children}</div>
      </div>
      {error && <p className="form-error-msg" role="alert">{error}</p>}
      <div aria-label="Navegação da solicitação" role="group" className={internal ? navigationStyle : `${navigationStyle} ${phoneStickyNavigation}`}>
        {previous && <Button variant="outline" onClick={() => onNavigate(previous.step)}>Voltar</Button>}
        {actions && <div className={actionsStyle}>{actions}</div>}
        <Button className="tw:ml-auto tw:min-w-[104px]" disabled={continueDisabled} onClick={continueAction}>
          {continueLabel}<ChevronRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
