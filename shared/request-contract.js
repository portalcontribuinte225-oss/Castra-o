export const RequestStatus = Object.freeze({
  NEW: "NOVA", SCHEDULED: "AGENDADA", COMPLETED: "REALIZADA", CANCELLED: "CANCELADA",
});
export const RequestKind = Object.freeze({
  PROCEDURE: "PROCEDIMENTO", DEATH: "ANIMAL_OBITO", TRANSFER: "TROCA_TUTOR", COMPLAINT: "DENUNCIA",
});
export function isProcedureRequest(kind) {
  return ![RequestKind.DEATH, RequestKind.TRANSFER, RequestKind.COMPLAINT].includes(kind);
}
