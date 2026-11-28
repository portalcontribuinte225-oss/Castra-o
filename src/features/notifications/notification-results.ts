import { DeliveryStatus, NotificationChannel } from "../../../shared/notification-contract.js";
import type { ToastNotice } from "../../components/toast-container";

export interface NotificationResult {
  channel?: typeof NotificationChannel[keyof typeof NotificationChannel];
  status: typeof DeliveryStatus[keyof typeof DeliveryStatus];
}

interface NotificationFeedback {
  notificationResults?: NotificationResult[];
  notificationDispatchFailed?: boolean;
  notificationHistoryFailed?: boolean;
}

const channelLabels = {
  [NotificationChannel.EMAIL]: "e-mail",
  [NotificationChannel.WHATSAPP]: "WhatsApp",
  [NotificationChannel.SMS]: "SMS",
};
const channelList = new Intl.ListFormat("pt-BR");

function channelsWithStatus(results: NotificationResult[], status: NotificationResult["status"]) {
  const labels = results.filter((result) => result.status === status && result.channel)
    .map(({ channel }) => channel && channelLabels[channel]).filter(Boolean);
  return channelList.format([...new Set(labels)]);
}

export function buildActionNotice(title: string, feedback: NotificationFeedback = {}, detail?: string): ToastNotice {
  const results = Array.isArray(feedback.notificationResults) ? feedback.notificationResults : [];
  const failed = channelsWithStatus(results, DeliveryStatus.FAILED);
  const unavailable = channelsWithStatus(results, DeliveryStatus.SKIPPED);
  const dispatchFailed = feedback.notificationDispatchFailed || results.some((result) =>
    result.status !== DeliveryStatus.SENT && !Object.values(NotificationChannel).includes(result.channel));
  const sendIssue = Boolean(failed || unavailable || dispatchFailed);
  const accepted = sendIssue ? channelsWithStatus(results, DeliveryStatus.SENT) : "";
  const details = [
    detail,
    accepted && `Envio aceito por ${accepted}.`,
    unavailable && `Envio indisponível por ${unavailable}.`,
    failed && `Falha no envio por ${failed}.`,
    dispatchFailed && "Não foi possível concluir todos os avisos.",
    feedback.notificationHistoryFailed && "Não foi possível gravar o histórico do envio.",
  ].filter(Boolean);

  return {
    title,
    tone: sendIssue || feedback.notificationHistoryFailed ? "warning" : "success",
    ...(details.length && { detail: details.join(" ") }),
  };
}
