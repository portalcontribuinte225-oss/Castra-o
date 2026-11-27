import { NO_SHOW_CANCEL_REASON, NotificationEvent, REJECTED_CANCEL_REASON } from "../../../../shared/notification-contract.js";

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

// The review of documents notifies nobody: only the agenda and the outcome of the request do.
export function selectNotificationEvents(before, after) {
  const events = [];
  if (after.status === "AGENDADA") {
    if (before.status !== "AGENDADA") events.push(NotificationEvent.SCHEDULE_CONFIRMED);
    else if (scheduleSignature(before) !== scheduleSignature(after)) events.push(NotificationEvent.SCHEDULE_CHANGED);
  }
  if (before.status === "AGENDADA" && after.status === "CANCELADA" && workflow(after).cancelReason === NO_SHOW_CANCEL_REASON) events.push(NotificationEvent.NO_SHOW);
  if (before.status !== "CANCELADA" && after.status === "CANCELADA" && workflow(after).cancelReason === REJECTED_CANCEL_REASON) events.push(NotificationEvent.REQUEST_REJECTED);
  if (after.status === "REALIZADA" && before.status !== "REALIZADA") events.push(NotificationEvent.COMPLETED);
  return events;
}
