import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DocumentReviewStatus, DocumentReuseState } from "../../../shared/document-reuse-contract.js";
import type { ReusableDocumentCandidate } from "./registered-animal-types";

export function ReusableDocumentChoices({ candidates, selected, onSelect, onPreview, onRemove }: { candidates: ReusableDocumentCandidate[]; selected?: ReusableDocumentCandidate; onSelect: (candidate: ReusableDocumentCandidate) => void; onPreview: (candidate: ReusableDocumentCandidate) => void; onRemove: () => void }) {
  if (!candidates.length) return null;
  return (
    <div className="tw:grid tw:gap-3">
      {candidates.map((candidate) => {
        const active = selected?.attachmentId === candidate.attachmentId;
        const status = candidate.eligible
          ? candidate.status === DocumentReviewStatus.APPROVED ? "Revisão anterior válida" : "Pendente de conferência"
          : candidate.state === DocumentReuseState.EXPIRED ? "Vencido para reaproveitamento" : "Precisa anexar outro arquivo";
        return (
          <Card className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:p-3 tw:data-[selected=true]:border-ui-accent" data-selected={active || undefined} key={`${candidate.reuseRef.sourceRequestId}:${candidate.attachmentId}`}>
            <div className="tw:grid tw:min-w-0 tw:flex-[1_1_180px] tw:gap-1 tw:break-all">
              <strong>{candidate.fileName}</strong>
              <small>{status}</small>
              {candidate.expiresAt && <small>Prazo para reuso: {new Date(candidate.expiresAt).toLocaleDateString("pt-BR")}</small>}
            </div>
            <Button variant="outline" onClick={() => onPreview(candidate)}>Ver arquivo</Button>
            {active ? (
              <>
                <span className="reused-document-badge">Reaproveitado</span>
                <Button variant="outline" onClick={onRemove}>Usar outro arquivo</Button>
              </>
            ) : <Button variant="outline" disabled={!candidate.eligible} onClick={() => onSelect(candidate)}>Reaproveitar</Button>}
          </Card>
        );
      })}
    </div>
  );
}
