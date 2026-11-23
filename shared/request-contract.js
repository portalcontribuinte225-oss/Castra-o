export const RequestStatus = Object.freeze({
  NEW: "NOVA", SCHEDULED: "AGENDADA", COMPLETED: "REALIZADA", CANCELLED: "CANCELADA",
});
// Who registered the request: the person, on the public form, or the staff, at the counter.
export const RequestOrigin = Object.freeze({ PUBLIC: "PUBLICA", INTERNAL: "INTERNA" });
// The marks a request carries besides its status: assigned to someone, rescheduled, or made from an animal's microchip, death or transfer.
export const RequestTag = Object.freeze({
  ASSIGNED: "ATRIBUIDA", RESCHEDULED: "REAGENDADA", MICROCHIP: "MICROCHIP", DEATH: "OBITO", TRANSFER: "TROCA_TUTOR",
});
export const REQUEST_CONTACT_CPF_KEY = "requestContactCpf";

export function withoutRequestContactCpf(workflow) {
  if (!workflow || !Object.hasOwn(workflow, REQUEST_CONTACT_CPF_KEY)) return workflow;
  const { [REQUEST_CONTACT_CPF_KEY]: _contactCpf, ...visible } = workflow;
  return visible;
}

export const RequestKind = Object.freeze({
  PROCEDURE: "PROCEDIMENTO", DEATH: "ANIMAL_OBITO", TRANSFER: "TROCA_TUTOR", COMPLAINT: "DENUNCIA",
});
export function isProcedureRequest(kind) {
  return ![RequestKind.DEATH, RequestKind.TRANSFER, RequestKind.COMPLAINT].includes(kind);
}
