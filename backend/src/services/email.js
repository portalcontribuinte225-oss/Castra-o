import { DeliveryStatus, DeliveryCode } from "../../../shared/notification-contract.js";
import { EmailVariable, getEmailUse } from "../../../shared/email-uses-contract.js";
import { buildEmailNotice } from "./notifications/email-notice-text.js";
import { resolveWhatsappField } from "./notifications/whatsapp-template-parameters.js";
import { deliveryFailure } from "./notifications/delivery-result.js";
import { isEmailAccountConfigured, readEmailAccount } from "./email-account.js";

// A bounded admission gate covers both reset and notification messages using the same EmailJS account.
export function createEmailSender({ fetchImpl = (...args) => globalThis.fetch(...args), loadAccount = () => readEmailAccount(), now = Date.now, timeoutMs = 5000,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  let lastStartedAt = -Infinity;
  let nextSlotReserved = false;
  return async function sendEmailTemplate({ toEmail, templateId, templateParams, expiresAt }) {
    const account = await loadAccount();
    if (!isEmailAccountConfigured(account) || !templateId) {
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
    if (expiresAt !== undefined && (!Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= now())) {
      return deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.PREPARATION_FAILED);
    }
    lastStartedAt = now();
    const body = {
      service_id: account.serviceId,
      template_id: templateId,
      user_id: account.publicKey,
      template_params: { ...templateParams, [EmailVariable.TO_EMAIL]: toEmail },
      accessToken: account.privateKey,
    };
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

// The agenda notices also carry date, time and place as separate variables, taken from the same safe whitelist WhatsApp uses.
export async function sendNotificationEmail({ toEmail, toName, event, request, templateId, identityParams = {} }, sender = sendEmailTemplate) {
  const { subject, message, ...outcome } = buildEmailNotice(event, request);
  const requestFields = Object.fromEntries((getEmailUse(event)?.requestFields || []).map((name) => [name, resolveWhatsappField(name, request)]));
  return sender({
    toEmail,
    templateId,
    templateParams: {
      [EmailVariable.TO_NAME]: toName || "Solicitante",
      [EmailVariable.EVENT]: event,
      [EmailVariable.PROTOCOL]: request.protocol || "",
      [EmailVariable.SUBJECT]: subject,
      [EmailVariable.MESSAGE]: message,
      ...outcome,
      ...requestFields,
      ...identityParams,
    },
  });
}
