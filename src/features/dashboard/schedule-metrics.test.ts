import { describe, expect, it } from "vitest";
import { NO_SHOW_CANCEL_REASON } from "../../../shared/notification-contract.js";
import { DashboardPeriod, periodRange } from "./dashboard-period";
import { TEST_NOW, testRequest } from "./dashboard-test-requests";
import { NO_TIME_LABEL, dayUsages, entryMatrix, noShowsByTime, occupancyByLocation, occupancyByTime, occupancyByWeekday, scheduleSummary } from "./schedule-metrics";

const range = periodRange(DashboardPeriod.LAST_30_DAYS, TEST_NOW);

const agendaDay = (date: string, slots: { time: string; vacancies: number }[], locationName = "Clínica Teste") => ({ date, slots, locationName, active: true });
const twoAnimals = [{ name: "A" }, { name: "B" }];

describe("dashboard agenda", () => {
  it("fills the places by animal and by time, with the agenda's own rule, counting no-shows and freeing other cancellations", () => {
    const days = [agendaDay("10/11/2026", [{ time: "08:00", vacancies: 4 }, { time: "10:00", vacancies: 2 }])];
    const requests = [
      testRequest({ status: "AGENDADA", preferredSchedule: "10/11/2026", scheduleSlotTime: "08:00", animals: twoAnimals }),
      testRequest({ status: "CANCELADA", preferredSchedule: "10/11/2026", scheduleSlotTime: "10:00", workflow_data: { cancelReason: NO_SHOW_CANCEL_REASON } }),
      testRequest({ status: "CANCELADA", preferredSchedule: "10/11/2026", scheduleSlotTime: "10:00" }),
    ];
    const [usage] = dayUsages(days, requests);
    expect(usage.used).toBe(3);
    expect(usage.slots.map((slot) => slot.used)).toEqual([2, 1]);
    expect(occupancyByTime([usage]).map((item) => [item.label, item.value])).toEqual([["08:00", 50], ["10:00", 50]]);
  });

  it("sums the period and finds the next day from today that still has a place", () => {
    const days = [
      agendaDay("10/11/2026", [{ time: "08:00", vacancies: 2 }]),
      agendaDay("20/11/2026", [{ time: "08:00", vacancies: 1 }]),
      agendaDay("25/11/2026", [{ time: "08:00", vacancies: 3 }]),
    ];
    const requests = [
      testRequest({ status: "AGENDADA", preferredSchedule: "10/11/2026" }),
      testRequest({ status: "AGENDADA", preferredSchedule: "20/11/2026" }),
    ];
    const summary = scheduleSummary(dayUsages(days, requests), range, TEST_NOW);
    expect(summary).toMatchObject({ days: 3, vacancies: 6, used: 2, occupancy: 33 });
    expect(summary.nextOpenDay).toEqual({ dateText: "25/11/2026", remaining: 3 });
  });

  it("groups the occupancy by weekday, Monday first, and by place only when there is more than one", () => {
    const monday = agendaDay("16/11/2026", [{ time: "08:00", vacancies: 2 }], "Clínica A");
    const saturday = agendaDay("14/11/2026", [{ time: "08:00", vacancies: 2 }], "Clínica B");
    const usages = dayUsages([monday, saturday], [testRequest({ status: "AGENDADA", preferredSchedule: "16/11/2026" })]);
    expect(occupancyByWeekday(usages).map((item) => [item.label, item.value])).toEqual([["Seg", 50], ["Sáb", 0]]);
    expect(occupancyByLocation(usages)).toHaveLength(2);
    expect(occupancyByLocation(dayUsages([monday], []))).toEqual([]);
  });

  it("measures the no-shows per agenda time, the visits without a time last", () => {
    const requests = [
      testRequest({ status: "REALIZADA", preferredSchedule: "10/11/2026", scheduleSlotTime: "08:00" }),
      testRequest({ status: "CANCELADA", preferredSchedule: "10/11/2026", scheduleSlotTime: "08:00", workflow_data: { cancelReason: NO_SHOW_CANCEL_REASON } }),
      testRequest({ status: "REALIZADA", preferredSchedule: "11/11/2026" }),
    ];
    expect(noShowsByTime(requests, range).map((item) => [item.label, item.value])).toEqual([["08:00", 50], [NO_TIME_LABEL, 0]]);
  });

  it("places each request of the period on its weekday and two-hour band, skipping dates without a time", () => {
    const requests = [
      testRequest({ createdAt: "2026-11-16T09:30:00" }),
      testRequest({ createdAt: "2026-11-16T08:05:00" }),
      testRequest({ createdAt: "2026-11-15" }),
    ];
    const matrix = entryMatrix(requests, range);
    expect(matrix.columns).toHaveLength(12);
    expect(matrix.rows[0].label).toBe("Segunda");
    expect(matrix.rows[0].values[4]).toBe(2);
    expect(matrix.rows.flatMap((row) => row.values).reduce((total, value) => total + value, 0)).toBe(2);
  });
});
