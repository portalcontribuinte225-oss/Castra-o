import { AuthPurpose } from "./auth-contract.js";
import { NotificationEvent } from "./notification-contract.js";

// One SMS holds 160 characters of the basic alphabet; a single accented letter would push it into a 70-character encoding.
export const SMS_MAX_LENGTH = 160;

const MAX_MUNICIPALITY = 30;
const MAX_PROTOCOL = 20;
const MAX_DATE = 16;
const MAX_TIME = 16;
const MAX_MINUTES = 3;
const MAX_LOCATION = 60;
const PLACE_SEPARATOR = ", ";

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

// The texts are fixed. `place` is the schedule location already prefixed with its separator, or empty.
const templates = Object.freeze({
  [NotificationEvent.SCHEDULE_CONFIRMED]: (d) => `${d.town}: castracao agendada em ${d.date} as ${d.time}${d.place}. Protocolo ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (d) => `${d.town}: seu agendamento mudou para ${d.date} as ${d.time}${d.place}. Protocolo ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CANCELLED]: (d) => `${d.town}: o agendamento de ${d.date} as ${d.time} foi cancelado. Protocolo ${d.protocol}.`,
  [NotificationEvent.DOCUMENTS_REVIEWED]: (d) => `${d.town}: seus documentos foram conferidos. Veja o resultado com o protocolo ${d.protocol}.`,
  [NotificationEvent.COMPLETED]: (d) => `${d.town}: atendimento concluido. Protocolo ${d.protocol}.`,
  [AuthPurpose.PASSWORD_RESET]: (d) => `${d.town}: seu codigo e ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.VERIFY_PHONE]: (d) => `${d.town}: codigo para confirmar seu telefone: ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.REQUEST_TRACKING]: (d) => `${d.town}: codigo para acompanhar a solicitacao: ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.CONTACT_CHANGED]: (d) => `${d.town}: o contato de acesso da sua conta foi alterado. Se nao foi voce, procure o atendimento.`,
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
  };
  const room = SMS_MAX_LENGTH - template({ ...fields, place: "" }).length - PLACE_SEPARATOR.length;
  const location = room > 0 ? clip(data.location, MAX_LOCATION).slice(0, room).trim() : "";
  return toSmsText(template({ ...fields, place: location ? `${PLACE_SEPARATOR}${location}` : "" }));
}

// The sample the screen shows next to each use.
export function smsExample(use, municipality = "Municipio") {
  return buildSmsText(use, {
    municipality, protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Veterinaria Municipal", code: "123456", minutes: "10",
  });
}
