import { AuthPurpose, AUTH_CHALLENGE_SECONDS } from "../../../../shared/auth-contract.js";
import { NotificationChannel, DeliveryStatus, DeliveryCode } from "../../../../shared/notification-contract.js";
import { EmailVariable } from "../../../../shared/email-uses-contract.js";
import { getSmsUse } from "../../../../shared/sms-uses-contract.js";
import { sendEmailTemplate } from "../email.js";
import { loadEmailIdentityParams } from "../email-identity.js";
import { resolveEmailTemplate } from "../email-templates.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig, sendWhatsappTemplateComponents, toE164Brazil } from "../whatsapp.js";
import { isWhatsappReady, usesWhatsapp } from "../whatsapp-credentials.js";
import { resolveActiveTemplate } from "../whatsapp-active-templates.js";
import { markCatalogTemplateStatus } from "../whatsapp-catalog.js";
import { sendResolvedTemplate } from "../whatsapp-template-sender.js";
import { checkAndConsumeQuota } from "../message-quota.js";
import { deliveryFailure, knownDeliveryCode } from "../notifications/delivery-result.js";
import { isGlobalUser } from "../../tenant.js";
import { sendSmsUse } from "../sms-integration-settings.js";

function safeResult(purpose, channel, value) {
  if (value?.status === DeliveryStatus.SENT) return { purpose, channel, status: DeliveryStatus.SENT };
  const status = value?.status === DeliveryStatus.SKIPPED ? DeliveryStatus.SKIPPED : DeliveryStatus.FAILED;
  return { purpose, channel, ...deliveryFailure(status, knownDeliveryCode(value?.code) ? value.code : DeliveryCode.TRANSPORT_FAILED) };
}

function unavailable(purpose, channel, code) {
  return { purpose, channel, ...deliveryFailure(DeliveryStatus.SKIPPED, code) };
}

function isVerification(purpose) {
  return purpose === AuthPurpose.VERIFY_EMAIL || purpose === AuthPurpose.VERIFY_PHONE;
}

function isRecoveryExpired(input) {
  if (input.purpose !== AuthPurpose.PASSWORD_RESET) return false;
  const expiresAt = new Date(input.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

// The data that changed, as the notice names it ("e-mail", "telefone"); the contact the tutor just confirmed.
function changedFieldsText(input) {
  return (Array.isArray(input.changedFields) ? input.changedFields : []).join(", ") || "contato";
}

function emailParameters(input) {
  const common = { [EmailVariable.TO_NAME]: input.user?.name || "Tutor", [EmailVariable.PURPOSE]: input.purpose };
  if (input.purpose === AuthPurpose.CONTACT_CHANGED) {
    const changed = changedFieldsText(input);
    return { ...common, [EmailVariable.CHANGED_FIELDS]: changed,
      [EmailVariable.MESSAGE]: `Seus dados cadastrais foram atualizados. Informações alteradas: ${changed}. Se você não reconhece essa alteração, entre em contato com nossa equipe.` };
  }
  return { ...common, [EmailVariable.CODE]: input.code, [EmailVariable.RECOVERY_CODE]: input.code, [EmailVariable.VALIDITY]: "10 minutos", [EmailVariable.VALIDITY_MINUTES]: "10" };
}

function whatsappComponents(input) {
  if (input.purpose === AuthPurpose.CONTACT_CHANGED) {
    return [{ type: "body", parameters: [{ type: "text", text: input.user?.name || "Tutor" }] }];
  }
  return [
    { type: "body", parameters: [{ type: "text", text: input.code }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.code }] },
  ];
}

async function tryWhatsapp(input, dependencies) {
  const channel = NotificationChannel.WHATSAPP;
  if (!toE164Brazil(input.phone)) return unavailable(input.purpose, channel, DeliveryCode.INVALID_RECIPIENT);
  const raw = await dependencies.loadWhatsappConfig(input.municipalityId);
  if (!usesWhatsapp(raw)) return unavailable(input.purpose, channel, DeliveryCode.CHANNEL_DISABLED);
  const runtime = getRuntimeConfig(raw);
  if (!isWhatsappReady(runtime)) return unavailable(input.purpose, channel, DeliveryCode.NOT_CONFIGURED);
  const resolved = await dependencies.resolveTemplate(input.municipalityId, input.purpose);
  if (!resolved.ok) return unavailable(input.purpose, channel, resolved.code);
  if (!(await dependencies.consumeQuota(channel, input.municipalityId)).allowed) return unavailable(input.purpose, channel, DeliveryCode.QUOTA_UNAVAILABLE);
  if (isRecoveryExpired(input)) return unavailable(input.purpose, channel, DeliveryCode.PREPARATION_FAILED);
  const sent = await sendResolvedTemplate(
    { municipalityId: input.municipalityId, runtime, template: resolved.template, phone: input.phone, components: whatsappComponents(input) }, dependencies,
  );
  return safeResult(input.purpose, channel, sent);
}

// `platform` is the staff recovery with no municipality: it uses the platform template, has no municipal switch and spends no contract.
async function tryEmail(input, dependencies, { platform = false } = {}) {
  const municipalityId = platform ? null : input.municipalityId;
  const resolved = await dependencies.resolveEmailTemplate({ municipalityId, use: input.purpose });
  if (!resolved.ok) return unavailable(input.purpose, NotificationChannel.EMAIL, resolved.code);
  if (isRecoveryExpired(input)) return unavailable(input.purpose, NotificationChannel.EMAIL, DeliveryCode.PREPARATION_FAILED);
  const identity = await dependencies.loadEmailIdentity(municipalityId);
  if (municipalityId && !(await dependencies.consumeQuota(NotificationChannel.EMAIL, municipalityId)).allowed) {
    return unavailable(input.purpose, NotificationChannel.EMAIL, DeliveryCode.QUOTA_UNAVAILABLE);
  }
  const sent = await dependencies.sendEmail({ toEmail: input.email, templateId: resolved.templateId, templateParams: { ...emailParameters(input), ...identity },
    ...(input.purpose === AuthPurpose.PASSWORD_RESET ? { expiresAt: input.expiresAt } : {}) });
  return safeResult(input.purpose, NotificationChannel.EMAIL, sent);
}

// What an SMS of this use needs besides the municipality name: the code, and how long it lasts (the rest of its challenge,
// or the usual validity when the use has no challenge of its own); the changed data for the contact notice.
function smsData(input) {
  const remaining = input.expiresAt ? new Date(input.expiresAt).getTime() - Date.now() : AUTH_CHALLENGE_SECONDS * 1000;
  return { code: input.code, minutes: String(Math.max(1, Math.ceil(remaining / 60000))),
    ...(input.purpose === AuthPurpose.CONTACT_CHANGED ? { fields: changedFieldsText(input) } : {}) };
}

// Answers `null` when the municipality does not use SMS for this message, so it leaves no result.
async function trySms(input, dependencies) {
  if (!getSmsUse(input.purpose)) return null;
  const sent = await dependencies.sendSms({ municipalityId: input.municipalityId, use: input.purpose, phone: input.phone, data: smsData(input),
    messageId: input.challengeId, expiresAt: input.expiresAt });
  if (sent?.status === DeliveryStatus.SKIPPED && sent.code === DeliveryCode.CHANNEL_DISABLED) return null;
  return safeResult(input.purpose, NotificationChannel.SMS, sent);
}

// WhatsApp first and, when it does not send, SMS, always to the same phone: a code never changes destination.
async function tryPhone(input, dependencies) {
  const results = [];
  try { results.push(await tryWhatsapp(input, dependencies)); }
  catch { results.push({ purpose: input.purpose, channel: NotificationChannel.WHATSAPP, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }); }
  if (results[0].status === DeliveryStatus.SENT) return results;
  try {
    const sms = await trySms(input, dependencies);
    if (sms) results.push(sms);
  } catch { results.push({ purpose: input.purpose, channel: NotificationChannel.SMS, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }); }
  return results;
}

// Destinations come from the auth use case, never request followUp or arbitrary fallback contacts.
export async function deliverAuthMessage(input, overrides = {}) {
  const dependencies = { loadWhatsappConfig: getMunicipalityWhatsappConfig,
    consumeQuota: checkAndConsumeQuota, sendEmail: sendEmailTemplate, sendWhatsapp: sendWhatsappTemplateComponents,
    resolveTemplate: resolveActiveTemplate, markTemplateStatus: markCatalogTemplateStatus,
    resolveEmailTemplate, loadEmailIdentity: loadEmailIdentityParams,
    sendSms: sendSmsUse, ...overrides };
  const { purpose } = input;
  const globalStaffReset = purpose === AuthPurpose.PASSWORD_RESET && !input.municipalityId && isGlobalUser(input.user);
  if (!Object.values(AuthPurpose).includes(purpose) || (!input.municipalityId && !globalStaffReset)) return [];
  if (purpose === AuthPurpose.PASSWORD_RESET) return deliverRecoveryChannel(input, dependencies, globalStaffReset);
  const requiresCode = isVerification(purpose) || purpose === AuthPurpose.PASSWORD_RESET || purpose === AuthPurpose.REQUEST_TRACKING;
  if (requiresCode && !/^\d{6}$/.test(input.code || "")) {
    return [{ purpose, channel: NotificationChannel.EMAIL, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }];
  }
  // The request code goes to a contact the use case already matched against the request: the follow-up contact for tracking,
  // the tutor's contact for "Acessar minha solicitação".
  const matched = purpose === AuthPurpose.REQUEST_TRACKING;
  const emailAllowed = purpose !== AuthPurpose.VERIFY_PHONE && Boolean(input.email)
    && (matched || purpose === AuthPurpose.VERIFY_EMAIL || input.emailVerified === true);
  const phoneAllowed = !globalStaffReset && purpose !== AuthPurpose.VERIFY_EMAIL && Boolean(input.phone)
    && (matched || purpose === AuthPurpose.VERIFY_PHONE || input.phoneVerified === true);
  if (!emailAllowed && !phoneAllowed) return [];
  const results = [];
  if (phoneAllowed) {
    results.push(...await tryPhone(input, dependencies));
    if (results.some(({ status }) => status === DeliveryStatus.SENT)) return results;
  }
  if (emailAllowed) {
    try { results.push(await tryEmail(input, dependencies)); }
    catch { results.push({ purpose, channel: NotificationChannel.EMAIL, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }); }
  }
  return results;
}

async function deliverRecoveryChannel(input, dependencies, globalStaffReset) {
  const { purpose, channel } = input;
  if (!Object.values(NotificationChannel).includes(channel)) return [];
  if (!/^\d{6}$/.test(input.code || "") || isRecoveryExpired(input)) return [unavailable(purpose, channel, DeliveryCode.PREPARATION_FAILED)];
  try {
    if (channel === NotificationChannel.SMS) {
      if (globalStaffReset) return [unavailable(purpose, channel, DeliveryCode.CHANNEL_DISABLED)];
      const result = await dependencies.sendSms({ municipalityId: input.municipalityId, use: purpose, phone: input.phone, data: smsData(input),
        messageId: input.challengeId, expiresAt: input.expiresAt });
      return [{ ...safeResult(purpose, channel, result), ...(result?.status === DeliveryStatus.SENT
        ? { providerMessageId: result.providerMessageId, reference: result.reference } : {}) }];
    }
    if (channel === NotificationChannel.EMAIL) return [await tryEmail(input, dependencies, { platform: globalStaffReset })];
    if (!globalStaffReset) return [await tryWhatsapp(input, dependencies)];
    return [unavailable(purpose, channel, DeliveryCode.CHANNEL_DISABLED)];
  } catch { return [{ purpose, channel, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }]; }
}
