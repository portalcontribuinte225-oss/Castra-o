import { NotificationEvent } from "./notification-contract.js";
import { AuthPurpose } from "./auth-contract.js";
import { WhatsappTemplateField } from "./whatsapp-templates-contract.js";

export const EmailUseKind = Object.freeze({ NOTICE: "notice", ACCESS: "access" });

// Names of the variables an EmailJS template can use. Existing Portuguese names stay, so templates already built keep working.
export const EmailVariable = Object.freeze({
  TO_EMAIL: "to_email",
  TO_NAME: "to_name",
  MUNICIPALITY_NAME: "municipality_name",
  MUNICIPALITY_BRASAO_URL: "municipality_brasao_url",
  DEPARTMENT_NAME: "department_name",
  DEPARTMENT_LOGO_URL: "department_logo_url",
  MUNICIPALITY_CONTACT: "municipality_contact",
  MUNICIPALITY_EMAIL: "municipality_email",
  MUNICIPALITY_ADDRESS: "municipality_address",
  PROTOCOL: "protocol",
  EVENT: "event",
  SUBJECT: "subject",
  MESSAGE: "message",
  CODE: "code",
  RECOVERY_CODE: "codigo_recuperacao",
  VALIDITY: "validade",
  VALIDITY_MINUTES: "validity_minutes",
  PURPOSE: "purpose",
  // The data that changed, such as "e-mail" or "telefone".
  CHANGED_FIELDS: "changed_fields",
});

// The identity of the municipality that sends the message; empty when there is no municipality (platform staff).
export const EMAIL_IDENTITY_VARIABLES = Object.freeze([
  EmailVariable.MUNICIPALITY_NAME, EmailVariable.MUNICIPALITY_BRASAO_URL, EmailVariable.DEPARTMENT_NAME, EmailVariable.DEPARTMENT_LOGO_URL,
  EmailVariable.MUNICIPALITY_CONTACT, EmailVariable.MUNICIPALITY_EMAIL, EmailVariable.MUNICIPALITY_ADDRESS,
]);

const variable = EmailVariable;
const field = WhatsappTemplateField;
const commonVariables = [variable.TO_EMAIL, variable.TO_NAME, ...EMAIL_IDENTITY_VARIABLES];
const noticeVariables = [variable.PROTOCOL, variable.EVENT, variable.SUBJECT, variable.MESSAGE];
// Request fields the agenda notices carry; they are resolved by the same safe whitelist WhatsApp uses.
const scheduleFields = [field.SCHEDULE_DATE, field.SCHEDULE_TIME, field.SCHEDULE_LOCATION_NAME, field.SCHEDULE_ADDRESS];
const noShowFields = [field.SCHEDULE_DATE, field.SCHEDULE_TIME, field.SCHEDULE_LOCATION_NAME];
const codeVariables = [variable.CODE, variable.RECOVERY_CODE, variable.VALIDITY, variable.VALIDITY_MINUTES, variable.PURPOSE];

function emailUse(key, kind, label, { variables = [], requestFields = [], defaultActive = false } = {}) {
  return Object.freeze({
    key, kind, label, defaultActive,
    requestFields: Object.freeze([...requestFields]),
    variables: Object.freeze([...commonVariables, ...variables, ...requestFields]),
  });
}

// A use is one message the system can send by e-mail. Notice keys are NotificationEvent values and access keys are
// AuthPurpose values, so they never collide. The titles and their order are the same in every channel; the confirmation code of
// e-mail confirms an e-mail. Only password recovery starts on.
export const emailUses = Object.freeze([
  emailUse(NotificationEvent.REQUEST_REGISTERED, EmailUseKind.NOTICE, "Solicitação registrada", { variables: noticeVariables }),
  emailUse(NotificationEvent.SCHEDULE_CONFIRMED, EmailUseKind.NOTICE, "Agendamento confirmado", { variables: noticeVariables, requestFields: scheduleFields }),
  emailUse(NotificationEvent.SCHEDULE_REMINDER, EmailUseKind.NOTICE, "Lembrete de procedimento", { variables: noticeVariables, requestFields: scheduleFields }),
  emailUse(NotificationEvent.SCHEDULE_CHANGED, EmailUseKind.NOTICE, "Agendamento alterado", { variables: noticeVariables, requestFields: scheduleFields }),
  emailUse(NotificationEvent.SCHEDULE_CANCELLED, EmailUseKind.NOTICE, "Agendamento cancelado", { variables: noticeVariables, requestFields: scheduleFields }),
  emailUse(NotificationEvent.NO_SHOW, EmailUseKind.NOTICE, "Não comparecimento", { variables: noticeVariables, requestFields: noShowFields }),
  emailUse(NotificationEvent.COMPLETED, EmailUseKind.NOTICE, "Atendimento concluído", { variables: noticeVariables }),
  emailUse(NotificationEvent.REQUEST_REJECTED, EmailUseKind.NOTICE, "Solicitação indeferida", { variables: noticeVariables }),
  emailUse(AuthPurpose.PASSWORD_RESET, EmailUseKind.ACCESS, "Recuperação de senha", { variables: codeVariables, defaultActive: true }),
  emailUse(AuthPurpose.VERIFY_EMAIL, EmailUseKind.ACCESS, "Confirmação de contato", { variables: codeVariables }),
  emailUse(AuthPurpose.REQUEST_TRACKING, EmailUseKind.ACCESS, "Acesso à solicitação", { variables: codeVariables }),
  emailUse(AuthPurpose.CONTACT_CHANGED, EmailUseKind.ACCESS, "Contato alterado", { variables: [variable.CHANGED_FIELDS, variable.MESSAGE, variable.PURPOSE] }),
]);

export function getEmailUse(key) {
  return emailUses.find((use) => use.key === key) || null;
}
