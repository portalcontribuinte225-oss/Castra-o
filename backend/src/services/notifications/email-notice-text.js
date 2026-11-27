import { NotificationEvent, rejectionReasonText } from "../../../../shared/notification-contract.js";
import { getEmailUse } from "../../../../shared/email-uses-contract.js";
import { formatScheduleDate, registeredNoticeText } from "./notification-message.js";

// "20/11/2026, às 09:00, na Unidade": the time and the place come only when the request has them.
function visit(request) {
  const workflow = request.workflow_data || request.workflowData || {};
  const time = workflow.scheduleSlotTime || workflow.scheduleTime || request.schedule_slot_time || request.schedule_time || "";
  const place = request.schedule_location_name || "";
  return `${formatScheduleDate(request.schedule_date || "")}${time ? `, às ${time}` : ""}${place ? `, na ${place}` : ""}`;
}

const texts = Object.freeze({
  [NotificationEvent.REQUEST_REGISTERED]: (request) => registeredNoticeText(request),
  [NotificationEvent.SCHEDULE_CONFIRMED]: (request, protocol) => `Seu agendamento foi confirmado! Esperamos você no dia ${visit(request)}. Protocolo: ${protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (request, protocol) => `Seu atendimento foi reagendado para o dia ${visit(request)}. Protocolo: ${protocol}.`,
  [NotificationEvent.SCHEDULE_CANCELLED]: (request, protocol) => `O agendamento do dia ${visit(request)} foi cancelado. Protocolo ${protocol}.`,
  [NotificationEvent.NO_SHOW]: (request, protocol) => `Identificamos que você não compareceu ao atendimento agendado para o dia ${formatScheduleDate(request.schedule_date || "")}. Para mais informações, entre em contato com nossa equipe. Protocolo: ${protocol}.`,
  [NotificationEvent.REQUEST_REJECTED]: (request, protocol) => {
    const reason = rejectionReasonText(request.workflow_data || request.workflowData);
    const outcome = request.procedure_name ? `O procedimento ${request.procedure_name} foi indeferido.` : "Sua solicitação foi indeferida.";
    return `${outcome}${reason ? ` Motivo: ${reason}.` : ""} Para mais informações, entre em contato com nossa equipe. Protocolo: ${protocol}.`;
  },
  [NotificationEvent.COMPLETED]: (_request, protocol) => `Seu atendimento foi concluído com sucesso! Agradecemos sua participação e o cuidado com seu animal. Protocolo: ${protocol}.`,
});

// The subject and the full text of the e-mail of one notice. The text is the complete message, so a template that only prints
// {{message}} is already right.
export function buildEmailNotice(event, request) {
  const protocol = String(request.protocol || "");
  return {
    subject: event === NotificationEvent.REQUEST_REJECTED && request.procedure_name
      ? "Procedimento indeferido" : getEmailUse(event)?.label || "Atualização da solicitação",
    message: texts[event]?.(request, protocol) || `Solicitação ${protocol}: há uma atualização.`,
  };
}
