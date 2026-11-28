import { useRef, useState } from "react";
import { CheckCircle2, Download, Eye, FileText, Paperclip, X } from "lucide-react";
import { AiAnalysisDetails } from "../document-analysis/ai-analysis-details";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import type { AttachmentRow } from "./attachment-rows";
import { attachmentDescription, attachmentStateClasses, attachmentStateLabels, canReviewAttachment, isBlockingAttachment, AttachmentKind, AttachmentState } from "./attachment-rows";

interface AttachmentsTabProps {
  rows: AttachmentRow[];
  canReview: boolean;
  canAttach: boolean;
  busy: boolean;
  uploadingEvidence: boolean;
  error: string;
  onPreview: (row: AttachmentRow, trigger: HTMLButtonElement) => void;
  onDownload: (row: AttachmentRow) => void;
  onApprove: (row: AttachmentRow) => void;
  onReject: (row: AttachmentRow) => void;
  onEvidence: (files: File[]) => void;
}

export function AttachmentsTab({ rows, canReview, canAttach, busy, uploadingEvidence, error, onPreview, onDownload, onApprove, onReject, onEvidence }: AttachmentsTabProps) {
  const blocking = rows.filter(isBlockingAttachment);
  const evidenceInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const complementary = rows.filter((row) => row.document?.internalEvidence || row.document?.documentId?.startsWith?.("evidencia-"));
  const regular = rows.filter((row) => !complementary.includes(row));

  function rowView(row: AttachmentRow, isComplementary = false) {
    const stateClass = attachmentStateClasses[row.state];
    const reviewable = row.kind === AttachmentKind.MISSING || row.kind === AttachmentKind.ATTACHMENT && row.state !== AttachmentState.INFO;
    const decisionDisabled = busy || !canReview || !canReviewAttachment(row);
    return (
      <Card as="article" key={`${row.kind}-${row.id}`} className={`process-attachment-row process-attachment-row--${stateClass}`}>
        <div className="process-attachment-main">
          <span className="process-attachment-icon-box">{isComplementary ? <Paperclip size={15} /> : <FileText size={15} />}</span>
          <div className="process-attachment-info">
            <div className="process-attachment-heading">
              <strong>{isComplementary ? row.fileName : row.title}</strong>
              {!isComplementary && <span className={`attachment-status attachment-status--${stateClass}`}>{attachmentStateLabels[row.state]}</span>}
            </div>
            <p className="attachment-ai-message">{isComplementary ? "Documento complementar" : attachmentDescription(row)}</p>
            {!!row.document?.provider && !row.document.error && (
              <div className="attachment-ai-details">
                <AiAnalysisDetails show provider={row.document.provider} model={row.document.model} confidence={row.document.confidence}
                  criteriaResults={row.document.criteriaResults} showMeta={false} criteriaClassName="doc-criteria-results attachment-ai-criteria" />
              </div>
            )}
          </div>
        </div>
        <div className="process-attachment-actions">
          {row.available && <div className="process-attachment-file-actions" aria-label={`Arquivo de ${row.title}`}>
            <Button variant="outline" className="prm-icon-button" aria-label={`Visualizar ${row.fileName || row.title}`} title="Visualizar" disabled={busy}
              onClick={(event) => onPreview(row, event.currentTarget)}><Eye size={16} aria-hidden="true" /></Button>
            <Button variant="outline" className="prm-icon-button" aria-label={`Baixar ${row.fileName || row.title}`} title="Baixar" disabled={busy}
              onClick={() => onDownload(row)}><Download size={16} aria-hidden="true" /></Button>
          </div>}
          {reviewable && canReview && <div className="process-attachment-review-actions">
            <Button variant="outline" className="prm-approve-document" aria-label={`Deferir ${row.title}`} disabled={decisionDisabled} onClick={() => onApprove(row)}>
              <CheckCircle2 size={15} aria-hidden="true" /> Deferir
            </Button>
            <Button variant="danger" aria-label={`Indeferir ${row.title}`} disabled={decisionDisabled} onClick={() => onReject(row)}>
              <X size={15} aria-hidden="true" /> Indeferir
            </Button>
          </div>}
        </div>
      </Card>
    );
  }

  return (
    <div className="prm-section">
      {error && <p className="form-error" role="alert">{error}</p>}
      <h3 className="prm-section-title">Conferência de documentos</h3>
      <div className="process-attachments-list">
        {regular.map((row) => rowView(row))}
        {complementary.map((row) => rowView(row, true))}
        {canAttach && <>
          <input ref={evidenceInput} type="file" hidden multiple accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) onEvidence(files);
          }} />
          <Card as="button" aria-label="Adicionar documentos complementares" aria-busy={uploadingEvidence || undefined}
            className="prm-evidence-drop" data-dragging={dragging} disabled={busy} onClick={() => evidenceInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy && event.dataTransfer.files.length) onEvidence(Array.from(event.dataTransfer.files));
            }}>
            <span className="process-attachment-icon-box"><Paperclip size={16} aria-hidden="true" /></span>
            <strong>{uploadingEvidence ? "Anexando..." : "Documentos complementares"}</strong>
          </Card>
        </>}
      </div>
      {blocking.length > 0 && <p className="prm-documents-warning"><strong>Pendência documental.</strong> A confirmação de agendamentos fica disponível após o deferimento de: {blocking.map((row) => row.title).join(", ")}.</p>}
    </div>
  );
}
