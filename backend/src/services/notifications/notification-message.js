import { NotificationEvent, rejectionReasonText } from "../../../../shared/notification-contract.js";

export const notificationEventLabels = Object.freeze({
  [NotificationEvent.REQUEST_REGISTERED]: "Solicitação registrada",
  [NotificationEvent.SCHEDULE_CONFIRMED]: "Agendamento confirmado",
  [NotificationEvent.SCHEDULE_CHANGED]: "Agendamento alterado",
  [NotificationEvent.NO_SHOW]: "Não comparecimento",
  [NotificationEvent.DOCUMENTS_REVIEWED]: "Documentos conferidos",
  [NotificationEvent.COMPLETED]: "Atendimento concluído",
  [NotificationEvent.REQUEST_REJECTED]: "Solicitação indeferida",
});

export function formatScheduleDate(rawDate = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate.split("-").reverse().join("/") : rawDate || "data a confirmar";
}

// "Solicitação registrada! Protocolo X. Atendimento em 20/11/2026, às 09:00, em Unidade. Sua solicitação está em análise. Para ver…":
// the visit only when the request has one, and the link only when the request has it (a tutor and the public address of the system).
export function registeredNoticeText(request) {
  const workflow = request.workflow_data || request.workflowData || {};
  const time = workflow.scheduleSlotTime || workflow.scheduleTime || "";
  const place = request.schedule_location_name || "";
  const visit = request.schedule_date
    ? ` Atendimento em ${formatScheduleDate(request.schedule_date)}${time ? `, às ${time}` : ""}${place ? `, em ${place}` : ""}.` : "";
  const link = request.access_link?.url || "";
  const access = link
    ? ` ${request.access_link.accountExists ? "Para ver seu requerimento" : "Para ver seu requerimento e criar sua senha"}, acesse: ${link}` : "";
  return `Solicitação registrada! Protocolo ${String(request.protocol || "")}.${visit} Sua solicitação está em análise.${access}`;
}

export function buildNotificationMessage(event, request) {
  if (event === NotificationEvent.REQUEST_REGISTERED) return { subject: notificationEventLabels[event], message: registeredNoticeText(request) };
  const protocol = String(request.protocol || "");
  const workflow = request.workflow_data || request.workflowData || {};
  const date = formatScheduleDate(request.schedule_date || "");
  const time = workflow.scheduleSlotTime || workflow.scheduleTime || "";
  const location = [request.schedule_location_name, request.schedule_address].filter(Boolean).join(" — ");
  const schedule = [NotificationEvent.SCHEDULE_CONFIRMED, NotificationEvent.SCHEDULE_CHANGED, NotificationEvent.NO_SHOW].includes(event);
  const documents = Array.isArray(request.documents) ? request.documents : [];
  const approved = documents.filter((document) => document?.status === "approved").length;
  const rejected = documents.filter((document) => document?.status === "rejected").length;
  const reason = rejectionReasonText(workflow);
  const isRejection = event === NotificationEvent.REQUEST_REJECTED;
  const corrections = documents.filter((document) => document?.status === "rejected" && document.review?.note)
    .map((document) => ` ${document.documentName || "Documento"}: ${document.review.note}.`).join("");
  const documentSummary = event === NotificationEvent.DOCUMENTS_REVIEWED
    ? ` Aprovados: ${approved}. Precisam de correção: ${rejected}.${corrections}` : "";
  const rejectionSummary = isRejection && reason ? ` Motivo: ${reason}.` : "";
  return {
    subject: notificationEventLabels[event] || "Atualização da solicitação",
    message: schedule
      ? `Solicitação ${protocol}: ${notificationEventLabels[event].toLowerCase()}. Data: ${date}${time ? `, ${time}` : ""}${location ? `. Local: ${location}` : ""}.`
      : `Solicitação ${protocol}: ${isRejection ? "indeferida" : notificationEventLabels[event] || "há uma atualização"}.${documentSummary}${rejectionSummary} Para mais informações, procure o atendimento do município.`,
  };
}
