import { useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { FollowUpSummary } from "../request-follow-up/follow-up-summary";

interface RequestDoneCardProps {
  protocol: string;
  followUp?: { enabled: boolean; email?: string; phone?: string };
  // Makes the request document (a PDF, as a data URL) when the person asks for it.
  createRequirement: () => Promise<string>;
  closeLabel: string;
  onClose: () => void;
  // What only some places have to say here (the access of a tutor that was just registered).
  children?: ReactNode;
}

// The last screen of a request, for the public page and for the staff's modal: the protocol, the notices and the request document.
export function RequestDoneCard({ protocol, followUp, createRequirement, closeLabel, onClose, children }: RequestDoneCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const anchor = window.document.createElement("a");
      anchor.href = await createRequirement();
      anchor.download = `Requerimento ${protocol}.pdf`.trim();
      anchor.click();
    } catch (failure) {
      console.error("Erro ao gerar requerimento:", failure);
      setError("Não foi possível gerar o requerimento agora. Tente novamente em instantes.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="public-inline-success public-service-success-card">
      <CheckCircle2 size={52} />
      <h3>Recebemos sua solicitação!</h3>
      <p>Ela está em análise.</p>
      <p>Protocolo oficial: <strong>{protocol}</strong></p>
      <FollowUpSummary value={followUp} />
      {children}
      <div className="public-service-success-actions">
        <button className="primary-action" type="button" onClick={onClose}>{closeLabel}</button>
        <button className="ghost-button" type="button" onClick={download} disabled={downloading}>
          {downloading ? "Gerando..." : "Baixar requerimento"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
