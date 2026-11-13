import { DeliveryStatus, DeliveryCode } from "../../../shared/notification-contract.js";
import { buildNotificationMessage } from "./notifications/notification-message.js";
import { deliveryFailure } from "./notifications/delivery-result.js";

// A bounded admission gate covers both reset and notification messages using the same EmailJS account.
export function createEmailSender({ fetchImpl = globalThis.fetch, env = process.env, now = Date.now, timeoutMs = 5000,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  let lastStartedAt = -Infinity;
  let nextSlotReserved = false;
  return async function sendEmailTemplate({ toEmail, templateId, templateParams }) {
    if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY || !templateId) {
      return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED);
    }
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.INVALID_RECIPIENT);
    }
    if (nextSlotReserved) {
      return deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.RATE_LIMITED);
    }
    const delay = Math.min(1000, Math.max(0, 1000 - (now() - lastStartedAt)));
    if (delay > 0) {
      nextSlotReserved = true;
      try {
        await wait(delay);
      } catch {
        return deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.RATE_LIMITED);
      } finally {
        nextSlotReserved = false;
      }
    }
    lastStartedAt = now();
    const body = {
      service_id: env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: env.EMAILJS_PUBLIC_KEY,
      template_params: { ...templateParams, to_email: toEmail },
    };
    if (env.EMAILJS_PRIVATE_KEY) body.accessToken = env.EMAILJS_PRIVATE_KEY;
    try {
      const response = await fetchImpl("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        return deliveryFailure(DeliveryStatus.FAILED, response.status === 429 ? DeliveryCode.RATE_LIMITED : DeliveryCode.PROVIDER_REJECTED);
      }
      return { status: DeliveryStatus.SENT };
    } catch (error) {
      return deliveryFailure(DeliveryStatus.FAILED, ["AbortError", "TimeoutError"].includes(error?.name) ? DeliveryCode.TIMEOUT : DeliveryCode.TRANSPORT_FAILED);
    }
  };
}

export const sendEmailTemplate = createEmailSender();

export async function sendNotificationEmail({ toEmail, toName, event, request, templateId }, sender = sendEmailTemplate) {
  const content = buildNotificationMessage(event, request);
  return sender({
    toEmail,
    templateId,
    templateParams: { to_name: toName || "Solicitante", event, protocol: request.protocol || "", subject: content.subject, message: content.message },
  });
}
