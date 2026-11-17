import { SeriesGrouping, addDays, isInRange, startOfDay, type PeriodRange } from "./dashboard-period";
import { formatDayMonth, formatMonthYear } from "./dashboard-format";

// One point of a line over time: its label and, per series key, a value (null where an average has nothing to average).
export type SeriesPoint = { label: string } & Record<string, number | string | null>;

export interface DatedValue {
  date: Date | null;
  value: number;
}

interface Bucket {
  key: string;
  label: string;
}

// The first day of the bucket a date falls in: the day itself, the Monday of its week or the first of its month.
export function bucketStart(date: Date, grouping: SeriesGrouping): Date {
  const day = startOfDay(date);
  if (grouping === SeriesGrouping.DAY) return day;
  if (grouping === SeriesGrouping.WEEK) return addDays(day, -((day.getDay() + 6) % 7));
  return new Date(day.getFullYear(), day.getMonth(), 1);
}

function nextBucketStart(start: Date, grouping: SeriesGrouping): Date {
  if (grouping === SeriesGrouping.DAY) return addDays(start, 1);
  if (grouping === SeriesGrouping.WEEK) return addDays(start, 7);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function bucketKey(start: Date): string {
  return String(start.getTime());
}

function bucketLabel(start: Date, grouping: SeriesGrouping): string {
  return grouping === SeriesGrouping.MONTH ? formatMonthYear(start) : formatDayMonth(start);
}

// Every bucket from the start of the range (or the earliest date, for "all") up to now, in calendar order, so a stretch
// without records still shows.
function timeBuckets(dates: Date[], range: PeriodRange, grouping: SeriesGrouping, now: Date): Bucket[] {
  const earliest = dates.reduce<Date | null>((first, date) => (!first || date < first ? date : first), null);
  const last = bucketStart(now, grouping);
  const buckets: Bucket[] = [];
  for (let cursor = bucketStart(range.start || earliest || now, grouping); cursor <= last; cursor = nextBucketStart(cursor, grouping)) {
    buckets.push({ key: bucketKey(cursor), label: bucketLabel(cursor, grouping) });
  }
  return buckets;
}

function aggregateSeries(
  series: Record<string, DatedValue[]>,
  range: PeriodRange,
  grouping: SeriesGrouping,
  now: Date,
  reduce: (values: number[]) => number | null,
): SeriesPoint[] {
  const keys = Object.keys(series);
  const kept = keys.map((key) => series[key].filter((item) => item.date && isInRange(item.date, range) && item.date <= now));
  const buckets = timeBuckets(kept.flat().map((item) => item.date as Date), range, grouping, now);
  const positions = new Map(buckets.map((bucket, position) => [bucket.key, position]));
  const grouped = keys.map(() => buckets.map((): number[] => []));
  kept.forEach((items, serie) => items.forEach((item) => {
    const position = positions.get(bucketKey(bucketStart(item.date as Date, grouping)));
    if (position !== undefined) grouped[serie][position].push(item.value);
  }));
  return buckets.map((bucket, position) => {
    const point: SeriesPoint = { label: bucket.label };
    keys.forEach((key, serie) => { point[key] = reduce(grouped[serie][position]); });
    return point;
  });
}

// How many dates of each series fall in each bucket.
export function countSeries(series: Record<string, (Date | null)[]>, range: PeriodRange, grouping: SeriesGrouping, now = new Date()): SeriesPoint[] {
  const dated = Object.fromEntries(Object.entries(series).map(([key, dates]) => [key, dates.map((date) => ({ date, value: 1 }))]));
  return aggregateSeries(dated, range, grouping, now, (values) => values.length);
}

// The mean of each series per bucket; a bucket without values stays empty, a gap in the line rather than a zero.
export function averageSeries(series: Record<string, DatedValue[]>, range: PeriodRange, grouping: SeriesGrouping, now = new Date()): SeriesPoint[] {
  return aggregateSeries(series, range, grouping, now, (values) => (
    values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null
  ));
}
