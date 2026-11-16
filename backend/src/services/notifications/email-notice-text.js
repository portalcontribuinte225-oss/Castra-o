import { DocumentsOutcome, NotificationEvent, documentsOutcome } from "../../../../shared/notification-contract.js";
import { EmailVariable, getEmailUse } from "../../../../shared/email-uses-contract.js";
import { formatScheduleDate } from "./notification-message.js";

// "20/11/2026, às 09:00, na Unidade": the time and the place come only when the request has them.
function visit(request) {
  const workflow = request.workflow_data || request.workflowData || {};
  const time = workflow.scheduleSlotTime || workflow.scheduleTime || "";
  const place = request.schedule_location_name || "";
  return `${formatScheduleDate(request.schedule_date || "")}${time ? `, às ${time}` : ""}${place ? `, na ${place}` : ""}`;
}

const documentsTexts = Object.freeze({
  [DocumentsOutcome.APPROVED]: (protocol) => `Boas notícias! Seus documentos foram analisados e aprovados. Sua solicitação seguirá para as próximas etapas. Protocolo: ${protocol}.`,
  [DocumentsOutcome.REJECTED]: (protocol) => `Seus documentos foram analisados, mas não puderam ser aprovados. Acesse sua solicitação para consultar o motivo e as orientações. Protocolo: ${protocol}.`,
});

const texts = Object.freeze({
  [NotificationEvent.SCHEDULE_CONFIRMED]: (request, protocol) => `Seu agendamento para castração foi confirmado! Esperamos você no dia ${visit(request)}. Protocolo: ${protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (request, protocol) => `A data do seu agendamento para castração sofreu uma alteração. Seu atendimento foi reagendado para o dia ${visit(request)}. Protocolo: ${protocol}.`,
  [NotificationEvent.NO_SHOW]: (request, protocol) => `Identificamos que você não compareceu ao agendamento de castração do dia ${formatScheduleDate(request.schedule_date || "")}. Para mais informações, entre em contato com nossa equipe. Protocolo: ${protocol}.`,
  [NotificationEvent.DOCUMENTS_REVIEWED]: (request, protocol) => documentsTexts[documentsOutcome(request.documents)](protocol),
  [NotificationEvent.COMPLETED]: (_request, protocol) => `Seu atendimento de castração foi concluído com sucesso! Agradecemos sua participação e o cuidado com seu animal. Protocolo: ${protocol}.`,
});

// The subject, the full text and the variables that depend on the outcome, for the e-mail of one notice. The text is the
// complete message, so a template that only prints {{message}} is already right.
export function buildEmailNotice(event, request) {
  const protocol = String(request.protocol || "");
  return {
    subject: getEmailUse(event)?.label || "Atualização da solicitação",
    message: texts[event]?.(request, protocol) || `Solicitação ${protocol}: há uma atualização.`,
    ...(event === NotificationEvent.DOCUMENTS_REVIEWED ? { [EmailVariable.DOCUMENTS_RESULT]: documentsOutcome(request.documents) } : {}),
  };
}
