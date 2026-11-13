import { DocumentReviewStatus, MAX_REQUEST_DOCUMENTS } from "../../../../shared/document-reuse-contract.js";
import { isInternalUser } from "../../tenant.js";
import { assertMaterializedRequestSize, decodeDocumentContent, documentError } from "./document-content.js";
import { canonicalDocumentDefinition, documentCriteriaFingerprint, isExcludedDocument } from "./document-policy.js";
import { hasValidDocumentReceipt, signDocumentReceipt } from "./document-provenance.js";
import { describeStoredDocument } from "./stored-document.js";
import { createReceivedDocument, definitionsForRequest } from "./request-documents.js";

function definitionFor(document, definitions) {
  return definitions.find((item) => item.id === document.documentId)
    || canonicalDocumentDefinition({ id: document.documentId, name: document.documentName || "Documento", required: false });
}

function normalizeExisting(previous, document, index, definition) {
  const source = { ...previous, document, document_index: index };
  const description = describeStoredDocument(source, definition);
  const normalized = { attachmentId: description.attachmentId, requestId: previous.id,
    ownerUserId: previous.tutor_id || null, municipalityId: previous.municipality_id, documentId: document.documentId,
    documentName: document.documentName || definition.name || "Documento", reuseScope: definition.reuseScope,
    animalId: description.animalId, fileName: String(document.fileName || "documento").replace(/[\r\n\\/]/g, "_").slice(0, 180),
    fileType: description.content.contentType, fileSize: description.content.size, dataUrl: description.content.dataUrl,
    hash: description.hash, receivedAt: description.receivedAt, origin: description.origin,
    status: description.status, ...(description.status === DocumentReviewStatus.APPROVED ? { review: document.review } : {}) };
  return { ...normalized, receipt: signDocumentReceipt(normalized) };
}

// Read-only projection grants legacy attachments a stable identity without trusting caller-supplied metadata.
export function decorateRequestDocuments(request, settings = {}) {
  const definitions = definitionsForRequest(settings, request);
  return { ...request, documents: (Array.isArray(request.documents) ? request.documents : []).map((document, index) => {
    if (isExcludedDocument(document)) return document;
    try {
      const definition = definitionFor(document, definitions);
      const source = { ...request, document, document_index: index };
      const description = describeStoredDocument(source, definition);
      const trustedReview = hasValidDocumentReceipt(document, source) && document.review?.hash === description.hash;
      return { ...document, attachmentId: description.attachmentId, hash: description.hash, receivedAt: description.receivedAt,
        status: trustedReview ? document.status : DocumentReviewStatus.ATTACHED,
        review: trustedReview ? document.review : undefined };
    } catch { return { ...document, status: DocumentReviewStatus.ATTACHED, receipt: undefined, review: undefined }; }
  }) };
}

export async function applyDocumentReviews(_client, { previous, patch, user, municipalityId, settings = {}, now = new Date() }) {
  if (patch.documents === undefined && patch.documentReviews === undefined) return undefined;
  if (!isInternalUser(user) || municipalityId !== previous.municipality_id) throw documentError("Revisão não autorizada.", 403);
  const oldDocuments = Array.isArray(previous.documents) ? previous.documents : [];
  const supplied = patch.documents === undefined ? oldDocuments : patch.documents;
  const reviews = patch.documentReviews === undefined ? [] : patch.documentReviews;
  if (!Array.isArray(supplied) || !Array.isArray(reviews) || supplied.length > MAX_REQUEST_DOCUMENTS || reviews.length > MAX_REQUEST_DOCUMENTS) throw documentError("Anexos ou decisões inválidos.");
  const definitions = definitionsForRequest(settings, previous);
  const normalizedOld = oldDocuments.map((document, index) => {
    if (isExcludedDocument(document)) return { ...document, internalEvidence: true };
    try { return normalizeExisting(previous, document, index, definitionFor(document, definitions)); }
    catch { return { ...document, status: DocumentReviewStatus.ATTACHED, review: undefined, receipt: undefined }; }
  });
  const animalIds = (previous.animals || []).map((animal) => animal?.id).filter(Boolean);
  const documents = supplied.map((upload, index) => {
    if (!upload || typeof upload !== "object") throw documentError("Anexo inválido.");
    const existing = normalizedOld.find((item) => upload.attachmentId && item.attachmentId === upload.attachmentId)
      || (patch.documents === undefined ? normalizedOld[index] : normalizedOld.find((item) => item.documentId === upload.documentId && item.dataUrl === upload.dataUrl));
    if (existing && existing.dataUrl === upload.dataUrl && existing.documentId === upload.documentId) return existing;
    const evidence = /^evidencia-/.test(upload.documentId || "");
    const definition = definitions.find((item) => item.id === upload.documentId)
      || (evidence ? canonicalDocumentDefinition({ id: upload.documentId, name: "Evidência da apuração", required: false }) : null);
    if (!definition) throw documentError("Tipo de anexo não permitido.");
    return createReceivedDocument(upload, definition, { requestId: previous.id, ownerUserId: previous.tutor_id,
      municipalityId, animalIds, now, internalEvidence: evidence });
  });
  const seenReviews = new Set();
  for (const review of reviews) {
    if (!review || ![DocumentReviewStatus.APPROVED, DocumentReviewStatus.REJECTED].includes(review.decision)
      || typeof review.attachmentId !== "string" || seenReviews.has(review.attachmentId)) throw documentError("Decisão de documento inválida.");
    seenReviews.add(review.attachmentId);
    const document = documents.find((item) => item.attachmentId === review.attachmentId);
    if (!document || isExcludedDocument(document)) throw documentError("O arquivo a revisar não está mais disponível.", 409);
    const definition = definitionFor(document, definitions);
    const content = decodeDocumentContent(document, definition);
    document.status = review.decision;
    document.review = { decision: review.decision, reviewedBy: user.id, reviewedAt: now.toISOString(),
      hash: content.hash, criteriaFingerprint: documentCriteriaFingerprint(definition) };
    document.receipt = signDocumentReceipt(document);
  }
  assertMaterializedRequestSize({ ...previous, ...patch, documents });
  return documents;
}
