export const RequestStatus = Object.freeze({
  NEW: "NOVA", SCHEDULED: "AGENDADA", COMPLETED: "REALIZADA", CANCELLED: "CANCELADA",
});
// Who registered the request: the person, on the public form, or the staff, at the counter.
export const RequestOrigin = Object.freeze({ PUBLIC: "PUBLICA", INTERNAL: "INTERNA" });
export const RequestTag = Object.freeze({ RESCHEDULED: "REAGENDADA" });
export const RequestKind = Object.freeze({
  PROCEDURE: "PROCEDIMENTO", DEATH: "ANIMAL_OBITO", TRANSFER: "TROCA_TUTOR", COMPLAINT: "DENUNCIA",
});
export function isProcedureRequest(kind) {
  return ![RequestKind.DEATH, RequestKind.TRANSFER, RequestKind.COMPLAINT].includes(kind);
}
