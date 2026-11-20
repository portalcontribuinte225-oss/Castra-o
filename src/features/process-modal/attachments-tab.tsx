import { useRef } from "react";
import { CheckCircle2, Download, Eye, FileText, Plus, X } from "lucide-react";
import { AiAnalysisDetails } from "../../App";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import type { AttachmentRow } from "./attachment-rows";
import { attachmentDescription, attachmentStateClasses, attachmentStateLabels, canReviewAttachment, isBlockingAttachment, AttachmentState } from "./attachment-rows";
import { plural } from "./process-labels";

interface AttachmentsTabProps {
  rows: AttachmentRow[];
  pendingCount: number;
  // Decisions and evidence are taken while the process is open and the user may edit it.
  canReview: boolean;
  canAttach: boolean;
  reviewBlockedReason: string;
  busyId: string;
  uploadingEvidence: boolean;
  error: string;
  onPreview: (row: AttachmentRow, trigger: HTMLButtonElement) => void;
  onDownload: (row: AttachmentRow) => void;
  onApprove: (row: AttachmentRow) => void;
  onReject: (row: AttachmentRow) => void;
  onEvidence: (file: File) => void;
}

export function AttachmentsTab({ rows, pendingCount, canReview, canAttach, reviewBlockedReason, busyId, uploadingEvidence, error, onPreview, onDownload, onApprove, onReject, onEvidence }: AttachmentsTabProps) {
  const blocking = rows.filter(isBlockingAttachment);
  const busy = Boolean(busyId) || uploadingEvidence;
  const evidenceInput = useRef<HTMLInputElement>(null);
  return (
    <div className="prm-section">
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="prm-section-head">
        <div>
          <p className="prm-section-label">Conferência de documentos</p>
        </div>
        {pendingCount > 0 && <span className="attachment-status attachment-status--pending">{plural(pendingCount, "pendente", "pendentes")}</span>}
      </div>
      <div className="process-attachments-list">
        {rows.map((row) => {
          const stateClass = attachmentStateClasses[row.state];
          const reviewable = canReview && canReviewAttachment(row);
          return (
            <Card as="article" key={`${row.kind}-${row.id}`} className={`process-attachment-row process-attachment-row--${stateClass}${isBlockingAttachment(row) ? " is-blocking tw:border-orange-200 tw:bg-orange-50" : ""}`}>
              <div className="process-attachment-main">
                <span className="process-attachment-icon-box"><FileText size={15} /></span>
                <div className="process-attachment-info">
                  <div className="process-attachment-heading">
                    <strong>{row.title}</strong>
                    <span className={`attachment-status attachment-status--${stateClass}`}>{attachmentStateLabels[row.state]}</span>
                  </div>
                  <p className="attachment-ai-message">{attachmentDescription(row)}</p>
                  {Boolean(row.document?.provider) && !row.document?.error && (
                    <div className="attachment-ai-details">
                      <AiAnalysisDetails show provider={row.document?.provider} model={row.document?.model} confidence={row.document?.confidence}
                        criteriaResults={row.document?.criteriaResults} showMeta={false} criteriaClassName="doc-criteria-results attachment-ai-criteria" />
                    </div>
                  )}
                </div>
              </div>
              <div className="process-attachment-actions">
                {row.available && (
                  <div className="process-attachment-file-actions" aria-label={`Arquivo de ${row.title}`}>
                    <Button variant="outline" className="tw:size-10 tw:shrink-0 tw:px-0" aria-label={`Visualizar ${row.title}`} title="Visualizar" disabled={busy} onClick={(event) => onPreview(row, event.currentTarget)}><Eye size={16} aria-hidden="true" /></Button>
                    <Button variant="outline" className="tw:size-10 tw:shrink-0 tw:px-0" aria-label={`Baixar ${row.title}`} title="Baixar" disabled={busy} onClick={() => onDownload(row)}><Download size={16} aria-hidden="true" /></Button>
                  </div>
                )}
                {reviewable && (
                  <div className="process-attachment-review-actions">
                    <Button variant="custom" className="tw:border-green-200 tw:bg-green-50 tw:text-green-700 tw:enabled:hover:border-green-300 tw:enabled:hover:bg-green-100" aria-label={`Deferir ${row.title}`} title={reviewBlockedReason || "Deferir documento"} disabled={Boolean(reviewBlockedReason) || busy} onClick={() => onApprove(row)}>
                      <CheckCircle2 size={15} aria-hidden="true" /> Deferir
                    </Button>
                    {row.state !== AttachmentState.REJECTED && (
                      <Button variant="custom" className="tw:border-rose-200 tw:bg-rose-50 tw:text-rose-700 tw:enabled:hover:border-rose-300 tw:enabled:hover:bg-rose-100" aria-label={`Indeferir ${row.title}`} title={reviewBlockedReason || "Indeferir documento"} disabled={Boolean(reviewBlockedReason) || busy} onClick={() => onReject(row)}>
                        <X size={15} aria-hidden="true" /> Indeferir
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {canAttach && (
        <>
          <input ref={evidenceInput} type="file" hidden accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onEvidence(file); }} />
          <Card as="button" aria-label="Anexar evidência" aria-busy={uploadingEvidence || undefined} className="prm-evidence-drop tw:w-full tw:text-left tw:enabled:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" disabled={busy} onClick={() => evidenceInput.current?.click()}>
            <span>
              <strong>Anexar evidência</strong>
              <small>Arquivo complementar do processo · PDF ou imagem</small>
            </span>
            <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-sm tw:font-semibold"><Plus size={15} aria-hidden="true" /> {uploadingEvidence ? "Anexando..." : "Adicionar arquivo"}</span>
          </Card>
        </>
      )}
      {blocking.length > 0 && (
        <p className="prm-documents-warning">
          <strong>Pendência documental.</strong> A confirmação de agendamentos fica disponível após o deferimento de: {blocking.map((row) => row.title).join(", ")}.
        </p>
      )}
    </div>
  );
}
