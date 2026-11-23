import { isComplaintPhotoId } from "../../../../shared/complaint-photo-contract.js";
import { DocumentReviewStatus, MAX_REQUEST_DOCUMENTS } from "../../../../shared/document-reuse-contract.js";
import { isInternalUser } from "../../tenant.js";
import { assertMaterializedRequestSize, decodeDocumentContent, documentError } from "./document-content.js";
import { canonicalDocumentDefinition, documentCriteriaFingerprint, isExcludedDocument } from "./document-policy.js";
import { hasValidDocumentReceipt, signDocumentReceipt } from "./document-provenance.js";
import { describeStoredDocument } from "./stored-document.js";
import { createReceivedDocument, definitionsForRequest } from "./request-documents.js";

const MAX_REVIEW_NOTE = 500;

function definitionFor(document, definitions) {
  return definitions.find((item) => item.id === document.documentId)
    || canonicalDocumentDefinition({ id: document.documentId, name: document.documentName || "Documento", required: false });
}

function normalizeExisting(previous, document, definition) {
  const source = { ...previous, document };
  const description = describeStoredDocument(source, definition);
  const normalized = { attachmentId: description.attachmentId, requestId: previous.id,
    ownerUserId: previous.tutor_id || null, municipalityId: previous.municipality_id, documentId: document.documentId,
    documentName: document.documentName || definition.name || "Documento", reuseScope: definition.reuseScope,
    animalId: description.animalId, fileName: String(document.fileName || "documento").replace(/[\r\n\\/]/g, "_").slice(0, 180),
    fileType: description.content.contentType, fileSize: description.content.size, dataUrl: description.content.dataUrl,
    hash: description.hash, receivedAt: description.receivedAt, origin: description.origin,
    status: description.status, ...([DocumentReviewStatus.APPROVED, DocumentReviewStatus.REJECTED].includes(description.status) ? { review: document.review } : {}) };
  return { ...normalized, receipt: signDocumentReceipt(normalized) };
}

// What the screens get of each attachment: the id, hash and receipt date the server describes, and the review only under a valid receipt.
export function decorateRequestDocuments(request, settings = {}) {
  const definitions = definitionsForRequest(settings, request);
  return { ...request, documents: (Array.isArray(request.documents) ? request.documents : []).map((document) => {
    if (isExcludedDocument(document) || isComplaintPhotoId(document?.documentId)) return document;
    try {
      const definition = definitionFor(document, definitions);
      const source = { ...request, document };
      const description = describeStoredDocument(source, definition);
      const trustedReview = hasValidDocumentReceipt(document, source) && document.review?.hash === description.hash;
      return { ...document, attachmentId: description.attachmentId, hash: description.hash, receivedAt: description.receivedAt,
        status: trustedReview ? document.status : DocumentReviewStatus.ATTACHED,
        review: trustedReview ? document.review : undefined };
    } catch { return { ...document, status: DocumentReviewStatus.ATTACHED, receipt: undefined, review: undefined }; }
  }) };
}

export async function applyDocumentReviews(_client, { previous, patch, user, municipalityId, settings = {}, now = new Date() }) {
  if (patch.documents === undefined && patch.documentReviews === undefined && patch.documentEvidence === undefined) return undefined;
  if (!isInternalUser(user) || municipalityId !== previous.municipality_id) throw documentError("Revisão não autorizada.", 403);
  const oldDocuments = Array.isArray(previous.documents) ? previous.documents : [];
  const evidence = patch.documentEvidence;
  if (evidence !== undefined && (patch.documents !== undefined || !evidence || typeof evidence !== "object" || Array.isArray(evidence)
    || typeof evidence.documentId !== "string" || !/^evidencia-[a-z\d-]{1,72}$/i.test(evidence.documentId))) throw documentError("Evidência inválida.");
  const supplied = evidence ? [...oldDocuments, evidence] : patch.documents === undefined ? oldDocuments : patch.documents;
  const reviews = patch.documentReviews === undefined ? [] : patch.documentReviews;
  if (!Array.isArray(supplied) || !Array.isArray(reviews) || supplied.length > MAX_REQUEST_DOCUMENTS || reviews.length > MAX_REQUEST_DOCUMENTS) throw documentError("Anexos ou decisões inválidos.");
  const definitions = definitionsForRequest(settings, previous);
  const normalizedOld = oldDocuments.map((document) => {
    if (isComplaintPhotoId(document?.documentId)) return document;
    if (isExcludedDocument(document)) return { ...document, internalEvidence: true };
    try { return normalizeExisting(previous, document, definitionFor(document, definitions)); }
    catch { return { ...document, status: DocumentReviewStatus.ATTACHED, review: undefined, receipt: undefined }; }
  });
  const animalIds = (previous.animals || []).map((animal) => animal?.id).filter(Boolean);
  const documents = supplied.map((upload, index) => {
    if (!upload || typeof upload !== "object") throw documentError("Anexo inválido.");
    const existing = normalizedOld.find((item) => upload.attachmentId && item.attachmentId === upload.attachmentId)
      || (patch.documents === undefined ? normalizedOld[index] : normalizedOld.find((item) => item.documentId === upload.documentId && item.dataUrl === upload.dataUrl));
    if (existing && existing.dataUrl === upload.dataUrl && existing.documentId === upload.documentId) return existing;
    if (isComplaintPhotoId(upload.documentId) || isComplaintPhotoId(existing?.documentId)) {
      throw documentError("As fotos da ocorrência são enviadas no registro da denúncia.");
    }
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
    // Sending a document back for correction always says what has to be corrected; the tutor is told it.
    const note = review.decision === DocumentReviewStatus.REJECTED && typeof review.note === "string" ? review.note.trim() : "";
    if (review.decision === DocumentReviewStatus.REJECTED && (!note || note.length > MAX_REVIEW_NOTE)) throw documentError(`Informe o que precisa ser corrigido no documento (até ${MAX_REVIEW_NOTE} caracteres).`);
    const document = documents.find((item) => item.attachmentId === review.attachmentId);
    if (!document || isExcludedDocument(document) || isComplaintPhotoId(document.documentId)) throw documentError("O arquivo a revisar não está mais disponível.", 409);
    const definition = definitionFor(document, definitions);
    const content = decodeDocumentContent(document, definition);
    document.status = review.decision;
    document.review = { decision: review.decision, reviewedBy: user.id, reviewedAt: now.toISOString(),
      hash: content.hash, criteriaFingerprint: documentCriteriaFingerprint(definition), ...(note ? { note } : {}) };
    document.receipt = signDocumentReceipt(document);
  }
  assertMaterializedRequestSize({ ...previous, documents });
  return documents;
}
