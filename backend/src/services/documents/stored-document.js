import { DocumentReuseScope, DocumentReviewStatus, DocumentReuseState } from "../../../../shared/document-reuse-contract.js";
import { decodeDocumentContent, documentError } from "./document-content.js";
import { documentCriteriaFingerprint, isExcludedDocument } from "./document-policy.js";
import { hasValidDocumentReceipt, legacyAttachmentId } from "./document-provenance.js";

export function sourceAnimalId(source) {
  const animals = Array.isArray(source.animals) ? source.animals : [];
  return animals.length === 1 ? animals[0]?.id || null : animals.length === 0 ? source.animal_id || null : null;
}

function isoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function describeStoredDocument(source, definition, { now = new Date(), verifyContent = true } = {}) {
  const document = source.document;
  if (isExcludedDocument(document)) throw documentError("Este anexo pertence exclusivamente ao processo.");
  const proofValid = hasValidDocumentReceipt(document, source);
  const content = verifyContent ? decodeDocumentContent(document, definition) : null;
  const hash = content?.hash || (proofValid ? document.hash : "");
  if (!hash || (proofValid && document.hash !== hash)) throw documentError("O conteúdo do documento foi alterado.");
  const attachmentId = proofValid ? document.attachmentId : legacyAttachmentId(source.id, source.document_index, hash);
  const unverifiedOrigin = !proofValid && Boolean(document.receipt || document.origin);
  const receivedAt = proofValid ? isoDate(document.receivedAt) : unverifiedOrigin ? null : isoDate(source.created_at);
  const animalId = proofValid ? document.animalId || null : sourceAnimalId(source);
  const status = document.status === DocumentReviewStatus.REJECTED ? DocumentReviewStatus.REJECTED
    : proofValid && document.status === DocumentReviewStatus.APPROVED && document.review?.hash === hash
      && document.review?.decision === DocumentReviewStatus.APPROVED
      && document.review?.criteriaFingerprint === documentCriteriaFingerprint(definition)
      ? DocumentReviewStatus.APPROVED : DocumentReviewStatus.ATTACHED;
  const expiryTime = receivedAt && definition.reuseValidityDays !== null
    ? new Date(receivedAt).getTime() + definition.reuseValidityDays * 86400_000 : null;
  const expiresAt = expiryTime !== null && Number.isFinite(new Date(expiryTime).getTime()) ? new Date(expiryTime).toISOString() : null;
  const unavailable = !proofValid && Boolean(document.receipt) || status === DocumentReviewStatus.REJECTED
    || ["revoked", "superseded"].includes(document.status) || document.revokedAt || document.supersededAt;
  const expired = expiresAt && new Date(expiresAt) <= now;
  const validityUnknown = definition.reuseValidityDays !== null && (!receivedAt || !expiresAt);
  return { attachmentId, hash, receivedAt, expiresAt, animalId, status, proofValid, content,
    state: unavailable || validityUnknown ? DocumentReuseState.UNAVAILABLE : expired ? DocumentReuseState.EXPIRED
      : status === DocumentReviewStatus.APPROVED ? DocumentReuseState.REUSABLE : DocumentReuseState.PENDING,
    origin: proofValid ? document.origin : { requestId: source.id, attachmentId, receivedAt,
      ownerUserId: source.tutor_id || null, municipalityId: source.municipality_id },
  };
}

export function isReusableForAnimal(description, definition, animalId) {
  return definition.reuseScope !== DocumentReuseScope.REQUEST
    && (definition.reuseScope !== DocumentReuseScope.ANIMAL || Boolean(animalId && description.animalId === animalId))
    && [DocumentReuseState.REUSABLE, DocumentReuseState.PENDING].includes(description.state);
}
