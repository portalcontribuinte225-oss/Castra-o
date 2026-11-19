import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";

export enum ProcessTab {
  ATTACHMENTS = "anexos",
  PROCEDURES = "procedimento",
  TUTOR = "tutor",
}

export const procedureStatusLabels: Record<string, string> = {
  [ProcedureStatus.WAITING]: "Aguardando",
  [ProcedureStatus.SCHEDULED]: "Agendado",
  [ProcedureStatus.DONE]: "Realizado",
  [ProcedureStatus.NO_SHOW]: "Não compareceu",
  [ProcedureStatus.REJECTED]: "Indeferido",
};

// The chip classes the attachments already use, so a procedure and a document in the same state look alike.
export const procedureStatusClasses: Record<string, string> = {
  [ProcedureStatus.WAITING]: "pending",
  [ProcedureStatus.SCHEDULED]: "generated",
  [ProcedureStatus.DONE]: "approved",
  [ProcedureStatus.NO_SHOW]: "missing",
  [ProcedureStatus.REJECTED]: "rejected",
};

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
