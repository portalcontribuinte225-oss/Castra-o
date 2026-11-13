import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";

export function buildDocumentReviewDecisions(rows: { id: string; document?: { attachmentId?: string } }[], decisions: Record<string, string>) {
  return rows.flatMap((row) => {
    const decision = decisions[row.id];
    if (decision !== DocumentReviewStatus.APPROVED && decision !== DocumentReviewStatus.REJECTED) return [];
    if (!row.document?.attachmentId) throw new Error("Atualize o processo para identificar o anexo antes da conferência.");
    return [{ attachmentId: row.document.attachmentId, decision }];
  });
}
