import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../../shared/notification-contract.js";
import { ProcedureAction, ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { RequestStatus } from "../../../shared/request-contract.js";
import { scheduleDate } from "../../../shared/schedule-contract.js";
import { selectNotificationEvents } from "./notifications/notification-events.js";
import { dispatchNotification } from "./notifications/dispatch-notification.js";
import { notificationEventLabels } from "./notifications/notification-message.js";

const channelLabels = {
  [NotificationChannel.EMAIL]: "E-mail", [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.SMS]: "SMS",
};
const deliveryLabels = {
  [DeliveryStatus.SENT]: "aceito para envio", [DeliveryStatus.FAILED]: "falha no envio", [DeliveryStatus.SKIPPED]: "não enviado",
};
const agendaEvents = new Set([NotificationEvent.SCHEDULE_CONFIRMED, NotificationEvent.SCHEDULE_CHANGED]);
const procedureOutcomes = new Set([NotificationEvent.NO_SHOW, NotificationEvent.REQUEST_REJECTED]);

function scheduleSignature(schedule) {
  return JSON.stringify([scheduleDate(schedule?.date), schedule?.occurrenceKey, schedule?.slotTime, schedule?.locationName, schedule?.address, schedule?.addressUrl]);
}

function procedureEvents(events, { action, procedure, previousSchedule }) {
  // The aggregate status can close for a different reason than the procedure that triggered this change.
  const otherEvents = events.filter((event) => !agendaEvents.has(event) && !procedureOutcomes.has(event));
  if (action === ProcedureAction.CANCEL_SCHEDULE && procedure.status === ProcedureStatus.WAITING && previousSchedule) {
    return [NotificationEvent.SCHEDULE_CANCELLED, ...otherEvents];
  }
  if (action === ProcedureAction.NO_SHOW && procedure.status === ProcedureStatus.NO_SHOW) {
    return [NotificationEvent.NO_SHOW, ...otherEvents];
  }
  if (action === ProcedureAction.REJECT && procedure.status === ProcedureStatus.REJECTED) {
    return [NotificationEvent.REQUEST_REJECTED, ...otherEvents];
  }
  if (action === ProcedureAction.CONFIRM_SCHEDULE && events.includes(NotificationEvent.SCHEDULE_CONFIRMED)) {
    return [NotificationEvent.SCHEDULE_CONFIRMED, ...otherEvents];
  }
  if (action === ProcedureAction.RESCHEDULE && procedure.status === ProcedureStatus.SCHEDULED
    && scheduleSignature(previousSchedule) !== scheduleSignature(procedure.schedule)) {
    return [NotificationEvent.SCHEDULE_CHANGED, ...otherEvents];
  }
  return otherEvents;
}

export function requestForProcedure(request, event, { procedure, animal, previousSchedule }) {
  const schedule = event === NotificationEvent.SCHEDULE_CANCELLED ? previousSchedule : procedure.schedule;
  const workflow = { ...request.workflow_data, scheduleSlotTime: schedule?.slotTime || "", scheduleTime: schedule?.slotTime || "" };
  if (event === NotificationEvent.REQUEST_REJECTED) workflow.rejectionReason = procedure.rejection?.reason || "";
  return {
    ...request,
    animal_name: animal?.name || request.animal_name,
    species: animal?.species || request.species,
    schedule_date: schedule?.date || "",
    schedule_time: schedule?.slotTime || "",
    schedule_location_name: schedule?.locationName || "",
    schedule_address: schedule?.address || "",
    schedule_address_url: schedule?.addressUrl || "",
    ...(event === NotificationEvent.REQUEST_REJECTED && request.status !== RequestStatus.CANCELLED ? { procedure_name: procedure.name } : {}),
    workflow_data: workflow,
  };
}

// Each result becomes one entry of the request history. The request was committed already, so a history that cannot be written
// is reported with the results instead of failing: reporting the request as failed would invite duplicate submissions.
export async function recordNotificationResults(results, request, { appendHistory }) {
  const entries = results.map((result) => ({
    status: request.status, by: "sistema", at: new Date(),
    notes: `${notificationEventLabels[result.event]} — ${channelLabels[result.channel]}: ${deliveryLabels[result.status]}.${result.reason ? ` ${result.reason}` : ""}`,
    notification: result,
  }));
  if (entries.length) {
    try {
      await appendHistory(entries, request.id, request.municipality_id);
      request.history = [...(Array.isArray(request.history) ? request.history : []), ...entries];
    } catch {
      results.push({ channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED, reason: "Operação salva; histórico do envio indisponível." });
    }
  }
  return results;
}

export async function notifyRequestChanges(before, after, { appendHistory, dispatch = dispatchNotification, procedureChange = null }) {
  // Only a request whose tutor turned follow-up on is notified.
  if (after.workflow_data?.followUp?.enabled !== true) return [];
  const selected = selectNotificationEvents(before, after);
  const events = procedureChange ? procedureEvents(selected, procedureChange) : selected;
  const results = [];
  for (const event of events) {
    try {
      const request = procedureChange && (agendaEvents.has(event) || event === NotificationEvent.SCHEDULE_CANCELLED || procedureOutcomes.has(event))
        ? requestForProcedure(after, event, procedureChange) : after;
      results.push(...await dispatch({ event, request }));
    } catch {
      results.push({ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED, reason: "Não foi possível preparar a notificação." });
    }
  }
  return recordNotificationResults(results, after, { appendHistory });
}
