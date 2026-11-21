import { MAX_HEALTH_TEXT, MAX_PRESCRIPTION_TEXT, MAX_PROCEDURE_NOTE, MAX_PROFESSIONAL_TEXT, ProcedureAction } from "../../../../shared/request-procedure-contract.js";
import { REJECTION_REASONS } from "../../../../shared/notification-contract.js";
import { scheduleDate } from "../../../../shared/schedule-contract.js";

const ACTIONS = Object.values(ProcedureAction);

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Free text the staff types: trimmed, within its limit; `undefined` when it was not sent.
function optionalText(value, max, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid(`${label} inválido.`);
  const text = value.trim();
  if (text.length > max) invalid(`${label} deve ter até ${max} caracteres.`);
  return text;
}

function requiredText(value, max, label) {
  const text = optionalText(value, max, label);
  if (!text) invalid(`Informe ${label.toLowerCase()}.`);
  return text;
}

function parseEdits(value) {
  if (value === undefined) return {};
  if (!isObject(value)) invalid("Dados do atendimento inválidos.");
  const microchip = optionalText(value.microchip, 32, "Microchip");
  if (microchip && !/^[A-Za-z0-9]+$/.test(microchip)) invalid("O microchip aceita só letras e números.");
  return {
    doencas: optionalText(value.doencas, MAX_HEALTH_TEXT, "Doenças preexistentes"),
    alergias: optionalText(value.alergias, MAX_HEALTH_TEXT, "Alergias conhecidas"),
    microchip: microchip === undefined ? undefined : microchip.toUpperCase(),
  };
}

function parseRejection(data) {
  if (!REJECTION_REASONS.includes(data.reason)) invalid("Escolha o motivo do indeferimento.");
  return { reason: data.reason, note: requiredText(data.note, MAX_PROCEDURE_NOTE, "A justificativa") };
}

function parseSchedule(data) {
  const schedule = isObject(data.schedule) ? data.schedule : {};
  if (typeof schedule.date !== "string" || !scheduleDate(schedule.date) || typeof schedule.occurrenceKey !== "string" || !schedule.occurrenceKey || schedule.occurrenceKey.length > 300
    || typeof schedule.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)) invalid("Escolha a nova data, o local e o horário.");
  return { date: schedule.date, occurrenceKey: schedule.occurrenceKey, time: schedule.time, reason: optionalText(data.reason, MAX_PROCEDURE_NOTE, "Motivo") || "" };
}

function parseCancelledSchedule(value) {
  const date = typeof value?.date === "string" ? scheduleDate(value.date) : "";
  if (!date || typeof value.occurrenceKey !== "string" || value.occurrenceKey.length > 300
    || typeof value.time !== "string" || value.time.length > 40) invalid("Confirme o agendamento que deseja cancelar.");
  return { date, occurrenceKey: value.occurrenceKey, time: value.time, updatedAt: optionalText(value.updatedAt, 80, "Versão do procedimento") || "" };
}

function parsePrescription(data) {
  const prescription = isObject(data.prescription) ? data.prescription : {};
  return {
    text: requiredText(prescription.text, MAX_PRESCRIPTION_TEXT, "A prescrição"),
    professionalName: requiredText(prescription.professionalName, MAX_PROFESSIONAL_TEXT, "O nome do profissional"),
    professionalRegistry: requiredText(prescription.professionalRegistry, MAX_PROFESSIONAL_TEXT, "O registro profissional"),
  };
}

// What the staff screen sends for one action on one procedure of one animal of the request.
export function parseProcedureActionInput(body) {
  const input = isObject(body) ? body : {};
  if (!ACTIONS.includes(input.action)) invalid("Ação inválida.");
  if (!Number.isInteger(input.animalIndex) || input.animalIndex < 0 || input.animalIndex > 1000) invalid("Animal inválido.");
  if (typeof input.requestTypeId !== "string" || !input.requestTypeId.trim() || input.requestTypeId.length > 200) invalid("Procedimento inválido.");
  const data = isObject(input.data) ? input.data : {};
  return {
    action: input.action, animalIndex: input.animalIndex, requestTypeId: input.requestTypeId,
    edits: parseEdits(data.edits),
    rejection: input.action === ProcedureAction.REJECT ? parseRejection(data) : null,
    schedule: input.action === ProcedureAction.RESCHEDULE ? parseSchedule(data) : null,
    cancelledSchedule: input.action === ProcedureAction.CANCEL_SCHEDULE ? parseCancelledSchedule(data.schedule) : null,
    prescription: input.action === ProcedureAction.PRESCRIPTION ? parsePrescription(data) : null,
  };
}
