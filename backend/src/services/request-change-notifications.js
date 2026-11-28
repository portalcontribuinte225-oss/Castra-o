import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../../shared/notification-contract.js";
import { ProcedureAction } from "../../../shared/request-procedure-contract.js";
import { RequestHistoryCategory } from "../../../shared/request-history-contract.js";
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

export function requestForProcedure(request, { procedure, animal }) {
  const schedule = procedure.schedule;
  const workflow = { ...request.workflow_data, scheduleSlotTime: schedule?.slotTime || "", scheduleTime: schedule?.slotTime || "" };
  return {
    ...request,
    animal_name: animal?.name || request.animal_name,
    species: animal?.species || request.species,
    schedule_date: schedule?.date || "",
    schedule_time: schedule?.slotTime || "",
    schedule_location_name: schedule?.locationName || "",
    schedule_address: schedule?.address || "",
    schedule_address_url: schedule?.addressUrl || "",
    workflow_data: workflow,
  };
}

function deliveries(before, after, action, outcomes) {
  if (!action) return selectNotificationEvents(before, after).map((event) => ({ event, request: after }));
  if (action === ProcedureAction.CONFIRM_SCHEDULE) return [{ event: NotificationEvent.SCHEDULE_CONFIRMED, request: after }];
  if (action === ProcedureAction.RESCHEDULE) return [{ event: NotificationEvent.SCHEDULE_CHANGED, request: after }];
  if (action === ProcedureAction.CLOSE) {
    return selectNotificationEvents(before, after).filter((event) => event === NotificationEvent.COMPLETED)
      .map((event) => ({ event, request: after }));
  }
  if (action !== ProcedureAction.NO_SHOW) return [];
  const visits = new Map();
  for (const outcome of outcomes) {
    const { date, occurrenceKey, slotTime } = outcome.procedure.schedule || {};
    const key = JSON.stringify([outcome.animalIndex, scheduleDate(date), occurrenceKey, slotTime]);
    visits.set(key, outcome);
  }
  return [...visits.values()].map((visit) => ({ event: NotificationEvent.NO_SHOW, request: requestForProcedure(after, visit) }));
}

// The operation was committed before the notices were sent. Return a delivery warning if recording the results fails.
export async function recordNotificationResults(results, request, { appendHistory }) {
  const entries = results.map((result) => ({
    status: request.status, by: "sistema", at: new Date(), category: RequestHistoryCategory.PROCESS,
    title: notificationEventLabels[result.event],
    notes: `${channelLabels[result.channel]}: ${deliveryLabels[result.status]}.${result.reason ? ` ${result.reason}` : ""}`,
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

export async function notifyRequestChanges(before, after, { appendHistory, dispatch = dispatchNotification, procedureAction, outcomes = [] }) {
  if (after.workflow_data?.followUp?.enabled !== true) return [];
  const results = [];
  for (const { event, request } of deliveries(before, after, procedureAction, outcomes)) {
    try {
      results.push(...await dispatch({ event, request }));
    } catch {
      results.push({ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED, reason: "Não foi possível preparar a notificação." });
    }
  }
  return recordNotificationResults(results, after, { appendHistory });
}
