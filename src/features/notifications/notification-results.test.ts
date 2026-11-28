import { describe, expect, it } from "vitest";
import { DeliveryStatus, NotificationChannel } from "../../../shared/notification-contract.js";
import { buildActionNotice } from "./notification-results";

describe("action feedback", () => {
  const title = "Reagendamento salvo";
  const accepted = { channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT };

  it("only shows the action result when there is nothing to correct about delivery", () => {
    for (const notificationResults of [[], [accepted]]) {
      expect(buildActionNotice(title, { notificationResults })).toEqual({ title, tone: "success" });
    }
  });

  it("names the accepted, unavailable and failed channels without showing provider responses", () => {
    const unavailable = { channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SKIPPED };
    const failed = { channel: NotificationChannel.SMS, status: DeliveryStatus.FAILED, reason: "private provider response" };
    expect(buildActionNotice(title, { notificationResults: [accepted, unavailable, unavailable, failed] })).toEqual({
      title, tone: "warning",
      detail: "Envio aceito por e-mail. Envio indisponível por WhatsApp. Falha no envio por SMS.",
    });
  });

  it("keeps the successful action title when delivery fails entirely", () => {
    expect(buildActionNotice(title, { notificationResults: [{ channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED }] }))
      .toEqual({ title, tone: "warning", detail: "Falha no envio por e-mail." });
  });

  it("distinguishes history and general dispatch failures from channel failures", () => {
    expect(buildActionNotice(title, { notificationHistoryFailed: true, notificationResults: [accepted] })).toEqual({
      title, tone: "warning", detail: "Não foi possível gravar o histórico do envio.",
    });
    expect(buildActionNotice(title, { notificationDispatchFailed: true })).toEqual({
      title, tone: "warning", detail: "Não foi possível concluir todos os avisos.",
    });
  });

  it("preserves the next step for a replacement reservation without a notice", () => {
    expect(buildActionNotice("Reserva atualizada", {}, "Aguardando confirmação da agenda.")).toEqual({
      title: "Reserva atualizada", tone: "success", detail: "Aguardando confirmação da agenda.",
    });
  });
});
