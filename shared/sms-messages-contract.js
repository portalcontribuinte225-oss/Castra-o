import { AuthCodeAction, AuthPurpose, isAuthCode } from "./auth-contract.js";
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
const MAX_LOCATION = 60;
const MAX_FIELDS = 40;
const MAX_REASON = 40;
const PLACE_SEPARATOR = " em ";
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

function visit({ date, time, place }) {
  return `${date ? ` em ${date}` : ""}${time ? `${date ? "," : ""} às ${time}` : ""}${place}`;
}

function codeText({ town, action, code, minutes }) {
  return `${town}: use o código ${code} para ${action}. Válido por ${minutes} ${minutes === "1" ? "minuto" : "minutos"}. Não compartilhe.`;
}

const templates = Object.freeze({
  [NotificationEvent.REQUEST_REGISTERED]: (d) => `${d.town}: solicitação registrada. Aguarde a análise. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CONFIRMED]: (d) => `${d.town}: agendamento confirmado${visit(d)}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_REMINDER]: (d) => `${d.town}: atendimento amanhã${d.date ? ` (${d.date})` : ""}${d.time ? `, às ${d.time}` : ""}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (d) => `${d.town}: agendamento alterado${visit(d)}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.NO_SHOW]: (d) => `${d.town}: registramos não comparecimento${d.date ? ` em ${d.date}` : ""}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [NotificationEvent.COMPLETED]: (d) => `${d.town}: atendimento concluído. Protocolo: ${d.protocol}.`,
  [NotificationEvent.REQUEST_REJECTED]: (d) => `${d.town}: sua solicitação foi indeferida${d.cause}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [AuthPurpose.PASSWORD_RESET]: codeText,
  [AuthPurpose.VERIFY_PHONE]: codeText,
  [AuthPurpose.REQUEST_TRACKING]: codeText,
  [AuthPurpose.CONTACT_CHANGED]: (d) => `${d.town}: seus contatos foram atualizados (${d.fields}). Se não foi você, fale com nossa equipe.`,
});

// Builds the text of one use. Every field is bounded, and the location and the reason take only the room that is left, so the result
// never passes the longest length. An unknown use yields an empty text, which the sender refuses.
export function buildSmsText(use, data = {}) {
  if (!Object.hasOwn(templates, use)) return "";
  const template = templates[use];
  const action = AuthCodeAction[use];
  const minutes = String(data.minutes ?? "");
  if (action && (!isAuthCode(data.code) || !/^[1-9]\d{0,2}$/.test(minutes))) return "";
  const fields = {
    town: clip(data.municipality, MAX_MUNICIPALITY) || "Prefeitura",
    protocol: clip(data.protocol, MAX_PROTOCOL),
    date: clip(data.date, MAX_DATE),
    time: clip(data.time, MAX_TIME),
    action,
    code: data.code,
    minutes,
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
  if (!Object.hasOwn(templates, use)) return "";
  const data = {
    town: clip(municipality, MAX_MUNICIPALITY) || "Prefeitura", protocol: "{protocolo}", date: "{data}", time: "{horario}",
    place: `${PLACE_SEPARATOR}{unidade}`, cause: " ({motivo})", action: AuthCodeAction[use], code: "{codigo}", minutes: "{minutos}", fields: "{campos_alterados}",
  };
  return templates[use](data);
}
