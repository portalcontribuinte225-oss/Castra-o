import { CheckCircle2 } from "lucide-react";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { FollowUpSummary } from "../request-follow-up/follow-up-summary";
import { useRequirementDownload } from "./use-requirement-download";

interface RequestDoneCardProps {
  protocol: string;
  followUp?: { enabled: boolean; email?: string; phone?: string };
  // Makes the request document (a PDF, as a data URL) when the person asks for it.
  createRequirement: () => Promise<string>;
  closeLabel: string;
  onClose: () => void;
  // Only where the tutor has no password yet (the public form with a tutor): opens "Acessar minha solicitação".
  onCreatePassword?: () => void;
  internal?: boolean;
}

// The last screen of a request, for the public page and for the staff's modal: the protocol, the notices and the request document.
export function RequestDoneCard({ protocol, followUp, createRequirement, closeLabel, onClose, onCreatePassword, internal = false }: RequestDoneCardProps) {
  const requirement = useRequirementDownload(createRequirement, protocol);
  const Container = internal ? "div" : Card;
  const Action = internal ? "button" : Button;

  return (
    <Container className={internal ? "public-inline-success public-service-success-card" : "tw:mx-auto tw:grid tw:w-full tw:max-w-[680px] tw:justify-items-center tw:gap-3 tw:p-5 tw:text-center tw:text-ui-text tw:[&>h3]:m-0 tw:[&>h3]:text-xl tw:[&>h3]:font-semibold tw:[&>h3]:text-ui-ink tw:[&>p]:m-0"}>
      <CheckCircle2 size={52} aria-hidden="true" className={internal ? undefined : "tw:text-ui-accent"} />
      <h3>Recebemos sua solicitação!</h3>
      <p>Ela está em análise.</p>
      <p>Protocolo oficial: <strong>{protocol}</strong></p>
      <FollowUpSummary value={followUp} />
      <div className={internal ? "public-service-success-actions" : "tw:flex tw:flex-wrap tw:justify-center tw:gap-2"}>
        <Action className={internal ? "primary-action" : undefined} type="button" onClick={onClose}>{closeLabel}</Action>
        <Action className={internal ? "ghost-button" : undefined} variant={internal ? undefined : "outline"} type="button" onClick={requirement.download} disabled={requirement.downloading}>
          {requirement.downloading ? "Gerando..." : "Baixar requerimento"}
        </Action>
        {onCreatePassword && <Action className={internal ? "ghost-button" : undefined} variant={internal ? undefined : "outline"} type="button" onClick={onCreatePassword}>Criar minha senha</Action>}
      </div>
      {requirement.error && <p className="form-error" role="alert">{requirement.error}</p>}
    </Container>
  );
}
