import { describe, expect, it } from "vitest";
import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../../shared/notification-contract.js";
import { getNotificationNotice } from "./notification-results";

describe("notification action notices", () => {
  const event = NotificationEvent.SCHEDULE_CONFIRMED;
  it("reports provider acceptance using structured channel results", () => {
    const notice = getNotificationNotice([{ event, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SENT }]);
    expect(notice).toEqual({ message: "Aviso aceito para envio por WhatsApp.", type: "success" });
  });

  it("reports partial delivery when another configured channel fails without exposing provider errors", () => {
    const notice = getNotificationNotice([
      { event, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.FAILED, reason: "private provider response" },
      { event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT },
    ]);
    expect(notice?.message).toContain("e-mail");
    expect(notice?.message).not.toContain("private");
    expect(notice?.message).toContain("Alguns canais não enviaram o aviso");
    expect(notice?.type).toBe("warning");
  });

  it("keeps saved business operation separate from failed notification", () => {
    const notice = getNotificationNotice([{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED }]);
    expect(notice?.type).toBe("warning");
    expect(notice?.message).toContain("alteração foi salva");
    expect(getNotificationNotice([])).toBeNull();
  });

  it("reports unavailable channels and partial delivery across different events", () => {
    expect(getNotificationNotice([{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SKIPPED }])?.type).toBe("warning");
    const notice = getNotificationNotice([
      { event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT },
      { event: NotificationEvent.COMPLETED, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED },
    ]);
    expect(notice?.type).toBe("warning");
    expect(notice?.message).toContain("alguns avisos");
  });

  it("preserves an earlier notice failure when the following agenda update sends successfully", () => {
    const earlierResults = [{ event: NotificationEvent.REQUEST_REJECTED, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED }];
    const agendaResults = [{ event, channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SENT }];
    const notice = getNotificationNotice(agendaResults, earlierResults);
    expect(notice?.type).toBe("warning");
    expect(notice?.message).toContain("alguns avisos");
  });

  it("reports postcommit failures even without event or channel metadata", () => {
    expect(getNotificationNotice([{ status: DeliveryStatus.FAILED }])?.type).toBe("warning");
  });
});
