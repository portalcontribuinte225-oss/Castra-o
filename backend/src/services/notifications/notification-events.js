import { NO_SHOW_CANCEL_REASON, NotificationEvent, REJECTED_CANCEL_REASON } from "../../../../shared/notification-contract.js";

function workflow(request) {
  return request.workflow_data || request.workflowData || {};
}

function scheduleSignature(request) {
  const data = workflow(request);
  return JSON.stringify([
    request.schedule_date || request.preferredSchedule || "",
    data.scheduleTime || request.schedule_time || "",
    data.scheduleSlotTime || request.schedule_slot_time || "",
    request.schedule_location_name || request.scheduleLocationName || "",
    request.schedule_address || request.scheduleAddress || "",
    request.schedule_address_url || request.scheduleAddressUrl || "",
    request.schedule_municipality || request.scheduleMunicipality || "",
  ]);
}

function hasDocumentDecisionChange(before, after) {
  const decisions = new Set(["approved", "rejected"]);
  const previous = new Map((Array.isArray(before.documents) ? before.documents : [])
    .filter((document) => document && typeof document === "object")
    .map((document) => [document.documentId || document.id || document.fileName, document.status]));
  return (Array.isArray(after.documents) ? after.documents : []).some((document) => {
    if (!document || typeof document !== "object") return false;
    const id = document.documentId || document.id || document.fileName;
    return id && previous.has(id) && decisions.has(document.status) && previous.get(id) !== document.status;
  });
}

export function selectNotificationEvents(before, after) {
  const events = [];
  if (after.status === "AGENDADA") {
    if (before.status !== "AGENDADA") events.push(NotificationEvent.SCHEDULE_CONFIRMED);
    else if (scheduleSignature(before) !== scheduleSignature(after)) events.push(NotificationEvent.SCHEDULE_CHANGED);
  }
  if (before.status === "AGENDADA" && after.status === "CANCELADA" && workflow(after).cancelReason === NO_SHOW_CANCEL_REASON) events.push(NotificationEvent.NO_SHOW);
  if (before.status !== "CANCELADA" && after.status === "CANCELADA" && workflow(after).cancelReason === REJECTED_CANCEL_REASON) events.push(NotificationEvent.REQUEST_REJECTED);
  if (hasDocumentDecisionChange(before, after)) events.push(NotificationEvent.DOCUMENTS_REVIEWED);
  if (after.status === "REALIZADA" && before.status !== "REALIZADA") events.push(NotificationEvent.COMPLETED);
  return events;
}
