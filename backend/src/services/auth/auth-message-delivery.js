import { AuthCodeAction, AuthPurpose, AUTH_CHALLENGE_SECONDS, isAuthCode } from "../../../../shared/auth-contract.js";
import { NotificationChannel, NotificationLabel, DeliveryStatus, DeliveryCode } from "../../../../shared/notification-contract.js";
import { EmailVariable } from "../../../../shared/email-uses-contract.js";
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

const SELECTED_CHANNEL_PURPOSES = new Set([AuthPurpose.PASSWORD_RESET, AuthPurpose.REQUEST_TRACKING]);

function isCodeExpired(input) {
  if (input.purpose !== AuthPurpose.PASSWORD_RESET && input.expiresAt === undefined) return false;
  const expiresAt = new Date(input.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function codeMinutes(expiresAt) {
  const remaining = expiresAt === undefined ? AUTH_CHALLENGE_SECONDS * 1000 : new Date(expiresAt).getTime() - Date.now();
  return String(Math.max(1, Math.ceil(remaining / 60000)));
}

// The data that changed, as the notice names it ("e-mail", "telefone"); the contact the tutor just confirmed.
function changedFieldsText(input) {
  return (Array.isArray(input.changedFields) ? input.changedFields : []).join(", ") || "contato";
}

function emailParameters(input) {
  const common = { [EmailVariable.TO_NAME]: input.user?.name || "Tutor", [EmailVariable.PURPOSE]: input.purpose,
    [EmailVariable.SUBJECT]: NotificationLabel[input.purpose] };
  if (input.purpose === AuthPurpose.CONTACT_CHANGED) {
    const changed = changedFieldsText(input);
    return { ...common, [EmailVariable.CHANGED_FIELDS]: changed,
      [EmailVariable.MESSAGE]: `Seus dados cadastrais foram atualizados. Informações alteradas: ${changed}. Se você não reconhece essa alteração, entre em contato com nossa equipe.` };
  }
  const minutes = codeMinutes(input.expiresAt);
  const validity = `${minutes} ${minutes === "1" ? "minuto" : "minutos"}`;
  return { ...common, [EmailVariable.CODE]: input.code,
    [EmailVariable.VALIDITY]: validity, [EmailVariable.VALIDITY_MINUTES]: minutes,
    [EmailVariable.MESSAGE]: `Use o código ${input.code} para ${AuthCodeAction[input.purpose]}. Válido por ${validity}. Não compartilhe este código.` };
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
  if (isCodeExpired(input)) return unavailable(input.purpose, channel, DeliveryCode.PREPARATION_FAILED);
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
  if (isCodeExpired(input)) return unavailable(input.purpose, NotificationChannel.EMAIL, DeliveryCode.PREPARATION_FAILED);
  const identity = await dependencies.loadEmailIdentity(municipalityId);
  if (municipalityId && !(await dependencies.consumeQuota(NotificationChannel.EMAIL, municipalityId)).allowed) {
    return unavailable(input.purpose, NotificationChannel.EMAIL, DeliveryCode.QUOTA_UNAVAILABLE);
  }
  const sent = await dependencies.sendEmail({ toEmail: input.email, templateId: resolved.templateId,
    templateParams: { ...identity, ...emailParameters(input) }, expiresAt: input.expiresAt });
  return safeResult(input.purpose, NotificationChannel.EMAIL, sent);
}

async function trySms(input, dependencies, selected = false) {
  const data = input.purpose === AuthPurpose.CONTACT_CHANGED ? { fields: changedFieldsText(input) }
    : { code: input.code, minutes: codeMinutes(input.expiresAt) };
  const sent = await dependencies.sendSms({ municipalityId: input.municipalityId, use: input.purpose, phone: input.phone, data,
    messageId: input.challengeId, expiresAt: input.expiresAt });
  if (!selected && sent?.status === DeliveryStatus.SKIPPED && sent.code === DeliveryCode.CHANNEL_DISABLED) return null;
  const result = safeResult(input.purpose, NotificationChannel.SMS, sent);
  return selected && sent?.status === DeliveryStatus.SENT ? { ...result, providerMessageId: sent.providerMessageId, reference: sent.reference } : result;
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
  if (SELECTED_CHANNEL_PURPOSES.has(purpose)) return deliverSelectedChannel(input, dependencies, globalStaffReset);
  if (Object.hasOwn(AuthCodeAction, purpose) && (!isAuthCode(input.code) || isCodeExpired(input))) {
    const channel = purpose === AuthPurpose.VERIFY_PHONE ? NotificationChannel.WHATSAPP : NotificationChannel.EMAIL;
    return [{ purpose, channel, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }];
  }
  const emailAllowed = purpose !== AuthPurpose.VERIFY_PHONE && Boolean(input.email)
    && (purpose === AuthPurpose.VERIFY_EMAIL || input.emailVerified === true);
  const phoneAllowed = purpose !== AuthPurpose.VERIFY_EMAIL && Boolean(input.phone)
    && (purpose === AuthPurpose.VERIFY_PHONE || input.phoneVerified === true);
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

// The recovery code and the code of "Acompanhar solicitação" go only through the channel the person chose, to the destination the
// use case resolved: there is no other channel to fall back to.
async function deliverSelectedChannel(input, dependencies, globalStaffReset) {
  const { purpose, channel } = input;
  if (!Object.values(NotificationChannel).includes(channel)) return [];
  if (!isAuthCode(input.code) || isCodeExpired(input)) return [unavailable(purpose, channel, DeliveryCode.PREPARATION_FAILED)];
  try {
    if (channel === NotificationChannel.SMS) {
      if (globalStaffReset) return [unavailable(purpose, channel, DeliveryCode.CHANNEL_DISABLED)];
      return [await trySms(input, dependencies, true)];
    }
    if (channel === NotificationChannel.EMAIL) return [await tryEmail(input, dependencies, { platform: globalStaffReset })];
    if (!globalStaffReset) return [await tryWhatsapp(input, dependencies)];
    return [unavailable(purpose, channel, DeliveryCode.CHANNEL_DISABLED)];
  } catch { return [{ purpose, channel, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }]; }
}
