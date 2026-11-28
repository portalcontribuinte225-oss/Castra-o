import {
  MAX_HEALTH_TEXT, MAX_PRESCRIPTION_TEXT, MAX_PROCEDURE_BATCH, MAX_PROCEDURE_NOTE, MAX_PROFESSIONAL_TEXT, ProcedureAction,
} from "../../../../shared/request-procedure-contract.js";
import { scheduleDate } from "../../../../shared/schedule-contract.js";

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function text(value, max, label, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") invalid(`${label} inválido.`);
  const trimmed = value.trim();
  if (required && !trimmed) invalid(`Informe ${label.toLowerCase()}.`);
  if (trimmed.length > max) invalid(`${label} deve ter até ${max} caracteres.`);
  return trimmed;
}

function animalIndex(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1000) invalid("Animal inválido.");
  return value;
}

function target(value) {
  if (!object(value)) invalid("Procedimento inválido.");
  return { animalIndex: animalIndex(value.animalIndex), requestTypeId: text(value.requestTypeId, 200, "O procedimento", true) };
}

function list(source, parse, key) {
  if (source === undefined) return [];
  if (!Array.isArray(source) || source.length > MAX_PROCEDURE_BATCH) invalid("Seleção de itens inválida.");
  const items = source.map(parse);
  if (new Set(items.map(key)).size !== items.length) invalid("A seleção tem itens repetidos.");
  return items;
}

function health(value) {
  if (!object(value)) invalid("Dados de saúde inválidos.");
  const microchip = text(value.microchip, 32, "Microchip");
  if (microchip && !/^[A-Za-z0-9]+$/.test(microchip)) invalid("O microchip aceita só letras e números.");
  return {
    animalIndex: animalIndex(value.animalIndex),
    doencas: text(value.doencas, MAX_HEALTH_TEXT, "Doenças preexistentes"),
    alergias: text(value.alergias, MAX_HEALTH_TEXT, "Alergias conhecidas"),
    microchip: microchip?.toUpperCase(),
  };
}

function readSchedule(data) {
  const schedule = data.schedule;
  if (!object(schedule) || !scheduleDate(schedule.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)
    || typeof schedule.time !== "string") invalid("Escolha a data, o local e o horário.");
  return { date: scheduleDate(schedule.date), occurrenceKey: text(schedule.occurrenceKey, 300, "O local", true),
    time: schedule.time, reason: text(data.reason, MAX_PROCEDURE_NOTE, "Motivo") || "" };
}

function prescription(value) {
  if (!object(value)) invalid("Receita inválida.");
  const index = animalIndex(value.animalIndex);
  const content = text(value.text, MAX_PRESCRIPTION_TEXT, "A prescrição") || "";
  if (!content) return { animalIndex: index, text: "" };
  return {
    animalIndex: index, text: content, requestTypeId: text(value.requestTypeId, 200, "Procedimento") || "",
    professionalName: text(value.professionalName, MAX_PROFESSIONAL_TEXT, "O nome do profissional", true),
    professionalRegistry: text(value.professionalRegistry, MAX_PROFESSIONAL_TEXT, "O registro profissional", true),
  };
}

export function parseProcedureActionInput(body) {
  if (!object(body) || !Object.values(ProcedureAction).includes(body.action)) invalid("Ação inválida.");
  const { action, expectedUpdatedAt } = body;
  if (typeof expectedUpdatedAt !== "string" || (expectedUpdatedAt && !Number.isFinite(Date.parse(expectedUpdatedAt)))) {
    invalid("Atualize o processo antes de enviar a ação.");
  }
  const operation = { action, expectedUpdatedAt };
  if (action === ProcedureAction.CONFIRM_SCHEDULE) {
    if (body.data !== undefined && (!object(body.data) || Object.keys(body.data).length)) {
      invalid("A confirmação usa a reserva atual. Atualize o processo e tente novamente.");
    }
    return operation;
  }
  const data = object(body.data) ? body.data : {};
  if (action === ProcedureAction.RESCHEDULE) return { ...operation, schedule: readSchedule(data) };
  if (action === ProcedureAction.REMOVE) return { ...operation, target: target(data.target), reason: text(data.reason, MAX_PROCEDURE_NOTE, "O motivo da remoção", true) };
  if (action === ProcedureAction.PRESCRIPTION) {
    const prescriptions = list(data.prescriptions, prescription, (row) => row.animalIndex);
    if (!prescriptions.length) invalid("Informe as receitas que deseja salvar.");
    return { ...operation, prescriptions };
  }
  const results = list(data.results, target, (item) => JSON.stringify([item.animalIndex, item.requestTypeId]));
  const healthEdits = action !== ProcedureAction.NO_SHOW ? list(data.health, health, (item) => item.animalIndex) : [];
  if (action === ProcedureAction.CLOSE) return { ...operation, results, health: healthEdits };
  if (!results.length && !healthEdits.length) invalid("Selecione os itens que deseja salvar.");
  return { ...operation, results, health: healthEdits };
}
