import { createHash } from "node:crypto";
import { authenticatedDigest, safeDigestEqual } from "../auth/auth-security.js";

function receiptPayload(document) {
  const origin = document.origin || {};
  const review = document.review || {};
  return [document.attachmentId, document.requestId, document.ownerUserId || null, document.municipalityId,
    document.documentId, document.reuseScope, document.animalId || null, document.hash, document.receivedAt,
    origin.requestId, origin.attachmentId, origin.receivedAt, origin.ownerUserId || null, origin.municipalityId,
    document.status, document.internalEvidence === true,
    review.decision, review.reviewedBy, review.reviewedAt, review.hash, review.criteriaFingerprint];
}

export function signDocumentReceipt(document) {
  return { version: 1, digest: authenticatedDigest("document-reuse-receipt-v1", ...receiptPayload(document)) };
}

export function hasValidDocumentReceipt(document, source) {
  if (document?.receipt?.version !== 1 || document.requestId !== source.id
    || (document.ownerUserId || null) !== (source.tutor_id || null) || document.municipalityId !== source.municipality_id) return false;
  return safeDigestEqual(document.receipt.digest, signDocumentReceipt(document).digest);
}

export function legacyAttachmentId(requestId, index, hash) {
  return `legacy-${index}-${createHash("sha256").update(JSON.stringify([requestId, index, hash])).digest("hex")}`;
}
