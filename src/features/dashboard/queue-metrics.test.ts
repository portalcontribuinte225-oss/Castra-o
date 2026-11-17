import { describe, expect, it } from "vitest";
import { NO_SHOW_CANCEL_REASON, REJECTED_CANCEL_REASON } from "../../../shared/notification-contract.js";
import { DashboardPeriod, periodRange } from "./dashboard-period";
import { TEST_NOW, testRequest } from "./dashboard-test-requests";
import { periodTotals, queueAlerts, volumeParts } from "./overview-metrics";
import { cancelCauses, conversionFunnel, queueAges } from "./queue-metrics";

const range = periodRange(DashboardPeriod.LAST_30_DAYS, TEST_NOW);

const completed = (day: string) => testRequest({ status: "REALIZADA", createdAt: "2026-11-01T09:00:00", preferredSchedule: day });
const noShow = (day: string) => testRequest({ status: "CANCELADA", preferredSchedule: day, workflow_data: { cancelReason: NO_SHOW_CANCEL_REASON } });
const rejected = () => testRequest({ status: "CANCELADA", updatedAt: "2026-11-12T10:00:00", workflow_data: { cancelReason: REJECTED_CANCEL_REASON } });

describe("dashboard overview numbers", () => {
  it("counts the no-shows from their cancel reason and measures attendance against them only", () => {
    const requests = [completed("05/11/2026"), completed("06/11/2026"), completed("07/11/2026"), noShow("08/11/2026"), rejected()];
    const totals = periodTotals(requests, range);
    expect(totals.completed).toBe(3);
    expect(totals.attendanceRate).toBe(75);
  });

  it("dates a completion by its visit, so a request that arrived long ago still counts in the period of its visit", () => {
    const old = testRequest({ status: "REALIZADA", createdAt: "2026-05-01T09:00:00", preferredSchedule: "10/11/2026" });
    const totals = periodTotals([old], range);
    expect(totals.entries).toBe(0);
    expect(totals.completed).toBe(1);
    expect(totals.averageDaysToComplete).toBe(193);
  });

  it("has no attendance when nobody was due to come", () => {
    expect(periodTotals([testRequest()], range).attendanceRate).toBeNull();
  });

  it("splits the volume into today's queue and what ended in the period", () => {
    const requests = [testRequest(), testRequest({ status: "AGENDADA" }), completed("05/11/2026"), rejected()];
    expect(volumeParts(requests, range).map((part) => part.value)).toEqual([1, 1, 1, 1]);
  });

  it("raises the alerts on today's queue whatever the period", () => {
    const requests = [
      testRequest({ createdAt: "2026-01-05T08:00:00" }),
      testRequest({ responsible: "Pessoa Teste", phone: "", createdAt: "2026-11-15T10:00:00" }),
      completed("05/11/2026"),
    ];
    expect(queueAlerts(requests, TEST_NOW).map((alert) => alert.value)).toEqual([1, 1, 1]);
  });
});

describe("dashboard queue", () => {
  it("bands the open requests by how long they have been waiting", () => {
    const requests = [
      testRequest({ createdAt: "2026-11-16T08:00:00" }),
      testRequest({ createdAt: "2026-11-12T08:00:00" }),
      testRequest({ createdAt: "2026-11-05T08:00:00" }),
      testRequest({ createdAt: "2026-10-01T08:00:00" }),
      completed("05/11/2026"),
    ];
    expect(queueAges(requests, TEST_NOW).map((band) => band.value)).toEqual([1, 1, 1, 1]);
  });

  it("shows how far the requests of the period got, a no-show counting as booked", () => {
    const requests = [testRequest(), testRequest({ status: "AGENDADA" }), testRequest({ status: "REALIZADA", preferredSchedule: "12/11/2026" }), noShow("13/11/2026")];
    expect(conversionFunnel(requests, range).map((stage) => stage.value)).toEqual([100, 75, 25]);
    expect(conversionFunnel([], range)).toEqual([]);
  });

  it("tells rejections and no-shows from other cancellations", () => {
    const requests = [rejected(), noShow("08/11/2026"), testRequest({ status: "CANCELADA", updatedAt: "2026-11-11T10:00:00" })];
    expect(cancelCauses(requests, range).map((cause) => cause.value)).toEqual([1, 1, 1]);
  });
});
