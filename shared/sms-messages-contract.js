import { AuthPurpose } from "./auth-contract.js";
import { NotificationEvent } from "./notification-contract.js";

// The texts carry accents, so they go in the Unicode encoding of SMS: one SMS holds 70 characters, and a longer text goes in parts
// of 67 characters, each charged by the provider.
export const SMS_SINGLE_LENGTH = 70;
export const SMS_PART_LENGTH = 67;
// The longest text the system sends: three parts.
export const SMS_MAX_LENGTH = SMS_PART_LENGTH * 3;

const MAX_MUNICIPALITY = 30;
const MAX_PROTOCOL = 20;
const MAX_DATE = 16;
const MAX_TIME = 16;
const MAX_MINUTES = 3;
const MAX_LOCATION = 60;
const MAX_FIELDS = 40;
const MAX_REASON = 40;
const PLACE_SEPARATOR = " na ";
const REASON_WRAP = " ()";
const NOT_SMS_CHARACTER = /[^\p{L}\p{N} !"#$%&'()*+,\-./:;<=>?@_]/gu;

// Keeps letters (accents included), digits and the usual punctuation; anything else (line breaks, symbols, emoji) becomes a space.
export function toSmsText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(NOT_SMS_CHARACTER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A text the sender accepts: one that toSmsText keeps as it is, within the longest length.
export function isSmsText(text) {
  return typeof text === "string" && text !== "" && text.length <= SMS_MAX_LENGTH && toSmsText(text) === text;
}

const clip = (value, max) => toSmsText(value).slice(0, max).trim();

// The texts are fixed. `place` is the schedule location already prefixed with its separator, or empty; `cause` is the reason of a
// rejection already in parentheses, or empty.
const templates = Object.freeze({
  [NotificationEvent.REQUEST_REGISTERED]: (d) => `${d.town}: solicitação registrada! Protocolo: ${d.protocol}. Aguardando aprovação!`,
  [NotificationEvent.SCHEDULE_CONFIRMED]: (d) => `${d.town}: agendamento confirmado! Esperamos você em ${d.date}, às ${d.time}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (d) => `${d.town}: seu atendimento foi reagendado para ${d.date}, às ${d.time}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CANCELLED]: (d) => `${d.town}: o agendamento de ${d.date}${d.time ? `, às ${d.time},` : ""} foi cancelado. Protocolo: ${d.protocol}.`,
  [NotificationEvent.NO_SHOW]: (d) => `${d.town}: você não compareceu ao atendimento de ${d.date}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [NotificationEvent.COMPLETED]: (d) => `${d.town}: atendimento concluído! Obrigado pelo cuidado com seu animal. Protocolo: ${d.protocol}.`,
  [NotificationEvent.REQUEST_REJECTED]: (d) => d.procedure ? `${d.town}: o procedimento ${d.procedure} foi indeferido${d.cause}. Protocolo: ${d.protocol}.`
    : `${d.town}: sua solicitação foi indeferida${d.cause}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [AuthPurpose.PASSWORD_RESET]: (d) => `${d.town}: recebemos um pedido para redefinir sua senha. Código: ${d.code}. Válido por ${d.minutes} minutos. Não compartilhe.`,
  [AuthPurpose.VERIFY_PHONE]: (d) => `${d.town}: para confirmar seu telefone, informe o código ${d.code}. Válido por ${d.minutes} minutos. Não compartilhe.`,
  [AuthPurpose.REQUEST_TRACKING]: (d) => `${d.town}: para consultar sua solicitação, use o código ${d.code}. Válido por ${d.minutes} minutos. Não compartilhe.`,
  [AuthPurpose.CONTACT_CHANGED]: (d) => `${d.town}: seus dados foram atualizados (${d.fields}). Se não foi você, fale com nossa equipe.`,
});

// Builds the text of one use. Every field is bounded, and the location and the reason take only the room that is left, so the result
// never passes the longest length. An unknown use yields an empty text, which the sender refuses.
export function buildSmsText(use, data = {}) {
  const template = templates[use];
  if (!template) return "";
  const fields = {
    town: clip(data.municipality, MAX_MUNICIPALITY) || "Prefeitura",
    protocol: clip(data.protocol, MAX_PROTOCOL),
    date: clip(data.date, MAX_DATE),
    time: clip(data.time, MAX_TIME),
    procedure: clip(data.procedure, MAX_FIELDS),
    code: toSmsText(data.code),
    minutes: clip(data.minutes, MAX_MINUTES),
    fields: clip(data.fields, MAX_FIELDS) || "contato",
  };
  const bare = template({ ...fields, place: "", cause: "" }).length;
  const room = (separatorLength) => SMS_MAX_LENGTH - bare - separatorLength;
  const location = room(PLACE_SEPARATOR.length) > 0 ? clip(data.location, MAX_LOCATION).slice(0, room(PLACE_SEPARATOR.length)).trim() : "";
  const reason = room(REASON_WRAP.length) > 0 ? clip(data.reason, MAX_REASON).slice(0, room(REASON_WRAP.length)).trim() : "";
  return toSmsText(template({ ...fields, place: location ? `${PLACE_SEPARATOR}${location}` : "", cause: reason ? ` (${reason})` : "" }));
}

// The fixed text of the test the administrator sends from the screen to a phone of their choice.
export function buildSmsTestText(municipality) {
  const town = clip(municipality, MAX_MUNICIPALITY) || "Prefeitura";
  return toSmsText(`${town}: teste de envio de SMS do sistema de castração. Se você recebeu esta mensagem, o envio está funcionando.`);
}

// Preview the same fixed words sent to the citizen, with placeholders for request data.
export function smsTextPreview(use, municipality = "Município") {
  const template = templates[use];
  if (!template) return "";
  const data = {
    town: clip(municipality, MAX_MUNICIPALITY) || "Prefeitura", protocol: "{protocolo}", date: "{data}", time: "{horario}",
    place: `${PLACE_SEPARATOR}{unidade}`, cause: " ({motivo})", code: "{codigo}", minutes: "{minutos}", fields: "{campos_alterados}",
  };
  return template(data);
}
