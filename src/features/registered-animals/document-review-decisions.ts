import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";

type ReviewStatus = typeof DocumentReviewStatus.APPROVED | typeof DocumentReviewStatus.REJECTED;

export function buildDocumentReviewDecision(attachmentId: string | undefined, decision: ReviewStatus, note = "") {
  if (!attachmentId) throw new Error("Atualize o processo para identificar o anexo antes da conferência.");
  return { attachmentId, decision, ...(decision === DocumentReviewStatus.REJECTED ? { note: note.trim() } : {}) };
}
