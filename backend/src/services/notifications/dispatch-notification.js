import { NotificationEvent, NotificationChannel, DeliveryStatus, DeliveryCode, normalizeNotificationConfig } from "../../../../shared/notification-contract.js";
import { WHATSAPP_APPROVED_STATUS } from "../../../../shared/whatsapp-binding-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig, sendWhatsappTemplateComponents, toE164Brazil } from "../whatsapp.js";
import { loadEventBinding } from "../whatsapp-bindings.js";
import { markCatalogTemplateStatus } from "../whatsapp-catalog.js";
import { checkAndConsumeQuota } from "../whatsappQuota.js";
import { sendNotificationEmail } from "../email.js";
import { buildNotificationMessage } from "./notification-message.js";
import { buildBodyComponents } from "./whatsapp-template-parameters.js";
import { deliveryFailure, knownDeliveryCode } from "./delivery-result.js";

function result(event, channel, status, reason = "") {
  return { event, channel, status, ...(reason ? { reason } : {}) };
}

function sanitizedTransportResult(event, channel, value) {
  if (value?.status === DeliveryStatus.SENT) return result(event, channel, DeliveryStatus.SENT);
  const status = value?.status === DeliveryStatus.SKIPPED ? DeliveryStatus.SKIPPED : DeliveryStatus.FAILED;
  if (knownDeliveryCode(value?.code)) return { event, channel, ...deliveryFailure(status, value.code) };
  // Transport errors can contain credentials, destinations or provider response bodies.
  return result(event, channel, status, status === DeliveryStatus.SKIPPED
    ? "Canal indisponível: verifique destinatário, credenciais e template."
    : "O provedor não aceitou a mensagem ou o prazo de envio foi excedido.");
}

// A template known to the catalog is sent only while approved and with the variables the binding maps.
function templateIsUsable(template, binding) {
  return !template || (template.status === WHATSAPP_APPROVED_STATUS && template.variableCount === binding.mapping.length);
}

async function rememberTemplateStatus(dependencies, request, binding, status) {
  try {
    await dependencies.markTemplateStatus(request.municipality_id, binding.templateName, binding.languageCode, status);
  } catch {
    // The send result is already known; the next synchronization corrects the cache.
  }
}

async function tryWhatsapp({ event, request, legacy, phone }, dependencies) {
  const channel = NotificationChannel.WHATSAPP;
  const raw = await dependencies.loadWhatsappConfig(request.municipality_id);
  if (legacy ? raw.active === false : raw.active !== true) {
    return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.CHANNEL_DISABLED) };
  }
  if (!toE164Brazil(phone)) {
    return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.INVALID_RECIPIENT) };
  }
  const runtime = getRuntimeConfig(raw);
  if (runtime.provider !== "cloud_api" || !runtime.accessToken || !runtime.phoneNumberId) {
    return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED) };
  }
  const { binding, template } = await dependencies.loadBinding(request.municipality_id, event);
  if (!binding) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED) };
  if (!templateIsUsable(template, binding)) {
    return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.TEMPLATE_UNAVAILABLE) };
  }
  const content = buildNotificationMessage(event, request);
  const components = buildBodyComponents(binding, { ...request, notification_message: content.message });
  const quota = await dependencies.consumeQuota(request.municipality_id);
  if (!quota.allowed) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE) };
  const transport = await dependencies.sendWhatsapp(
    { ...runtime, templateName: binding.templateName, languageCode: binding.languageCode }, phone, components,
  );
  if (transport?.templateStatus) await rememberTemplateStatus(dependencies, request, binding, transport.templateStatus);
  return sanitizedTransportResult(event, channel, transport);
}

export async function dispatchNotification({ event, request, config: inputConfig, legacy = false }, overrides = {}) {
  if (!Object.values(NotificationEvent).includes(event)) return [];
  const followUp = (request.workflow_data || request.workflowData || {}).followUp;
  if (followUp?.enabled === false) return [];
  const legacyEvent = event === NotificationEvent.SCHEDULE_CONFIRMED || event === NotificationEvent.SCHEDULE_CHANGED;
  if (legacy && !legacyEvent) return [];
  if (!legacy && followUp?.enabled !== true) return [];
  const dependencies = {
    loadWhatsappConfig: getMunicipalityWhatsappConfig,
    loadBinding: loadEventBinding,
    markTemplateStatus: markCatalogTemplateStatus,
    consumeQuota: checkAndConsumeQuota,
    sendWhatsapp: sendWhatsappTemplateComponents,
    sendEmail: sendNotificationEmail,
    ...overrides,
  };
  const config = normalizeNotificationConfig(inputConfig);
  const results = [];
  try {
    results.push(await tryWhatsapp({ event, request, legacy, phone: legacy ? request.phone : followUp.phone }, dependencies));
  } catch {
    results.push({ event, channel: NotificationChannel.WHATSAPP, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) });
  }
  if (results[0].status === DeliveryStatus.SENT || legacy) return results;
  if (!config.emailTemplateId) {
    results.push({ event, channel: NotificationChannel.EMAIL, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED) });
    return results;
  }
  try {
    const transport = await dependencies.sendEmail({
      toEmail: followUp.email,
      toName: request.tutor_name,
      event,
      request,
      templateId: config.emailTemplateId,
    });
    results.push(sanitizedTransportResult(event, NotificationChannel.EMAIL, transport));
  } catch {
    results.push({ event, channel: NotificationChannel.EMAIL, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) });
  }
  return results;
}
