import { AuthPurpose } from "./auth-contract.js";
import { DocumentsOutcome, NotificationEvent } from "./notification-contract.js";

// One SMS holds 160 characters of the basic alphabet; a single accented letter would push it into a 70-character encoding.
export const SMS_MAX_LENGTH = 160;

const MAX_MUNICIPALITY = 30;
const MAX_PROTOCOL = 20;
const MAX_DATE = 16;
const MAX_TIME = 16;
const MAX_MINUTES = 3;
const MAX_LOCATION = 60;
const MAX_FIELDS = 40;
const PLACE_SEPARATOR = " na ";

// Keeps only plain ASCII characters that the basic SMS alphabet has too; everything else becomes a space.
export function toSmsText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const clip = (value, max) => toSmsText(value).slice(0, max).trim();

// The texts are fixed, shortened from the full messages so each fits in one SMS. `place` is the schedule location already
// prefixed with its separator, or empty. The analysis of the documents has one text for each outcome.
const documentsTexts = Object.freeze({
  [DocumentsOutcome.APPROVED]: (d) => `${d.town}: seus documentos foram aprovados e a solicitacao segue para as proximas etapas. Protocolo: ${d.protocol}.`,
  [DocumentsOutcome.REJECTED]: (d) => `${d.town}: seus documentos nao foram aprovados. Acesse a solicitacao para ver o motivo. Protocolo: ${d.protocol}.`,
});

const templates = Object.freeze({
  [NotificationEvent.SCHEDULE_CONFIRMED]: (d) => `${d.town}: castracao confirmada! Esperamos voce em ${d.date}, as ${d.time}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (d) => `${d.town}: seu atendimento foi reagendado para ${d.date}, as ${d.time}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.NO_SHOW]: (d) => `${d.town}: voce nao compareceu ao agendamento de castracao de ${d.date}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [NotificationEvent.DOCUMENTS_REVIEWED]: (d) => documentsTexts[d.outcome](d),
  [NotificationEvent.COMPLETED]: (d) => `${d.town}: atendimento de castracao concluido! Obrigado pelo cuidado com seu animal. Protocolo: ${d.protocol}.`,
  [AuthPurpose.PASSWORD_RESET]: (d) => `${d.town}: recebemos um pedido para redefinir sua senha. Codigo: ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.VERIFY_PHONE]: (d) => `${d.town}: para confirmar seu telefone, informe o codigo ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.REQUEST_TRACKING]: (d) => `${d.town}: para consultar sua solicitacao, use o codigo ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.CONTACT_CHANGED]: (d) => `${d.town}: seus dados foram atualizados (${d.fields}). Se nao foi voce, fale com nossa equipe.`,
});

// Builds the text of one use. Every field is bounded and the location takes whatever room is left, so the result always fits
// in one SMS. An unknown use yields an empty text, which the sender refuses.
export function buildSmsText(use, data = {}) {
  const template = templates[use];
  if (!template) return "";
  const fields = {
    town: clip(data.municipality, MAX_MUNICIPALITY) || "Prefeitura",
    protocol: clip(data.protocol, MAX_PROTOCOL),
    date: clip(data.date, MAX_DATE),
    time: clip(data.time, MAX_TIME),
    code: toSmsText(data.code),
    minutes: clip(data.minutes, MAX_MINUTES),
    fields: clip(data.fields, MAX_FIELDS) || "contato",
    outcome: data.outcome === DocumentsOutcome.REJECTED ? DocumentsOutcome.REJECTED : DocumentsOutcome.APPROVED,
  };
  const room = SMS_MAX_LENGTH - template({ ...fields, place: "" }).length - PLACE_SEPARATOR.length;
  const location = room > 0 ? clip(data.location, MAX_LOCATION).slice(0, room).trim() : "";
  return toSmsText(template({ ...fields, place: location ? `${PLACE_SEPARATOR}${location}` : "" }));
}

// The fixed text of the test the administrator sends from the screen to a phone of their choice.
export function buildSmsTestText(municipality) {
  const town = clip(municipality, MAX_MUNICIPALITY) || "Prefeitura";
  return toSmsText(`${town}: teste de envio de SMS do sistema de castracao. Se voce recebeu esta mensagem, o envio esta funcionando.`);
}

// The samples the screen shows next to each use: one text, or one for each outcome when the text depends on it.
export function smsExamples(use, municipality = "Municipio") {
  const data = {
    municipality, protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Veterinaria Municipal", code: "123456", minutes: "10", fields: "e-mail",
  };
  const outcomes = use === NotificationEvent.DOCUMENTS_REVIEWED ? Object.values(DocumentsOutcome) : [DocumentsOutcome.APPROVED];
  return outcomes.map((outcome) => buildSmsText(use, { ...data, outcome }));
}
