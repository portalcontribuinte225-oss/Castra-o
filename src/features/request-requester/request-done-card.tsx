import { CheckCircle2 } from "lucide-react";
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
}

// The last screen of a request, for the public page and for the staff's modal: the protocol, the notices and the request document.
export function RequestDoneCard({ protocol, followUp, createRequirement, closeLabel, onClose, onCreatePassword }: RequestDoneCardProps) {
  const requirement = useRequirementDownload(createRequirement, protocol);

  return (
    <div className="public-inline-success public-service-success-card">
      <CheckCircle2 size={52} />
      <h3>Recebemos sua solicitação!</h3>
      <p>Ela está em análise.</p>
      <p>Protocolo oficial: <strong>{protocol}</strong></p>
      <FollowUpSummary value={followUp} />
      <div className="public-service-success-actions">
        <button className="primary-action" type="button" onClick={onClose}>{closeLabel}</button>
        <button className="ghost-button" type="button" onClick={requirement.download} disabled={requirement.downloading}>
          {requirement.downloading ? "Gerando..." : "Baixar requerimento"}
        </button>
        {onCreatePassword && <button className="ghost-button" type="button" onClick={onCreatePassword}>Criar minha senha</button>}
      </div>
      {requirement.error && <p className="form-error">{requirement.error}</p>}
    </div>
  );
}
