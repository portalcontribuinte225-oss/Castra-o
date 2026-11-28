import { buildScheduleOccurrences, allocateScheduleAvailability, requestScheduleBookings, scheduleDate, displayScheduleDate, scheduleLocalDate } from "../../../../shared/schedule-contract.js";
import { RequestStatus, isProcedureRequest } from "../../../../shared/request-contract.js";
import { appointmentNumberOfAnimals, hasStoredProcedures } from "../../../../shared/request-procedure-contract.js";
import { loadScheduleAvailability } from "../../repositories/schedule-availability.js";
import { isInternalUser } from "../../tenant.js";

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
export function availabilityRange(input = {}, now = new Date()) {
  const from = input.from ? scheduleDate(input.from) : scheduleLocalDate(now);
  if (!from) fail("Informe um período válido de até 93 dias.", 400);
  const to = input.to ? scheduleDate(input.to) : new Date(Date.parse(`${from}T00:00:00Z`) + 92 * 86400000).toISOString().slice(0, 10);
  if (!from || !to || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 93) fail("Informe um período válido de até 93 dias.", 400);
  return { from, to };
}
export async function getAvailability(database, { municipalityId, from, to, excludeId }) {
  const source = await loadScheduleAvailability(database, { municipalityId, from, to, excludeId });
  return { days: allocateScheduleAvailability(buildScheduleOccurrences(source.days, source.rules, from, to), source.requests), from, to };
}
export async function reserveRequestSchedule(client, { body, municipalityId, user, internal = isInternalUser(user), excludeId, now = new Date() }) {
  const type = body.request_type ?? body.requestType ?? body.type;
  if (body.status === RequestStatus.CANCELLED) return body;
  const workflow = { ...(body.workflow_data || body.workflowData || {}) };
  // The agenda is a fixed step of every procedure. Staff may register an unscheduled visit; public omission never grants that privilege.
  const required = !internal || Boolean(body.schedule_date || body.preferredSchedule || body.appointment);
  if (!required || !isProcedureRequest(type)) {
    for (const key of ["scheduleOccurrenceKey", "scheduleSlotTime", "scheduleTime"]) delete workflow[key];
    return { ...body, schedule_date: null, preferredSchedule: "", appointment: "", scheduleLocationName: "", schedule_location_name: "",
      scheduleAddress: "", schedule_address: "", scheduleAddressUrl: "", schedule_address_url: "", scheduleMunicipality: "", schedule_municipality: "",
      scheduleOccurrenceKey: "", scheduleSlotTime: "", scheduleTime: "", workflow_data: workflow };
  }
  const date = scheduleDate(body.schedule_date || body.preferredSchedule || body.appointment);
  if (!date || date < scheduleLocalDate(now)) fail("Escolha uma data disponível na agenda.", 400);
  const { days } = await getAvailability(client, { municipalityId, from: date, to: date, excludeId });
  const candidates = days.filter((day) => !workflow.scheduleOccurrenceKey || day.occurrenceKey === workflow.scheduleOccurrenceKey);
  if (candidates.length !== 1) fail("A ocorrência da agenda mudou. Escolha a data e o local novamente.");
  const day = candidates[0];
  const count = Math.max(Array.isArray(body.animals) ? body.animals.length : 0, 1);
  const time = workflow.scheduleSlotTime || workflow.scheduleTime || body.scheduleSlotTime || body.scheduleTime;
  const slot = time ? day.slots.find((item) => item.time === time) : day.slots.find((item) => item.remaining >= count);
  if (!slot || slot.remaining < count) fail("As vagas desse horário se esgotaram. Escolha outro horário.");
  return {
    ...body, schedule_date: displayScheduleDate(date), preferredSchedule: displayScheduleDate(date),
    schedule_location_name: day.locationName, schedule_address: day.locationAddress, schedule_address_url: day.addressUrl,
    schedule_municipality: body.municipality || "", workflow_data: { ...workflow, scheduleOccurrenceKey: day.occurrenceKey, scheduleSlotTime: slot.time, scheduleTime: slot.time },
  };
}
// Check the whole open group under the municipal lock. The process's own places are excluded from occupancy.
export async function checkProcedureSchedule(client, { request, animals, selection, now }) {
  if (!selection) return { error: "A reserva atual não identifica um único horário.", status: 409 };
  const { date } = selection;
  if (date < scheduleLocalDate(now)) return { error: "A data do horário escolhido já passou.", status: 400 };
  const { days } = await getAvailability(client, { municipalityId: request.municipality_id, from: date, to: date, excludeId: request.id });
  const day = days.find((item) => item.occurrenceKey === selection.occurrenceKey);
  if (!day) return { error: "A data ou o local do horário reservado não está mais na agenda.", status: 409 };
  const slot = day.slots.find((item) => item.time === selection.time);
  if (!slot) return { error: "Esse horário não existe mais na agenda.", status: 409 };
  if (slot.remaining < appointmentNumberOfAnimals(animals)) return { error: "Esse horário não tem vagas suficientes para os animais do processo.", status: 409 };
  return { schedule: { date: displayScheduleDate(date), occurrenceKey: day.occurrenceKey, slotTime: selection.time,
    locationName: day.locationName, address: day.locationAddress, addressUrl: day.addressUrl } };
}

function procedureBookingSignature(request) {
  return requestScheduleBookings(request).map(({ date, occurrenceKey, slotTime, count }) =>
    JSON.stringify([scheduleDate(date), occurrenceKey, slotTime, count])).sort().join("\n");
}

export function bookingChanged(previous, next) {
  const before = previous.workflow_data || {}, after = next.workflow_data || {};
  return previous.schedule_date !== next.schedule_date
    || previous.request_type !== next.request_type
    || ((hasStoredProcedures(previous) || hasStoredProcedures(next)) && procedureBookingSignature(previous) !== procedureBookingSignature(next))
    || before.scheduleOccurrenceKey !== after.scheduleOccurrenceKey
    || (before.scheduleSlotTime || before.scheduleTime) !== (after.scheduleSlotTime || after.scheduleTime)
    || before.scheduleTime !== after.scheduleTime
    || Math.max(previous.animals?.length || 0, 1) !== Math.max(next.animals?.length || 0, 1)
    || (previous.status === RequestStatus.CANCELLED && next.status !== RequestStatus.CANCELLED);
}
