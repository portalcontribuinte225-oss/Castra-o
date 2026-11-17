import { describe, expect, it } from "vitest";
import { DashboardPeriod, SeriesGrouping, daysBetween, isInRange, periodRange, previousPeriodRange, seriesGrouping } from "./dashboard-period";
import { countSeries, averageSeries } from "./time-series";
import { TEST_NOW } from "./dashboard-test-requests";

describe("dashboard period", () => {
  it("compares a period with the span of the same length right before it", () => {
    const current = periodRange(DashboardPeriod.LAST_30_DAYS, TEST_NOW);
    const previous = previousPeriodRange(DashboardPeriod.LAST_30_DAYS, TEST_NOW);
    expect(current.start).toEqual(new Date(2026, 9, 18));
    expect(current.end).toBeNull();
    expect(previous).toEqual({ start: new Date(2026, 8, 18), end: new Date(2026, 9, 18) });
    expect(isInRange(new Date(2026, 9, 17, 23, 0), previous!)).toBe(true);
    expect(isInRange(new Date(2026, 9, 18), previous!)).toBe(false);
  });

  it("has no previous period for everything, and counts records without a date only there", () => {
    expect(previousPeriodRange(DashboardPeriod.ALL, TEST_NOW)).toBeNull();
    expect(isInRange(null, periodRange(DashboardPeriod.ALL, TEST_NOW))).toBe(true);
    expect(isInRange(null, periodRange(DashboardPeriod.LAST_90_DAYS, TEST_NOW))).toBe(false);
  });

  it("groups by day over 30 days, by week over 90 and by month beyond", () => {
    expect(seriesGrouping(DashboardPeriod.LAST_30_DAYS)).toBe(SeriesGrouping.DAY);
    expect(seriesGrouping(DashboardPeriod.LAST_90_DAYS)).toBe(SeriesGrouping.WEEK);
    expect(seriesGrouping(DashboardPeriod.LAST_12_MONTHS)).toBe(SeriesGrouping.MONTH);
    expect(seriesGrouping(DashboardPeriod.ALL)).toBe(SeriesGrouping.MONTH);
  });

  it("counts whole calendar days", () => {
    expect(daysBetween(new Date(2026, 10, 10, 23, 0), new Date(2026, 10, 11, 1, 0))).toBe(1);
    expect(daysBetween(new Date(2026, 10, 11), new Date(2026, 10, 10))).toBe(-1);
  });
});

describe("dashboard time series", () => {
  it("lists the months in calendar order, with zero where nothing happened, whatever the order of the records", () => {
    const dates = [new Date(2026, 10, 3), new Date(2026, 7, 20), new Date(2026, 10, 1), null];
    const points = countSeries({ entries: dates }, periodRange(DashboardPeriod.ALL, TEST_NOW), SeriesGrouping.MONTH, TEST_NOW);
    expect(points).toEqual([
      { label: "ago/26", entries: 1 },
      { label: "set/26", entries: 0 },
      { label: "out/26", entries: 0 },
      { label: "nov/26", entries: 2 },
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
