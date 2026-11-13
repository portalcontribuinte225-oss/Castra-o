import type { ReusableDocumentCandidate } from "./registered-animal-types";

export function removeReusedDocument(selected: Record<string, ReusableDocumentCandidate>, documentId: string) {
  const next = { ...selected };
  delete next[documentId];
  return next;
}

export function buildDocumentSubmission<T extends { documentId?: string }>(uploads: T[], selected: Record<string, ReusableDocumentCandidate>) {
  const uploadedIds = new Set(uploads.map((upload) => upload.documentId));
  return {
    documents: uploads,
    reusedDocuments: Object.values(selected)
      .filter((candidate) => !uploadedIds.has(candidate.documentId))
      .map((candidate) => candidate.reuseRef),
  };
}
