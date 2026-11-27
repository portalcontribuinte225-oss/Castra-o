import { NotificationEvent } from "../../../../shared/notification-contract.js";
import { RequestStatus, isProcedureRequest } from "../../../../shared/request-contract.js";
import { ProcedureStatus, hasStoredProcedures, resolveRequestProcedures } from "../../../../shared/request-procedure-contract.js";
import { scheduleDate } from "../../../../shared/schedule-contract.js";
import { claimProcedureReminder, procedureReminderRequests } from "../../repositories/procedure-reminders.js";
import { appendRequestHistory } from "../../repositories/request-history.js";
import { recordNotificationResults, requestForProcedure } from "../request-change-notifications.js";
import { localToday } from "../schedule/schedule-booking.js";
import { dispatchNotification } from "./dispatch-notification.js";

const EVENT = NotificationEvent.SCHEDULE_REMINDER;
const localHour = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" });

function* confirmedVisits(request, date) {
  if (!isProcedureRequest(request.request_type) || request.status !== RequestStatus.SCHEDULED) return;
  if (!hasStoredProcedures(request)) {
    if (scheduleDate(request.schedule_date) === date) {
      const { scheduleSlotTime, scheduleTime } = request.workflow_data;
      yield { procedure: { schedule: { date, slotTime: scheduleSlotTime || scheduleTime, locationName: request.schedule_location_name,
        address: request.schedule_address, addressUrl: request.schedule_address_url } } };
    }
    return;
  }
  for (const animal of resolveRequestProcedures(request)) {
    for (const procedure of animal.procedures) {
      if (procedure.status === ProcedureStatus.SCHEDULED && scheduleDate(procedure.schedule?.date) === date) yield { procedure, animal };
    }
  }
}

export async function sendProcedureReminders(date, {
  requests = procedureReminderRequests, claim = claimProcedureReminder, dispatch = dispatchNotification, appendHistory = appendRequestHistory,
} = {}) {
  for await (const request of requests(date)) {
    const followUp = request.workflow_data?.followUp;
    if (followUp?.enabled !== true || (!followUp.phone && !followUp.email)) continue;
    let previous = request.workflow_data.notificationDispatches?.[EVENT];
    for (const visit of confirmedVisits(request, date)) {
      const { slotTime, locationName, address } = visit.procedure.schedule;
      const key = JSON.stringify([slotTime || "", locationName || "", address || ""]);
      const visits = previous?.date === date ? previous.visits : [];
      if (visits.includes(key)) continue;
      const next = { date, visits: [...visits, key] };
      if (!await claim(request, previous, next)) break;
      previous = next;
      const results = await dispatch({ event: EVENT, request: requestForProcedure(request, EVENT, visit) });
      await recordNotificationResults(results, request, { appendHistory });
    }
  }
}

export function startProcedureReminders() {
  let running = false;
  async function tick() {
    const now = new Date();
    const today = localToday(now);
    const hour = Number(localHour.format(now));
    if (running || hour < 9 || hour >= 20) return;
    running = true;
    try {
      const tomorrow = new Date(`${today}T00:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      await sendProcedureReminders(tomorrow.toISOString().slice(0, 10));
    } catch {
      console.error("Não foi possível concluir os lembretes de procedimento.");
    } finally {
      running = false;
    }
  }
  void tick();
  setInterval(tick, 15 * 60_000).unref();
}
