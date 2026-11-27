import { NotificationEvent, NotificationChannel, DeliveryStatus, DeliveryCode, rejectionReasonText } from "../../../../shared/notification-contract.js";
import { WhatsappTemplateField } from "../../../../shared/whatsapp-templates-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig, sendWhatsappTemplateComponents, toE164Brazil } from "../whatsapp.js";
import { isWhatsappReady, usesWhatsapp } from "../whatsapp-credentials.js";
import { resolveActiveTemplate } from "../whatsapp-active-templates.js";
import { markCatalogTemplateStatus } from "../whatsapp-catalog.js";
import { sendResolvedTemplate } from "../whatsapp-template-sender.js";
import { checkAndConsumeQuota } from "../message-quota.js";
import { sendNotificationEmail } from "../email.js";
import { loadEmailIdentityParams } from "../email-identity.js";
import { resolveEmailTemplate } from "../email-templates.js";
import { sendSmsUse } from "../sms-integration-settings.js";
import { buildNotificationMessage } from "./notification-message.js";
import { buildBodyComponents, resolveWhatsappField } from "./whatsapp-template-parameters.js";
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

// One channel failing, even by an exception, never keeps the others from being tried.
async function attempt(event, channel, task) {
  try {
    return await task();
  } catch {
    return { event, channel, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) };
  }
}

async function deliverWhatsapp({ event, request, phone, runtime, template }, dependencies) {
  const channel = NotificationChannel.WHATSAPP;
  const content = buildNotificationMessage(event, request);
  const components = buildBodyComponents(template.fields, { ...request, notification_message: content.message });
  const quota = await dependencies.consumeQuota(channel, request.municipality_id);
  if (!quota.allowed) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE) };
  const transport = await sendResolvedTemplate({ municipalityId: request.municipality_id, runtime, template, phone, components }, dependencies);
  return sanitizedTransportResult(event, channel, transport);
}

// Each channel answers `null` when the municipality does not use it for this notice (channel off, no template or switch for the
// notice, no contact to reach), so only the channels in use leave a result in the request history.
async function tryWhatsapp({ event, request, followUp }, dependencies) {
  const channel = NotificationChannel.WHATSAPP;
  const raw = await dependencies.loadWhatsappConfig(request.municipality_id);
  if (!usesWhatsapp(raw) || !followUp.phone) return null;
  const resolved = await dependencies.resolveTemplate(request.municipality_id, event);
  if (!resolved.ok && resolved.code === DeliveryCode.NOT_CONFIGURED) return null;
  if (!resolved.ok) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, resolved.code) };
  if (!toE164Brazil(followUp.phone)) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.INVALID_RECIPIENT) };
  const runtime = getRuntimeConfig(raw);
  if (!isWhatsappReady(runtime)) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.NOT_CONFIGURED) };
  return deliverWhatsapp({ event, request, phone: followUp.phone, runtime, template: resolved.template }, dependencies);
}

async function tryEmail({ event, request, followUp }, dependencies) {
  if (!followUp.email) return null;
  const channel = NotificationChannel.EMAIL;
  const resolved = await dependencies.resolveEmailTemplate({ municipalityId: request.municipality_id, use: event });
  if (!resolved.ok && resolved.code === DeliveryCode.CHANNEL_DISABLED) return null;
  if (!resolved.ok) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, resolved.code) };
  const identityParams = await dependencies.loadEmailIdentity(request.municipality_id);
  const quota = await dependencies.consumeQuota(channel, request.municipality_id);
  if (!quota.allowed) return { event, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, DeliveryCode.QUOTA_UNAVAILABLE) };
  const transport = await dependencies.sendEmail({
    toEmail: followUp.email,
    toName: request.tutor_name,
    event,
    request,
    templateId: resolved.templateId,
    identityParams,
  });
  return sanitizedTransportResult(event, channel, transport);
}

// Only the fields used in the SMS text are shared with the sender.
function smsNoticeData(event, request) {
  const field = (name) => resolveWhatsappField(name, request);
  const workflow = request.workflow_data || request.workflowData || {};
  const rejection = event === NotificationEvent.REQUEST_REJECTED
    ? { reason: rejectionReasonText(workflow), ...(request.procedure_name ? { procedure: request.procedure_name } : {}) } : {};
  return {
    protocol: request.protocol,
    date: field(WhatsappTemplateField.SCHEDULE_DATE),
    time: event === NotificationEvent.SCHEDULE_CANCELLED || event === NotificationEvent.SCHEDULE_REMINDER
      ? workflow.scheduleSlotTime || workflow.scheduleTime || request.schedule_time : field(WhatsappTemplateField.SCHEDULE_TIME),
    location: field(WhatsappTemplateField.SCHEDULE_LOCATION_NAME),
    ...rejection,
  };
}

async function trySms({ event, request, followUp }, dependencies) {
  if (!followUp.phone) return null;
  const sent = await dependencies.sendSms({ municipalityId: request.municipality_id, use: event, phone: followUp.phone, data: smsNoticeData(event, request) });
  if (sent?.status === DeliveryStatus.SKIPPED && sent.code === DeliveryCode.CHANNEL_DISABLED) return null;
  return sanitizedTransportResult(event, NotificationChannel.SMS, sent);
}

// Only a request whose tutor turned follow-up on is notified.
export async function dispatchNotification({ event, request }, overrides = {}) {
  if (!Object.values(NotificationEvent).includes(event)) return [];
  const followUp = (request.workflow_data || request.workflowData || {}).followUp;
  if (followUp?.enabled !== true) return [];
  const dependencies = {
    loadWhatsappConfig: getMunicipalityWhatsappConfig,
    resolveTemplate: resolveActiveTemplate,
    markTemplateStatus: markCatalogTemplateStatus,
    consumeQuota: checkAndConsumeQuota,
    sendWhatsapp: sendWhatsappTemplateComponents,
    sendEmail: sendNotificationEmail,
    resolveEmailTemplate,
    loadEmailIdentity: loadEmailIdentityParams,
    sendSms: sendSmsUse,
    ...overrides,
  };
  // Every channel the municipality uses for this notice sends on its own: a failure in one never stops the others.
  const channels = [[NotificationChannel.EMAIL, tryEmail], [NotificationChannel.WHATSAPP, tryWhatsapp], [NotificationChannel.SMS, trySms]];
  const results = await Promise.all(channels.map(([channel, task]) =>
    attempt(event, channel, () => task({ event, request, followUp }, dependencies))));
  return results.filter(Boolean);
}
