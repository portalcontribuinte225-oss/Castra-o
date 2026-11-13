import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../../shared/notification-contract.js";

export interface NotificationResult {
  event?: typeof NotificationEvent[keyof typeof NotificationEvent];
  channel?: typeof NotificationChannel[keyof typeof NotificationChannel];
  status: typeof DeliveryStatus[keyof typeof DeliveryStatus];
  reason?: string;
}

export function getNotificationNotice(currentResults: NotificationResult[] = [], precedingResults: NotificationResult[] = []) {
  const results = [...precedingResults, ...(Array.isArray(currentResults) ? currentResults : [])];
  if (!results.length) return null;
  const sent = results.filter((result) => result.status === DeliveryStatus.SENT);
  const events = [...new Set(results.map((result) => result.event))];
  const hasUnsentEvent = events.some((event) => !sent.some((result) => result.event === event));
  if (hasUnsentEvent) {
    return { message: sent.length ? "A alteração foi salva, mas alguns avisos não puderam ser enviados. Verifique as configurações dos canais." : "A alteração foi salva, mas não foi possível enviar o aviso. Verifique as configurações dos canais.", type: "warning" as const };
  }
  if (sent.length) {
    const channelLabels = { [NotificationChannel.WHATSAPP]: "WhatsApp", [NotificationChannel.EMAIL]: "e-mail", [NotificationChannel.SMS]: "SMS" };
    const channels = [...new Set(sent.map((result) => channelLabels[result.channel]))];
    return { message: `Aviso aceito para envio por ${channels.join(" e ")}.`, type: "success" as const };
  }
  return null;
}
