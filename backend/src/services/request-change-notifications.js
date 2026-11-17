import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../../shared/notification-contract.js";
import { selectNotificationEvents } from "./notifications/notification-events.js";
import { dispatchNotification } from "./notifications/dispatch-notification.js";
import { notificationEventLabels } from "./notifications/notification-message.js";

const channelLabels = {
  [NotificationChannel.EMAIL]: "E-mail", [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.SMS]: "SMS",
};
const deliveryLabels = {
  [DeliveryStatus.SENT]: "aceito para envio", [DeliveryStatus.FAILED]: "falha no envio", [DeliveryStatus.SKIPPED]: "não enviado",
};

// Each result becomes one entry of the request history. The request was committed already, so a history that cannot be written
// is reported with the results instead of failing: reporting the request as failed would invite duplicate submissions.
export async function recordNotificationResults(results, request, { appendHistory, failureChannel = NotificationChannel.EMAIL }) {
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
      results.push({ channel: failureChannel, status: DeliveryStatus.FAILED, reason: "Operação salva; histórico do envio indisponível." });
    }
  }
  return results;
}

export async function notifyRequestChanges(before, after, { appendHistory, dispatch = dispatchNotification }) {
  const legacy = after.workflow_data?.followUp === undefined;
  const failureChannel = legacy ? NotificationChannel.WHATSAPP : NotificationChannel.EMAIL;
  if (after.workflow_data?.followUp?.enabled === false) return [];
  const events = selectNotificationEvents(before, after).filter((event) => !legacy
    || event === NotificationEvent.SCHEDULE_CONFIRMED || event === NotificationEvent.SCHEDULE_CHANGED);
  const results = [];
  for (const event of events) {
    try {
      results.push(...await dispatch({ event, request: after, legacy }));
    } catch {
      results.push({ event, channel: failureChannel, status: DeliveryStatus.FAILED, reason: "Não foi possível preparar a notificação." });
    }
  }
  return recordNotificationResults(results, after, { appendHistory, failureChannel });
}
