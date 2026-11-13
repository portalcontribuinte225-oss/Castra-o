import { NotificationEvent } from "../../../../shared/notification-contract.js";

export const notificationEventLabels = Object.freeze({
  [NotificationEvent.SCHEDULE_CONFIRMED]: "Agendamento confirmado",
  [NotificationEvent.SCHEDULE_CHANGED]: "Agendamento alterado",
  [NotificationEvent.DOCUMENTS_REVIEWED]: "Documentos conferidos",
  [NotificationEvent.COMPLETED]: "Atendimento concluído",
});

export function buildNotificationMessage(event, request) {
  const protocol = String(request.protocol || "");
  const workflow = request.workflow_data || request.workflowData || {};
  const rawDate = request.schedule_date || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate.split("-").reverse().join("/") : rawDate || "data a confirmar";
  const time = workflow.scheduleSlotTime || workflow.scheduleTime || "";
  const location = [request.schedule_location_name, request.schedule_address].filter(Boolean).join(" — ");
  const schedule = event === NotificationEvent.SCHEDULE_CONFIRMED || event === NotificationEvent.SCHEDULE_CHANGED;
  const documents = Array.isArray(request.documents) ? request.documents : [];
  const approved = documents.filter((document) => document?.status === "approved").length;
  const rejected = documents.filter((document) => document?.status === "rejected").length;
  const documentSummary = event === NotificationEvent.DOCUMENTS_REVIEWED
    ? ` Aprovados: ${approved}. Precisam de correção: ${rejected}.` : "";
  return {
    subject: notificationEventLabels[event] || "Atualização da solicitação",
    message: schedule
      ? `Solicitação ${protocol}: ${notificationEventLabels[event].toLowerCase()}. Data: ${date}${time ? `, ${time}` : ""}${location ? `. Local: ${location}` : ""}.`
      : `Solicitação ${protocol}: ${notificationEventLabels[event] || "há uma atualização"}.${documentSummary} Para mais informações, procure o atendimento do município.`,
  };
}
