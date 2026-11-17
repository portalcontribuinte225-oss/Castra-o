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
  ALL = "all",
}

export enum SeriesGrouping {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

// A span of time from `start` (inclusive) to `end` (exclusive). Without a start it reaches back to the first record;
// without an end it stays open, so the agenda days ahead still count.
export interface PeriodRange {
  start: Date | null;
  end: Date | null;
}

const DAY_MS = 86400000;

const PERIOD_DAYS: Record<DashboardPeriod, number | null> = {
  [DashboardPeriod.LAST_30_DAYS]: 30,
  [DashboardPeriod.LAST_90_DAYS]: 90,
  [DashboardPeriod.LAST_12_MONTHS]: 365,
  [DashboardPeriod.ALL]: null,
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

export function periodRange(period: DashboardPeriod, now = new Date()): PeriodRange {
  const days = PERIOD_DAYS[period];
  return { start: days === null ? null : addDays(startOfDay(now), -days), end: null };
}

// The span of the same length right before the period, to compare with; "all" has none.
export function previousPeriodRange(period: DashboardPeriod, now = new Date()): PeriodRange | null {
  const days = PERIOD_DAYS[period];
  if (days === null) return null;
  const start = addDays(startOfDay(now), -days);
  return { start: addDays(start, -days), end: start };
}

// Whether a date falls in a range; a record without a date only counts when the range has no limits at all.
export function isInRange(date: Date | null, range: PeriodRange): boolean {
  if (!range.start && !range.end) return true;
  if (!date) return false;
  return (!range.start || date >= range.start) && (!range.end || date < range.end);
}

// How the lines over time group their points: by day over 30 days, by week over 90, by month beyond.
export function seriesGrouping(period: DashboardPeriod): SeriesGrouping {
  if (period === DashboardPeriod.LAST_30_DAYS) return SeriesGrouping.DAY;
  if (period === DashboardPeriod.LAST_90_DAYS) return SeriesGrouping.WEEK;
  return SeriesGrouping.MONTH;
}
