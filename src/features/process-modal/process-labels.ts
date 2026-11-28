import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";

export enum ProcessTab {
  ATTACHMENTS = "anexos",
  PROCEDURES = "procedimento",
  TUTOR = "tutor",
  HISTORY = "historico",
}

export const procedureStatusLabels: Record<string, string> = {
  [ProcedureStatus.WAITING]: "Pendente",
  [ProcedureStatus.SCHEDULED]: "Pendente",
  [ProcedureStatus.DONE]: "Realizado",
  [ProcedureStatus.NO_SHOW]: "Não compareceu",
  [ProcedureStatus.REJECTED]: "Indeferido",
  [ProcedureStatus.REMOVED]: "Removido",
};
