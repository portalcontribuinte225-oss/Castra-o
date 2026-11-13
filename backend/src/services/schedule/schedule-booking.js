import { buildScheduleOccurrences, allocateScheduleAvailability, scheduleDate, displayScheduleDate } from "../../../../shared/schedule-contract.js";
import { configsAllowStep } from "../../../../shared/notification-contract.js";
import { RequestStatus, isProcedureRequest } from "../../../../shared/request-contract.js";
import { loadScheduleAvailability } from "../../repositories/schedule-availability.js";
import { isInternalUser } from "../../tenant.js";

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
export function localToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function availabilityRange(input = {}, now = new Date()) {
  const from = input.from ? scheduleDate(input.from) : localToday(now);
  if (!from) fail("Informe um período válido de até 93 dias.", 400);
  const to = input.to ? scheduleDate(input.to) : new Date(Date.parse(`${from}T00:00:00Z`) + 92 * 86400000).toISOString().slice(0, 10);
  if (!from || !to || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 93) fail("Informe um período válido de até 93 dias.", 400);
  return { from, to };
}
export async function getAvailability(database, { municipalityId, from, to, excludeId }) {
  const source = await loadScheduleAvailability(database, { municipalityId, from, to, excludeId });
  return { days: allocateScheduleAvailability(buildScheduleOccurrences(source.days, source.rules, from, to), source.requests), from, to };
}
export async function reserveRequestSchedule(client, { body, municipalityId, settings, user, internal = isInternalUser(user), excludeId, now = new Date() }) {
  const type = body.request_type ?? body.requestType ?? body.type;
  if (body.status === RequestStatus.CANCELLED) return body;
  const workflow = { ...(body.workflow_data || body.workflowData || {}) };
  const requestType = settings.requestTypes.find((item) => item.id === body.requestTypeId || item.name === type || item.id === type);
  const identification = settings.identificationTypes.find((item) => item.id === workflow.identificationTypeId);
  // Staff may register an unscheduled visit; public omission never grants that privilege.
  const required = internal ? Boolean(body.schedule_date || body.preferredSchedule || body.appointment)
    : configsAllowStep([requestType, identification], "stepAgenda");
  if (!required || !isProcedureRequest(type)) {
    for (const key of ["scheduleOccurrenceKey", "scheduleSlotTime", "scheduleTime"]) delete workflow[key];
    return { ...body, schedule_date: null, preferredSchedule: "", appointment: "", scheduleLocationName: "", schedule_location_name: "",
      scheduleAddress: "", schedule_address: "", scheduleAddressUrl: "", schedule_address_url: "", scheduleMunicipality: "", schedule_municipality: "",
      scheduleOccurrenceKey: "", scheduleSlotTime: "", scheduleTime: "", workflow_data: workflow };
  }
  const date = scheduleDate(body.schedule_date || body.preferredSchedule || body.appointment);
  if (!date || date < localToday(now)) fail("Escolha uma data disponível na agenda.", 400);
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
export function bookingChanged(previous, next) {
  const before = previous.workflow_data || {}, after = next.workflow_data || {};
  return previous.schedule_date !== next.schedule_date
    || previous.request_type !== next.request_type || before.identificationTypeId !== after.identificationTypeId
    || before.scheduleOccurrenceKey !== after.scheduleOccurrenceKey
    || (before.scheduleSlotTime || before.scheduleTime) !== (after.scheduleSlotTime || after.scheduleTime)
    || before.scheduleTime !== after.scheduleTime
    || Math.max(previous.animals?.length || 0, 1) !== Math.max(next.animals?.length || 0, 1)
    || (previous.status === RequestStatus.CANCELLED && next.status !== RequestStatus.CANCELLED);
}
