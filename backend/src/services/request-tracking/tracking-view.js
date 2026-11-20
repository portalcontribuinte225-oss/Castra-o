import { isComplaintPhotoId } from "../../../../shared/complaint-photo-contract.js";
import { DocumentReviewStatus } from "../../../../shared/document-reuse-contract.js";
import { isExcludedDocument } from "../documents/document-policy.js";

const toIso = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

// Allow-list projection: nothing from the request is exposed unless it is named here.
// No tutor, contact, address, file name or review reason ever leaves through this view.
export function buildTrackingView(row) {
  const documents = (Array.isArray(row.documents) ? row.documents : [])
    .filter((document) => !isExcludedDocument(document) && !isComplaintPhotoId(document.documentId));
  const count = (status) => documents.filter((document) => document.status === status).length;
  const approved = count(DocumentReviewStatus.APPROVED);
  const needsCorrection = count(DocumentReviewStatus.REJECTED);
  return {
    protocol: row.protocol,
    requestType: row.request_type || "",
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    schedule: row.schedule_date
      ? { date: String(row.schedule_date), locationName: row.schedule_location_name || "", address: row.schedule_address || "" }
      : null,
    documents: { total: documents.length, approved, needsCorrection, pending: documents.length - approved - needsCorrection },
  };
}
