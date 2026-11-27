import { NotificationEvent } from "./notification-contract.js";
import { AuthPurpose } from "./auth-contract.js";

export const SmsUseKind = Object.freeze({ NOTICE: "notice", ACCESS: "access" });

function smsUse(key, kind, label, defaultActive = false) {
  return Object.freeze({ key, kind, label, defaultActive });
}

// A use is one message the system can send by SMS. Notice keys are NotificationEvent values and access keys are AuthPurpose
// values, so they never collide. The titles and their order are the same in every channel; the confirmation code of SMS confirms
// a phone. Only password recovery starts on, as it already worked once the channel was active.
export const smsUses = Object.freeze([
  smsUse(NotificationEvent.REQUEST_REGISTERED, SmsUseKind.NOTICE, "Solicitação registrada"),
  smsUse(NotificationEvent.SCHEDULE_CONFIRMED, SmsUseKind.NOTICE, "Agendamento confirmado"),
  smsUse(NotificationEvent.SCHEDULE_REMINDER, SmsUseKind.NOTICE, "Lembrete de procedimento"),
  smsUse(NotificationEvent.SCHEDULE_CHANGED, SmsUseKind.NOTICE, "Agendamento alterado"),
  smsUse(NotificationEvent.SCHEDULE_CANCELLED, SmsUseKind.NOTICE, "Agendamento cancelado"),
  smsUse(NotificationEvent.NO_SHOW, SmsUseKind.NOTICE, "Não comparecimento"),
  smsUse(NotificationEvent.COMPLETED, SmsUseKind.NOTICE, "Atendimento concluído"),
  smsUse(NotificationEvent.REQUEST_REJECTED, SmsUseKind.NOTICE, "Solicitação indeferida"),
  smsUse(AuthPurpose.PASSWORD_RESET, SmsUseKind.ACCESS, "Recuperação de senha", true),
  smsUse(AuthPurpose.VERIFY_PHONE, SmsUseKind.ACCESS, "Confirmação de contato"),
  smsUse(AuthPurpose.REQUEST_TRACKING, SmsUseKind.ACCESS, "Acesso à solicitação"),
  smsUse(AuthPurpose.CONTACT_CHANGED, SmsUseKind.ACCESS, "Contato alterado"),
]);

export function getSmsUse(key) {
  return smsUses.find((use) => use.key === key) || null;
}
