import { ProcedureAction, isMicrochipProcedure, isOpenProcedure, procedureStatusAfter } from "../../../../shared/request-procedure-contract.js";

function fail(message, status) {
  throw Object.assign(new Error(message), { status });
}

const ACTION_NOTES = Object.freeze({
  [ProcedureAction.SAVE]: () => "dados salvos",
  [ProcedureAction.CONFIRM_SCHEDULE]: () => "agenda confirmada",
  [ProcedureAction.ATTEND]: (next) => `atendimento realizado${next.microchip ? `. Microchip: ${next.microchip}` : ""}`,
  [ProcedureAction.NO_SHOW]: () => "não compareceu",
  [ProcedureAction.REJECT]: (next) => `indeferido (${next.rejection.reason}). Justificativa: ${next.rejection.note}`,
  [ProcedureAction.RESCHEDULE]: (next, previous, input) => {
    const change = previous.schedule?.date ? `reagendado de ${previous.schedule.date} para ${next.schedule.date}` : `horário selecionado para ${next.schedule.date}`;
    return input.schedule.reason ? `${change}. Motivo: ${input.schedule.reason}` : change;
  },
  [ProcedureAction.CANCEL_SCHEDULE]: (_next, { schedule }) =>
    `agendamento de ${[schedule.date, schedule.slotTime, schedule.locationName].filter(Boolean).join(" · ")} cancelado`,
  [ProcedureAction.PRESCRIPTION]: (next) => `receita registrada por ${next.prescription.professionalName}`,
});

// Applies one action to one procedure of one animal. `animals` come from resolveRequestProcedures; every animal's procedures are
// stored from then on, but only the chosen procedure and the health of its own animal change. `schedule` is the place already
// reserved for a reschedule; `prescriptionNumber`, the number the municipality gave the prescription being saved.
export function applyProcedureAction({ animals, procedure: previous, input, schedule = null, prescriptionNumber = "", user, now = new Date() }) {
  const animal = animals[input.animalIndex];
  const microchipProcedure = isMicrochipProcedure(previous.name);
  if (input.edits.microchip !== undefined && !microchipProcedure) fail("O código do microchip só pode ser salvo no procedimento de microchipagem.", 400);
  let nextAnimal = { ...animal };
  let next = { ...previous };
  if (isOpenProcedure(previous)) {
    const { doencas, alergias, microchip } = input.edits;
    if (doencas !== undefined) nextAnimal.doencas = doencas;
    if (alergias !== undefined) nextAnimal.alergias = alergias;
    if (microchip !== undefined && microchipProcedure) next.microchip = microchip;
  }
  if (input.action === ProcedureAction.ATTEND && microchipProcedure) {
    if (!next.microchip || next.microchip.length < 4) fail("Informe o código do microchip aplicado ou lido (mínimo de 4 caracteres).", 400);
    nextAnimal = { ...nextAnimal, hasChip: "Sim", microchip: next.microchip, confirmedMicrochip: next.microchip };
  }
  if (input.action === ProcedureAction.REJECT) next.rejection = input.rejection;
  if ([ProcedureAction.CONFIRM_SCHEDULE, ProcedureAction.RESCHEDULE, ProcedureAction.CANCEL_SCHEDULE].includes(input.action)) next.schedule = schedule;
  if (input.action === ProcedureAction.PRESCRIPTION) {
    next.prescription = { ...input.prescription, number: prescriptionNumber, issuedAt: now.toISOString(), issuedBy: user.id };
  }
  next = { ...next, status: procedureStatusAfter(previous.status, input.action), updatedAt: now.toISOString(), updatedBy: user.id };
  const resolved = animals.map((item, index) => (index === input.animalIndex
    ? { ...nextAnimal, procedures: animal.procedures.map((procedure) => (procedure === previous ? next : procedure)) }
    : item));
  const subject = `${previous.name} de ${animal.name || `animal ${input.animalIndex + 1}`}`;
  return {
    resolved,
    procedure: next,
    previousSchedule: previous.schedule,
    note: `${subject}: ${ACTION_NOTES[input.action](next, previous, input)}.`,
  };
}
