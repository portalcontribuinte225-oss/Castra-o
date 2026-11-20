import { createHash } from "node:crypto";
import { COMPLAINT_PHOTO_IDS, COMPLAINT_PHOTO_MAX_MB, COMPLAINT_PHOTO_MIME_TYPES, isComplaintPhotoId } from "../../../../shared/complaint-photo-contract.js";
import { DocumentReuseScope, normalizeDocumentReusePolicy } from "../../../../shared/document-reuse-contract.js";
import { resolveRequestTypes } from "../../../../shared/request-types-contract.js";
import { isInternalUser } from "../../tenant.js";

export function canonicalDocumentDefinition(document = {}) {
  return { ...document, ...normalizeDocumentReusePolicy(document), required: document.required !== false,
    active: document.active !== false, accept: Array.isArray(document.accept) && document.accept.length ? document.accept : ["image/jpeg", "image/png", "application/pdf"],
    maxSizeMb: Number(document.maxSizeMb) > 0 ? Number(document.maxSizeMb) : 5 };
}

// The request types a document check refers to: the procedures of a request (or its single old type), or the id/name of one type.
export function resolveDocumentRequestTypes(settings, input) {
  const types = Array.isArray(settings?.requestTypes) ? settings.requestTypes : [];
  if (typeof input === "string") return resolveRequestTypes({ requestType: input }, types);
  return resolveRequestTypes({
    animals: input?.animals, workflow: input?.workflow_data ?? input?.workflowData, requestTypeId: input?.requestTypeId,
    requestType: input?.request_type ?? input?.requestType ?? input?.type,
  }, types);
}

// The documents of a request are the sum of the documents of all its procedures, each once; one is required if any procedure requires it.
export function requestDocumentDefinitions(settings, input) {
  const definitions = new Map();
  for (const type of resolveDocumentRequestTypes(settings, input)) {
    for (const reference of Array.isArray(type.documents) ? type.documents : []) {
      const configured = (settings.documentTypes || []).find((item) => item.id === reference.id);
      const definition = canonicalDocumentDefinition({ ...reference, ...(configured || {}) });
      if (!definition.active || typeof definition.id !== "string" || isComplaintPhotoId(definition.id)) continue;
      const known = definitions.get(definition.id);
      definitions.set(definition.id, known ? { ...known, required: known.required || definition.required } : definition);
    }
  }
  return [...definitions.values()];
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

export function documentCriteriaFingerprint(definition) {
  const policy = canonicalDocumentDefinition(definition);
  return createHash("sha256").update(JSON.stringify(stableValue({ id: policy.id, accept: [...policy.accept].sort(),
    maxSizeMb: policy.maxSizeMb, analysisRules: policy.analysisRules || {}, reuseScope: policy.reuseScope }))).digest("hex");
}

export function isExcludedDocument(document) {
  return !document || typeof document !== "object" || document.internalEvidence === true
    || /^(evidencia-|requerimento-)/.test(document.documentId || "") || document.documentName === "Evidência da apuração"
    || document.documentName === "Requerimento municipal";
}

export function documentsVisibleToUser(documents, user) {
  if (isInternalUser(user) || !Array.isArray(documents)) return documents;
  return documents.filter((document) => !isComplaintPhotoId(document?.documentId));
}

export const PHOTO_DEFINITION = Object.freeze({ id: "animal_photo", name: "Foto de registro animal", required: false,
  active: true, reuseScope: DocumentReuseScope.ANIMAL, reuseValidityDays: null,
  accept: ["image/png", "image/jpeg", "image/gif", "image/webp"], maxSizeMb: 5 });

export const COMPLAINT_PHOTO_DEFINITIONS = COMPLAINT_PHOTO_IDS.map((id, index) => canonicalDocumentDefinition({
  id, name: `Foto da ocorrência ${index + 1}`, required: false, reuseScope: DocumentReuseScope.REQUEST,
  accept: COMPLAINT_PHOTO_MIME_TYPES, maxSizeMb: COMPLAINT_PHOTO_MAX_MB,
}));
