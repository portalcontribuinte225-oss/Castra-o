import { NotificationEvent } from "./notification-contract.js";
import { AuthPurpose } from "./auth-contract.js";

export const SmsUseKind = Object.freeze({ NOTICE: "notice", ACCESS: "access" });

function smsUse(key, kind, label, defaultActive = false) {
  return Object.freeze({ key, kind, label, defaultActive });
}

// A use is one message the system can send by SMS. Notice keys are NotificationEvent values and access keys are AuthPurpose
// values, so they never collide. E-mail confirmation and the initial password have no SMS use: the initial password is a
// secret that already shows on screen. Only password recovery starts on, as it already worked once the channel was active.
export const smsUses = Object.freeze([
  smsUse(NotificationEvent.SCHEDULE_CONFIRMED, SmsUseKind.NOTICE, "Agendamento confirmado"),
  smsUse(NotificationEvent.SCHEDULE_CHANGED, SmsUseKind.NOTICE, "Agendamento reagendado"),
  smsUse(NotificationEvent.NO_SHOW, SmsUseKind.NOTICE, "Não comparecimento"),
  smsUse(NotificationEvent.DOCUMENTS_REVIEWED, SmsUseKind.NOTICE, "Documentos analisados"),
  smsUse(NotificationEvent.COMPLETED, SmsUseKind.NOTICE, "Atendimento concluído"),
  smsUse(AuthPurpose.PASSWORD_RESET, SmsUseKind.ACCESS, "Recuperação de senha", true),
  smsUse(AuthPurpose.VERIFY_PHONE, SmsUseKind.ACCESS, "Confirmação de telefone"),
  smsUse(AuthPurpose.REQUEST_TRACKING, SmsUseKind.ACCESS, "Acompanhamento de solicitação"),
  smsUse(AuthPurpose.CONTACT_CHANGED, SmsUseKind.ACCESS, "Dados do solicitante alterados"),
]);

export function getSmsUse(key) {
  return smsUses.find((use) => use.key === key) || null;
}
