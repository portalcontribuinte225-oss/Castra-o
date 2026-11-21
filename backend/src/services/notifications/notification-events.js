import { NO_SHOW_CANCEL_REASON, NotificationEvent, REJECTED_CANCEL_REASON } from "../../../../shared/notification-contract.js";
import { isComplaintPhotoId } from "../../../../shared/complaint-photo-contract.js";
import { DocumentReviewStatus } from "../../../../shared/document-reuse-contract.js";
import { isExcludedDocument, PHOTO_DEFINITION } from "../documents/document-policy.js";

function workflow(request) {
  return request.workflow_data || request.workflowData || {};
}

function scheduleSignature(request) {
  const data = workflow(request);
  return JSON.stringify([
    request.schedule_date || request.preferredSchedule || "",
    data.scheduleSlotTime || data.scheduleTime || request.schedule_slot_time || request.schedule_time || "",
    data.scheduleOccurrenceKey || "",
    request.schedule_location_name || request.scheduleLocationName || "",
    request.schedule_address || request.scheduleAddress || "",
    request.schedule_address_url || request.scheduleAddressUrl || "",
    request.schedule_municipality || request.scheduleMunicipality || "",
  ]);
}

function reviewableAttachments(request) {
  return (Array.isArray(request.documents) ? request.documents : []).filter((document) =>
    !isExcludedDocument(document) && !isComplaintPhotoId(document.documentId)
    && document.documentId !== PHOTO_DEFINITION.id && document.documentName !== PHOTO_DEFINITION.name
    && typeof document.attachmentId === "string" && document.attachmentId);
}

function documentDecisionEvents(before, after) {
  const previous = new Map(reviewableAttachments(before).map((document) => [document.attachmentId, document.status]));
  const decisions = new Set(reviewableAttachments(after)
    .filter(({ attachmentId, status, review }) => previous.has(attachmentId) && previous.get(attachmentId) !== status && review?.decision === status)
    .map(({ status }) => status));
  const events = [];
  if (decisions.has(DocumentReviewStatus.APPROVED)) events.push(NotificationEvent.DOCUMENTS_APPROVED);
  if (decisions.has(DocumentReviewStatus.REJECTED)) events.push(NotificationEvent.DOCUMENTS_REJECTED);
  return events;
}

export function selectNotificationEvents(before, after) {
  const events = [];
  if (after.status === "AGENDADA") {
    if (before.status !== "AGENDADA") events.push(NotificationEvent.SCHEDULE_CONFIRMED);
    else if (scheduleSignature(before) !== scheduleSignature(after)) events.push(NotificationEvent.SCHEDULE_CHANGED);
  }
  if (before.status === "AGENDADA" && after.status === "CANCELADA" && workflow(after).cancelReason === NO_SHOW_CANCEL_REASON) events.push(NotificationEvent.NO_SHOW);
  if (before.status !== "CANCELADA" && after.status === "CANCELADA" && workflow(after).cancelReason === REJECTED_CANCEL_REASON) events.push(NotificationEvent.REQUEST_REJECTED);
  events.push(...documentDecisionEvents(before, after));
  if (after.status === "REALIZADA" && before.status !== "REALIZADA") events.push(NotificationEvent.COMPLETED);
  return events;
}
