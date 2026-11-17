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
const MAX_REASON = 40;
const MAX_LINK = 120;
const PLACE_SEPARATOR = " na ";
const REASON_WRAP = " ()";
const LINK_PREFIX = " ";

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
// prefixed with its separator, or empty; `cause` is the reason of a rejection already in parentheses, or empty; `access` is the link
// to "Acessar minha solicitação" already prefixed, or empty. The analysis of the documents has one text for each outcome.
const documentsTexts = Object.freeze({
  [DocumentsOutcome.APPROVED]: (d) => `${d.town}: seus documentos foram aprovados e a solicitacao segue para as proximas etapas. Protocolo: ${d.protocol}.`,
  [DocumentsOutcome.REJECTED]: (d) => `${d.town}: seus documentos nao foram aprovados. Acesse a solicitacao para ver o motivo. Protocolo: ${d.protocol}.`,
});

const templates = Object.freeze({
  [NotificationEvent.REQUEST_REGISTERED]: (d) => `${d.town}: solicitacao registrada! Protocolo ${d.protocol}. Em analise.${d.scheduled ? ` Atendimento em ${d.date}, as ${d.time}${d.place}.` : ""}${d.access}`,
  [NotificationEvent.SCHEDULE_CONFIRMED]: (d) => `${d.town}: castracao confirmada! Esperamos voce em ${d.date}, as ${d.time}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.SCHEDULE_CHANGED]: (d) => `${d.town}: seu atendimento foi reagendado para ${d.date}, as ${d.time}${d.place}. Protocolo: ${d.protocol}.`,
  [NotificationEvent.NO_SHOW]: (d) => `${d.town}: voce nao compareceu ao agendamento de castracao de ${d.date}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [NotificationEvent.DOCUMENTS_REVIEWED]: (d) => documentsTexts[d.outcome](d),
  [NotificationEvent.COMPLETED]: (d) => `${d.town}: atendimento de castracao concluido! Obrigado pelo cuidado com seu animal. Protocolo: ${d.protocol}.`,
  [NotificationEvent.REQUEST_REJECTED]: (d) => `${d.town}: sua solicitacao foi indeferida${d.cause}. Fale com nossa equipe. Protocolo: ${d.protocol}.`,
  [AuthPurpose.PASSWORD_RESET]: (d) => `${d.town}: recebemos um pedido para redefinir sua senha. Codigo: ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.VERIFY_PHONE]: (d) => `${d.town}: para confirmar seu telefone, informe o codigo ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.REQUEST_TRACKING]: (d) => `${d.town}: para consultar sua solicitacao, use o codigo ${d.code}. Valido por ${d.minutes} minutos. Nao compartilhe.`,
  [AuthPurpose.CONTACT_CHANGED]: (d) => `${d.town}: seus dados foram atualizados (${d.fields}). Se nao foi voce, fale com nossa equipe.`,
});

// A link goes only whole: plain ASCII the SMS keeps as it is, never cut.
function smsLink(value) {
  const link = typeof value === "string" ? value.trim() : "";
  return link.length <= MAX_LINK && /^https?:\/\/\S+$/.test(link) && toSmsText(link) === link ? link : "";
}

// Builds the text of one use. Every field is bounded; the link comes next, only when it fits whole, and the location takes whatever
// room is left, so the result always fits in one SMS. An unknown use yields an empty text, which the sender refuses.
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
    scheduled: data.scheduled === true,
  };
  const bare = template({ ...fields, place: "", cause: "", access: "" }).length;
  const link = template({ ...fields, place: "", cause: "", access: LINK_PREFIX }).length > bare ? smsLink(data.link) : "";
  const access = link && bare + LINK_PREFIX.length + link.length <= SMS_MAX_LENGTH ? `${LINK_PREFIX}${link}` : "";
  const room = (separatorLength) => SMS_MAX_LENGTH - bare - access.length - separatorLength;
  const location = room(PLACE_SEPARATOR.length) > 0 ? clip(data.location, MAX_LOCATION).slice(0, room(PLACE_SEPARATOR.length)).trim() : "";
  const reason = room(REASON_WRAP.length) > 0 ? clip(data.reason, MAX_REASON).slice(0, room(REASON_WRAP.length)).trim() : "";
  return toSmsText(template({ ...fields, access, place: location ? `${PLACE_SEPARATOR}${location}` : "", cause: reason ? ` (${reason})` : "" }));
}

// The fixed text of the test the administrator sends from the screen to a phone of their choice.
export function buildSmsTestText(municipality) {
  const town = clip(municipality, MAX_MUNICIPALITY) || "Prefeitura";
  return toSmsText(`${town}: teste de envio de SMS do sistema de castracao. Se voce recebeu esta mensagem, o envio esta funcionando.`);
}

// The text of a use as the screen shows it: the fixed words exactly as they go out, and the data in braces, named as the team wrote
// them. One text, or one for each outcome when the text depends on it (`outcome` says which; it is null otherwise).
export function smsTexts(use, municipality = "Municipio") {
  const template = templates[use];
  if (!template) return [];
  const data = {
    town: clip(municipality, MAX_MUNICIPALITY) || "Prefeitura", protocol: "{protocolo}", date: "{data}", time: "{horario}",
    place: `${PLACE_SEPARATOR}{unidade}`, cause: " ({motivo})", code: "{codigo}", minutes: "{minutos}", fields: "{campos_alterados}",
    scheduled: true, access: `${LINK_PREFIX}{link}`,
  };
  const outcomes = use === NotificationEvent.DOCUMENTS_REVIEWED ? Object.values(DocumentsOutcome) : [null];
  return outcomes.map((outcome) => ({ outcome, text: template({ ...data, outcome }) }));
}
