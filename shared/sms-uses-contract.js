import { NotificationEvent, NotificationLabel } from "./notification-contract.js";
import { AuthPurpose } from "./auth-contract.js";

export const SmsUseKind = Object.freeze({ NOTICE: "notice", ACCESS: "access" });

function smsUse(key, kind, defaultActive = false) {
  return Object.freeze({ key, kind, label: NotificationLabel[key], defaultActive });
}

// A use is one message the system can send by SMS. Notice keys are NotificationEvent values and access keys are AuthPurpose
// values, so they never collide. The titles and their order are the same in every channel; the confirmation code of SMS confirms
// a phone. Only password recovery starts on, as it already worked once the channel was active.
export const smsUses = Object.freeze([
  smsUse(NotificationEvent.REQUEST_REGISTERED, SmsUseKind.NOTICE),
  smsUse(NotificationEvent.SCHEDULE_CONFIRMED, SmsUseKind.NOTICE),
  smsUse(NotificationEvent.SCHEDULE_REMINDER, SmsUseKind.NOTICE),
  smsUse(NotificationEvent.SCHEDULE_CHANGED, SmsUseKind.NOTICE),
  smsUse(NotificationEvent.NO_SHOW, SmsUseKind.NOTICE),
  smsUse(NotificationEvent.COMPLETED, SmsUseKind.NOTICE),
  smsUse(NotificationEvent.REQUEST_REJECTED, SmsUseKind.NOTICE),
  smsUse(AuthPurpose.PASSWORD_RESET, SmsUseKind.ACCESS, true),
  smsUse(AuthPurpose.VERIFY_PHONE, SmsUseKind.ACCESS),
  smsUse(AuthPurpose.REQUEST_TRACKING, SmsUseKind.ACCESS),
  smsUse(AuthPurpose.CONTACT_CHANGED, SmsUseKind.ACCESS),
]);

export function getSmsUse(key) {
  return smsUses.find((use) => use.key === key) || null;
}
