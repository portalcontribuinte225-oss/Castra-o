export enum DashboardTab {
  OVERVIEW = "overview",
  QUEUE = "queue",
  SCHEDULE = "schedule",
  NEIGHBORHOODS = "neighborhoods",
  TEAM = "team",
  ANIMALS = "animals",
}

export enum DashboardPeriod {
  LAST_30_DAYS = "30-days",
  LAST_90_DAYS = "90-days",
  LAST_12_MONTHS = "12-months",
  CUSTOM = "custom",
}

export enum SeriesGrouping {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

// A span of time from `start` (inclusive) to `end` (exclusive). A preset has no end, so the agenda days ahead still count;
// a range typed by hand ends the day after its last day.
export interface PeriodRange {
  start: Date;
  end: Date | null;
}

// The two days typed in the period fields, as the date inputs give them ("yyyy-mm-dd").
export interface TypedRange {
  from: string;
  to: string;
}

const DAY_MS = 86400000;

const PRESET_DAYS: Record<Exclude<DashboardPeriod, DashboardPeriod.CUSTOM>, number> = {
  [DashboardPeriod.LAST_30_DAYS]: 30,
  [DashboardPeriod.LAST_90_DAYS]: 90,
  [DashboardPeriod.LAST_12_MONTHS]: 365,
};

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Whole calendar days from one date to another; negative when the second comes first.
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toInputDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromInputDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

// The span a choice covers: a preset counts back from today; typed days run from the first to the last, whichever order
// they came in.
export function periodRange(period: DashboardPeriod, typed: TypedRange, now = new Date()): PeriodRange {
  if (period !== DashboardPeriod.CUSTOM) return { start: addDays(startOfDay(now), -PRESET_DAYS[period]), end: null };
  const from = fromInputDate(typed.from) || startOfDay(now);
  const to = fromInputDate(typed.to) || startOfDay(now);
  const [first, last] = from <= to ? [from, to] : [to, from];
  return { start: first, end: addDays(last, 1) };
}

// The span of the same length right before, to compare with.
export function previousPeriodRange(range: PeriodRange, now = new Date()): PeriodRange {
  const length = daysBetween(range.start, range.end || addDays(startOfDay(now), 1));
  return { start: addDays(range.start, -length), end: range.start };
}

// The days the period fields show for a range: its first day and its last (today, for a preset).
export function typedRangeOf(range: PeriodRange, now = new Date()): TypedRange {
  return { from: toInputDate(range.start), to: toInputDate(range.end ? addDays(range.end, -1) : now) };
}

export function isInRange(date: Date | null, range: PeriodRange): boolean {
  return Boolean(date) && (date as Date) >= range.start && (!range.end || (date as Date) < range.end);
}

// How the lines over time group their points: by day up to a month, by week up to four months, by month beyond.
export function seriesGrouping(range: PeriodRange, now = new Date()): SeriesGrouping {
  const days = daysBetween(range.start, range.end || addDays(startOfDay(now), 1));
  if (days <= 31) return SeriesGrouping.DAY;
  if (days <= 120) return SeriesGrouping.WEEK;
  return SeriesGrouping.MONTH;
}
