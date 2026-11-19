import { DocumentReviewStatus } from "../../../../shared/document-reuse-contract.js";
import { isExcludedDocument, requestDocumentDefinitions } from "../documents/document-policy.js";
import { decorateRequestDocuments } from "../documents/document-reviews.js";

// A document type created after the request was made is not asked of it.
function configuredBefore(definition, request) {
  const created = Date.parse(definition.createdAt || definition.created_at || "");
  const requested = Date.parse(request.created_at || "");
  return !Number.isFinite(created) || !Number.isFinite(requested) || created <= requested;
}

// The names of the required documents of the request that are not approved yet (missing, waiting or sent back for correction).
// Scheduling a procedure waits for them.
export function pendingRequiredDocuments(settings, request) {
  const definitions = requestDocumentDefinitions(settings, request)
    .filter((definition) => definition.required && configuredBefore(definition, request));
  if (!definitions.length) return [];
  const documents = decorateRequestDocuments(request, settings).documents.filter((item) => !isExcludedDocument(item));
  return definitions
    .filter((definition) => {
      const byId = documents.filter((item) => item.documentId === definition.id);
      const matches = byId.length ? byId : documents.filter((item) => item.documentName === definition.name);
      return !matches.some((item) => item.status === DocumentReviewStatus.APPROVED);
    })
    .map((definition) => definition.name || "Documento");
}
