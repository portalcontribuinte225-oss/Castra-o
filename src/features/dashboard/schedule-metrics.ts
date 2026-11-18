import type { AnyRecord } from "../../types";
import { parseAnyDate } from "../../analytics";
import { allocateScheduleAvailability } from "../../../shared/schedule-contract.js";
import type { ChartItem, MatrixData } from "./dashboard-data";
import { isInRange, startOfDay, type PeriodRange } from "./dashboard-period";
import { WEEKDAY_NAMES, WEEKDAY_SHORT_NAMES, formatNumber, pluralize } from "./dashboard-format";
import { percent, sum } from "./metric-math";
import { arrivedInRange, closedInRange, isCancelledRequest, isCompletedRequest, isNoShowRequest, scheduleDayTextOf } from "./request-outcome";

export interface SlotUsage {
  time: string;
  vacancies: number;
  used: number;
}

export interface DayUsage {
  date: Date;
  dateText: string;
  location: string;
  vacancies: number;
  used: number;
  slots: SlotUsage[];
}

export interface ScheduleSummary {
  days: number;
  vacancies: number;
  used: number;
  occupancy: number | null;
  freeAhead: number;
  nextOpenDay: { dateText: string; remaining: number } | null;
}

export const NO_TIME_LABEL = "Sem horário";
const NO_LOCATION_LABEL = "Local não informado";
// Monday first, as the agenda shows the week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOUR_BAND = 2;

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  items.forEach((item) => groups.set(keyOf(item), [...(groups.get(keyOf(item)) || []), item]));
  return groups;
}

// The requests that hold a place in the agenda: every booked request that was not cancelled, plus the no-shows, whose
// place stayed empty.
function bookingsOf(requests: AnyRecord[]): AnyRecord[] {
  return requests
    .filter((request) => scheduleDayTextOf(request) && (!isCancelledRequest(request) || isNoShowRequest(request)))
    .map((request) => ({
      schedule_date: scheduleDayTextOf(request),
      animals: request.animals,
      workflow_data: {
        scheduleSlotTime: request.scheduleSlotTime,
        scheduleOccurrenceKey: (request.workflow_data || request.workflowData || {}).scheduleOccurrenceKey,
      },
    }));
}

// How full each active agenda day is, handing out the places with the rule the agenda itself uses; one date at a time,
// so the cost grows with the records and not with their product.
export function dayUsages(days: AnyRecord[], requests: AnyRecord[]): DayUsage[] {
  const activeDays = days.filter((day) => day.active !== false && Array.isArray(day.slots) && parseAnyDate(day.date));
  const bookingsByDate = groupBy(bookingsOf(requests), (booking) => booking.schedule_date);
  const allocated: AnyRecord[] = [...groupBy(activeDays, (day) => day.date)]
    .flatMap(([dateText, sameDate]) => allocateScheduleAvailability(sameDate, bookingsByDate.get(dateText) || []));
  return allocated
    .map((day) => {
      const slots: SlotUsage[] = day.slots.map((slot: AnyRecord) => ({ time: slot.time, vacancies: slot.vacancies, used: slot.vacancies - slot.remaining }));
      return {
        date: parseAnyDate(day.date) as Date,
        dateText: day.date,
        location: String(day.locationName || "").trim(),
        vacancies: sum(slots.map((slot) => slot.vacancies)),
        used: sum(slots.map((slot) => slot.used)),
        slots,
      };
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function daysInRange(usages: DayUsage[], range: PeriodRange): DayUsage[] {
  return usages.filter((usage) => isInRange(usage.date, range));
}

// The agenda days of the range that already came (today included): occupancy is measured on them only, since the days
// ahead are still being booked.
export function pastDaysInRange(usages: DayUsage[], range: PeriodRange, now: Date): DayUsage[] {
  return daysInRange(usages, range).filter((usage) => usage.date <= startOfDay(now));
}

// The agenda days of the period that already came and their places; from today on, the places still free and the next
// day that has one.
export function scheduleSummary(usages: DayUsage[], range: PeriodRange, now: Date): ScheduleSummary {
  const inRange = pastDaysInRange(usages, range, now);
  const vacancies = sum(inRange.map((day) => day.vacancies));
  const used = sum(inRange.map((day) => day.used));
  const ahead = usages.filter((day) => day.date >= startOfDay(now));
  const next = ahead.find((day) => day.vacancies > day.used);
  return {
    days: inRange.length,
    vacancies,
    used,
    occupancy: percent(used, vacancies),
    freeAhead: sum(ahead.map((day) => day.vacancies - day.used)),
    nextOpenDay: next ? { dateText: next.dateText, remaining: next.vacancies - next.used } : null,
  };
}

// How many booked tutors did not come to their visit in the period.
export function noShowCount(requests: AnyRecord[], range: PeriodRange): number {
  return closedInRange(requests, range).filter(isNoShowRequest).length;
}

function occupancyItem(label: string, used: number, vacancies: number): ChartItem {
  return { label, value: percent(used, vacancies) ?? 0, detail: `Vagas ocupadas: ${formatNumber(used)} de ${formatNumber(vacancies)}` };
}

function occupancyBy(usages: DayUsage[], keyOf: (slot: SlotUsage, day: DayUsage) => string): Map<string, { used: number; vacancies: number }> {
  const totals = new Map<string, { used: number; vacancies: number }>();
  usages.forEach((day) => day.slots.forEach((slot) => {
    const key = keyOf(slot, day);
    const total = totals.get(key) || { used: 0, vacancies: 0 };
    totals.set(key, { used: total.used + slot.used, vacancies: total.vacancies + slot.vacancies });
  }));
  return totals;
}

export function occupancyByTime(usages: DayUsage[]): ChartItem[] {
  return [...occupancyBy(usages, (slot) => slot.time)]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([time, total]) => occupancyItem(time, total.used, total.vacancies));
}

export function occupancyByWeekday(usages: DayUsage[]): ChartItem[] {
  const totals = occupancyBy(usages, (_slot, day) => String(day.date.getDay()));
  return WEEK_ORDER
    .filter((weekday) => totals.has(String(weekday)))
    .map((weekday) => {
      const total = totals.get(String(weekday)) as { used: number; vacancies: number };
      return occupancyItem(WEEKDAY_SHORT_NAMES[weekday], total.used, total.vacancies);
    });
}

// Only when the agenda uses more than one place; with a single place the chart would repeat the overall occupancy.
export function occupancyByLocation(usages: DayUsage[]): ChartItem[] {
  const totals = occupancyBy(usages, (_slot, day) => day.location || NO_LOCATION_LABEL);
  if (totals.size < 2) return [];
  return [...totals]
    .sort(([, left], [, right]) => right.vacancies - left.vacancies)
    .map(([location, total]) => occupancyItem(location, total.used, total.vacancies));
}

// The share of the visits of the period whose tutor did not come, per agenda time.
export function noShowsByTime(requests: AnyRecord[], range: PeriodRange): ChartItem[] {
  const totals = new Map<string, { visits: number; noShows: number }>();
  closedInRange(requests, range).filter((request) => isCompletedRequest(request) || isNoShowRequest(request)).forEach((request) => {
    const time = String(request.scheduleSlotTime || "").trim() || NO_TIME_LABEL;
    const total = totals.get(time) || { visits: 0, noShows: 0 };
    totals.set(time, { visits: total.visits + 1, noShows: total.noShows + (isNoShowRequest(request) ? 1 : 0) });
  });
  return [...totals]
    .sort(([left], [right]) => {
      if (left === NO_TIME_LABEL) return 1;
      if (right === NO_TIME_LABEL) return -1;
      return left.localeCompare(right);
    })
    .map(([time, total]) => ({
      label: time,
      value: percent(total.noShows, total.visits) ?? 0,
      detail: `Faltaram ${formatNumber(total.noShows)} de ${pluralize(total.visits, "agendamento", "agendamentos")}`,
    }));
}

// The moment a request was registered, only when the stored value carries a time: a bare date would pile every older
// request at midnight.
function createdMomentOf(request: AnyRecord): Date | null {
  const raw = request.createdAt || request.created_at;
  if (raw instanceof Date) return raw;
  const text = String(raw || "");
  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text) ? parseAnyDate(text) : null;
}

export function hourBandLabel(column: number): string {
  return `das ${column * HOUR_BAND}h às ${(column + 1) * HOUR_BAND}h`;
}

// When the requests of the period were registered: weekday by two-hour band.
export function entryMatrix(requests: AnyRecord[], range: PeriodRange): MatrixData {
  const columns = Array.from({ length: 24 / HOUR_BAND }, (_, column) => `${column * HOUR_BAND}h`);
  const counts = WEEK_ORDER.map(() => columns.map(() => 0));
  arrivedInRange(requests, range).forEach((request) => {
    const created = createdMomentOf(request);
    if (created) counts[WEEK_ORDER.indexOf(created.getDay())][Math.floor(created.getHours() / HOUR_BAND)] += 1;
  });
  return { columns, rows: WEEK_ORDER.map((weekday, row) => ({ label: WEEKDAY_NAMES[weekday], values: counts[row] })) };
}
