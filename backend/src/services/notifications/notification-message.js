import { NotificationEvent, NotificationLabel, rejectionReasonText } from "../../../../shared/notification-contract.js";
import { RequestStatus } from "../../../../shared/request-contract.js";
import { displayScheduleDate } from "../../../../shared/schedule-contract.js";
import { WhatsappTemplateField } from "../../../../shared/whatsapp-templates-contract.js";

export function notificationSchedule(request) {
  const workflow = request.workflow_data || request.workflowData || {};
  return {
    date: displayScheduleDate(request.schedule_date || request.preferredSchedule || request.appointment),
    time: workflow.scheduleSlotTime || workflow.scheduleTime || request.schedule_slot_time || request.schedule_time || request.scheduleSlotTime || request.scheduleTime || "",
    location: request.schedule_location_name || request.scheduleLocationName || "",
  };
}

// Template fields only expose the request details that are safe to include in a notice.
export function resolveNoticeField(field, request) {
  const { date, time, location } = notificationSchedule(request);
  const values = {
    [WhatsappTemplateField.TUTOR_NAME]: request.tutor_name || "Solicitante",
    [WhatsappTemplateField.PROTOCOL]: request.protocol,
    [WhatsappTemplateField.SCHEDULE_DATE]: date || "data a confirmar",
    [WhatsappTemplateField.SCHEDULE_TIME]: time || "hora a confirmar",
    [WhatsappTemplateField.SCHEDULE_LOCATION_NAME]: location || "local a confirmar",
    [WhatsappTemplateField.SCHEDULE_ADDRESS]: request.schedule_address || request.scheduleAddress || "endereço a confirmar",
    [WhatsappTemplateField.SCHEDULE_ADDRESS_URL]: request.schedule_address_url || request.scheduleAddressUrl || "link indisponível",
    [WhatsappTemplateField.ANIMAL_NAME]: request.animal_name || "animal",
    [WhatsappTemplateField.SPECIES]: request.species || "espécie não informada",
    [WhatsappTemplateField.CITY]: request.city || request.schedule_municipality || "município não informado",
    [WhatsappTemplateField.NOTIFICATION_MESSAGE]: request.notification_message || "Há uma atualização na solicitação.",
  };
  return Object.hasOwn(values, field) ? String(values[field] ?? "") : "";
}

function visit({ date, time, location }) {
  return `${date ? ` em ${date}` : ""}${time ? `${date ? "," : ""} às ${time}` : ""}${location ? `${date || time ? "," : ""} em ${location}` : ""}`;
}

function registeredNoticeText(request, protocol) {
  const schedule = visit(notificationSchedule(request));
  const confirmed = request.status === RequestStatus.SCHEDULED;
  const appointment = schedule ? ` ${confirmed ? "Agendamento confirmado" : "Horário solicitado"}${schedule}.` : "";
  const review = confirmed ? "" : " Sua solicitação está em análise.";
  const link = request.access_link?.url;
  const access = link
    ? ` ${request.access_link.accountExists ? "Para ver seu requerimento" : "Para ver seu requerimento e criar sua senha"}, acesse: ${link}` : "";
  return `Solicitação registrada. Protocolo: ${protocol}.${appointment}${review}${access}`;
}

const texts = Object.freeze({
  [NotificationEvent.REQUEST_REGISTERED]: registeredNoticeText,
  [NotificationEvent.SCHEDULE_CONFIRMED]: (request, protocol) => `Seu agendamento foi confirmado${visit(notificationSchedule(request))}. Protocolo: ${protocol}.`,
  [NotificationEvent.SCHEDULE_REMINDER]: (request, protocol) => `Lembrete do seu atendimento de amanhã${visit(notificationSchedule(request))}. Siga as orientações da equipe. Protocolo: ${protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (request, protocol) => `Seu agendamento foi alterado${visit(notificationSchedule(request))}. Protocolo: ${protocol}.`,
  [NotificationEvent.NO_SHOW]: (request, protocol) => `Registramos não comparecimento no atendimento${visit(notificationSchedule(request))}. Para mais informações, fale com nossa equipe. Protocolo: ${protocol}.`,
  [NotificationEvent.COMPLETED]: (_request, protocol) => `Seu atendimento foi concluído. Protocolo: ${protocol}.`,
  [NotificationEvent.REQUEST_REJECTED]: (request, protocol) => {
    const reason = rejectionReasonText(request.workflow_data || request.workflowData);
    return `Sua solicitação foi indeferida.${reason ? ` Motivo: ${reason}.` : ""} Para mais informações, fale com nossa equipe. Protocolo: ${protocol}.`;
  },
});

// E-mail and WhatsApp templates with a message variable receive the same complete notice.
export function buildNotificationMessage(event, request) {
  const protocol = String(request.protocol || "");
  return {
    subject: NotificationLabel[event] || "Atualização da solicitação",
    message: texts[event]?.(request, protocol) || `Há uma atualização na solicitação. Protocolo: ${protocol}.`,
  };
}
