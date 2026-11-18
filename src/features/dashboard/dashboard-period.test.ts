import { describe, expect, it } from "vitest";
import {
  DashboardPeriod,
  SeriesGrouping,
  daysBetween,
  isInRange,
  periodRange,
  previousPeriodRange,
  seriesGrouping,
  typedRangeOf,
} from "./dashboard-period";
import { averageSeries, countSeries } from "./time-series";
import { TEST_NOW } from "./dashboard-test-requests";

const NOTHING_TYPED = { from: "", to: "" };

describe("dashboard period", () => {
  it("counts a preset back from today and compares it with the span of the same length right before", () => {
    const current = periodRange(DashboardPeriod.LAST_30_DAYS, NOTHING_TYPED, TEST_NOW);
    const previous = previousPeriodRange(current, TEST_NOW);
    expect(current).toEqual({ start: new Date(2026, 9, 18), end: null });
    expect(previous).toEqual({ start: new Date(2026, 8, 17), end: new Date(2026, 9, 18) });
    expect(isInRange(new Date(2026, 9, 17, 23, 0), previous)).toBe(true);
    expect(isInRange(new Date(2026, 9, 18), previous)).toBe(false);
    expect(isInRange(null, current)).toBe(false);
  });

  it("runs a typed range from its first to its last day, in either order, and shows those days back", () => {
    const range = periodRange(DashboardPeriod.CUSTOM, { from: "2026-03-31", to: "2026-03-01" }, TEST_NOW);
    expect(range).toEqual({ start: new Date(2026, 2, 1), end: new Date(2026, 3, 1) });
    expect(isInRange(new Date(2026, 2, 31, 23, 59), range)).toBe(true);
    expect(isInRange(new Date(2026, 3, 1), range)).toBe(false);
    expect(typedRangeOf(range, TEST_NOW)).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(previousPeriodRange(range, TEST_NOW)).toEqual({ start: new Date(2026, 0, 29), end: new Date(2026, 2, 1) });
    expect(typedRangeOf(periodRange(DashboardPeriod.LAST_90_DAYS, NOTHING_TYPED, TEST_NOW), TEST_NOW)).toEqual({ from: "2026-08-19", to: "2026-11-17" });
  });

  it("groups by day up to a month, by week up to four months and by month beyond", () => {
    const grouping = (period: DashboardPeriod, typed = NOTHING_TYPED) => seriesGrouping(periodRange(period, typed, TEST_NOW), TEST_NOW);
    expect(grouping(DashboardPeriod.LAST_30_DAYS)).toBe(SeriesGrouping.DAY);
    expect(grouping(DashboardPeriod.LAST_90_DAYS)).toBe(SeriesGrouping.WEEK);
    expect(grouping(DashboardPeriod.LAST_12_MONTHS)).toBe(SeriesGrouping.MONTH);
    expect(grouping(DashboardPeriod.CUSTOM, { from: "2026-01-01", to: "2026-01-20" })).toBe(SeriesGrouping.DAY);
    expect(grouping(DashboardPeriod.CUSTOM, { from: "2024-01-01", to: "2026-01-20" })).toBe(SeriesGrouping.MONTH);
  });

  it("counts whole calendar days", () => {
    expect(daysBetween(new Date(2026, 10, 10, 23, 0), new Date(2026, 10, 11, 1, 0))).toBe(1);
    expect(daysBetween(new Date(2026, 10, 11), new Date(2026, 10, 10))).toBe(-1);
  });
});

describe("dashboard time series", () => {
  it("lists the months in calendar order, with zero where nothing happened, whatever the order of the records", () => {
    const range = periodRange(DashboardPeriod.CUSTOM, { from: "2026-08-01", to: "2026-11-30" }, TEST_NOW);
    const dates = [new Date(2026, 10, 3), new Date(2026, 7, 20), new Date(2026, 10, 1), null];
    expect(countSeries({ entries: dates }, range, SeriesGrouping.MONTH, TEST_NOW)).toEqual([
      { label: "ago/26", entries: 1 },
      { label: "set/26", entries: 0 },
      { label: "out/26", entries: 0 },
      { label: "nov/26", entries: 2 },
    ]);
  });

  it("stops a typed range that ended in the past at its last day", () => {
    const range = periodRange(DashboardPeriod.CUSTOM, { from: "2026-03-01", to: "2026-03-03" }, TEST_NOW);
    expect(countSeries({ entries: [new Date(2026, 2, 2, 10)] }, range, SeriesGrouping.DAY, TEST_NOW)).toEqual([
      { label: "01/03", entries: 0 },
      { label: "02/03", entries: 1 },
      { label: "03/03", entries: 0 },
    ]);
  });

  it("starts the weeks on Monday and keeps every week of the period", () => {
    const range = { start: new Date(2026, 10, 2), end: null };
    const points = countSeries({ entries: [new Date(2026, 10, 15), new Date(2026, 10, 16)] }, range, SeriesGrouping.WEEK, TEST_NOW);
    expect(points.map((point) => point.label)).toEqual(["02/11", "09/11", "16/11"]);
    expect(points.map((point) => point.entries)).toEqual([0, 1, 1]);
  });

  it("leaves a gap, not a zero, where an average has nothing to average", () => {
    const range = { start: new Date(2026, 10, 15), end: null };
    const points = averageSeries({ days: [{ date: new Date(2026, 10, 15), value: 4 }, { date: new Date(2026, 10, 15), value: 6 }] }, range, SeriesGrouping.DAY, TEST_NOW);
    expect(points.map((point) => point.days)).toEqual([5, null, null]);
  });
});
