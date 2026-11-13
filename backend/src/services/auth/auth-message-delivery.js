import { pool } from "../../db/index.js";
import { AuthPurpose, AUTH_DELIVERY_CONFIG_KEY, normalizeAuthDeliveryConfig } from "../../../../shared/auth-contract.js";
import { NotificationChannel, DeliveryStatus, DeliveryCode } from "../../../../shared/notification-contract.js";
import { sendEmailTemplate } from "../email.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig, sendWhatsappTemplateComponents, toE164Brazil } from "../whatsapp.js";
import { checkAndConsumeQuota } from "../whatsappQuota.js";
import { deliveryFailure, knownDeliveryCode } from "../notifications/delivery-result.js";
import { isGlobalUser } from "../../tenant.js";

async function loadAuthDeliveryConfig(municipalityId) {
  const { rows } = await pool.query("SELECT value FROM config WHERE key=$1 AND municipality_id=$2", [AUTH_DELIVERY_CONFIG_KEY, municipalityId]);
  return normalizeAuthDeliveryConfig(rows[0]?.value);
}

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

function emailParameters(input) {
  const common = { to_name: input.user?.name || "Tutor", purpose: input.purpose };
  if (input.purpose === AuthPurpose.INITIAL_PASSWORD) return { ...common, temporary_password: input.temporaryPassword };
  if (input.purpose === AuthPurpose.CONTACT_CHANGED) return { ...common, message: "O contato de acesso da sua conta foi alterado. Se não reconhece a alteração, procure o atendimento do município." };
  return { ...common, code: input.code, codigo_recuperacao: input.code, validade: "10 minutos", validity_minutes: "10" };
}

function whatsappComponents(input) {
  if (input.purpose === AuthPurpose.INITIAL_PASSWORD) {
    return [{ type: "body", parameters: [input.user?.name || "Tutor", input.temporaryPassword].map((text) => ({ type: "text", text })) }];
  }
  if (input.purpose === AuthPurpose.CONTACT_CHANGED) {
    return [{ type: "body", parameters: [{ type: "text", text: input.user?.name || "Tutor" }] }];
  }
  return [
    { type: "body", parameters: [{ type: "text", text: input.code }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.code }] },
  ];
}

async function tryWhatsapp(input, config, dependencies) {
  const channel = NotificationChannel.WHATSAPP;
  if (!toE164Brazil(input.phone)) return unavailable(input.purpose, channel, DeliveryCode.INVALID_RECIPIENT);
  const raw = await dependencies.loadWhatsappConfig(input.municipalityId);
  if (raw.active !== true) return unavailable(input.purpose, channel, DeliveryCode.CHANNEL_DISABLED);
  const runtime = getRuntimeConfig(raw);
  const templateName = config.whatsappTemplates[input.purpose];
  if (runtime.provider !== "cloud_api" || !runtime.accessToken || !runtime.phoneNumberId || !templateName) {
    return unavailable(input.purpose, channel, DeliveryCode.NOT_CONFIGURED);
  }
  if (!(await dependencies.consumeQuota(input.municipalityId)).allowed) return unavailable(input.purpose, channel, DeliveryCode.QUOTA_UNAVAILABLE);
  const sent = await dependencies.sendWhatsapp({ ...runtime, templateName }, input.phone, whatsappComponents(input));
  return safeResult(input.purpose, channel, sent);
}

async function tryEmail(input, config, dependencies) {
  const templateId = config.emailTemplates[input.purpose]
    || (input.purpose === AuthPurpose.PASSWORD_RESET ? dependencies.env.EMAILJS_TEMPLATE_ID : "");
  if (!templateId) return unavailable(input.purpose, NotificationChannel.EMAIL, DeliveryCode.NOT_CONFIGURED);
  const sent = await dependencies.sendEmail({ toEmail: input.email, templateId, templateParams: emailParameters(input) });
  return safeResult(input.purpose, NotificationChannel.EMAIL, sent);
}

// Destinations come from the auth use case, never request followUp or arbitrary fallback contacts.
export async function deliverAuthMessage(input, overrides = {}) {
  const dependencies = { loadConfig: loadAuthDeliveryConfig, loadWhatsappConfig: getMunicipalityWhatsappConfig,
    consumeQuota: checkAndConsumeQuota, sendEmail: sendEmailTemplate, sendWhatsapp: sendWhatsappTemplateComponents,
    env: process.env, ...overrides };
  const { purpose } = input;
  const globalStaffReset = purpose === AuthPurpose.PASSWORD_RESET && !input.municipalityId && isGlobalUser(input.user);
  if (!Object.values(AuthPurpose).includes(purpose) || (!input.municipalityId && !globalStaffReset)) return [];
  const requiresCode = isVerification(purpose) || purpose === AuthPurpose.PASSWORD_RESET;
  if ((requiresCode && !/^\d{6}$/.test(input.code || ""))
    || (purpose === AuthPurpose.INITIAL_PASSWORD && (typeof input.temporaryPassword !== "string" || input.temporaryPassword.length < 15))) {
    return [{ purpose, channel: NotificationChannel.EMAIL, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }];
  }
  const initial = purpose === AuthPurpose.INITIAL_PASSWORD;
  const emailAllowed = purpose !== AuthPurpose.VERIFY_PHONE && Boolean(input.email)
    && (initial || purpose === AuthPurpose.VERIFY_EMAIL || input.emailVerified === true);
  const phoneAllowed = !globalStaffReset && purpose !== AuthPurpose.VERIFY_EMAIL && Boolean(input.phone)
    && (initial || purpose === AuthPurpose.VERIFY_PHONE || input.phoneVerified === true);
  if (!emailAllowed && !phoneAllowed) return [];
  let config;
  try { config = normalizeAuthDeliveryConfig(globalStaffReset ? undefined : await dependencies.loadConfig(input.municipalityId)); }
  catch { return [{ purpose, channel: phoneAllowed ? NotificationChannel.WHATSAPP : NotificationChannel.EMAIL,
    ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }]; }
  const results = [];
  if (phoneAllowed) {
    try { results.push(await tryWhatsapp(input, config, dependencies)); }
    catch { results.push({ purpose, channel: NotificationChannel.WHATSAPP, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }); }
    if (results[0].status === DeliveryStatus.SENT) return results;
  }
  if (emailAllowed) {
    try { results.push(await tryEmail(input, config, dependencies)); }
    catch { results.push({ purpose, channel: NotificationChannel.EMAIL, ...deliveryFailure(DeliveryStatus.FAILED, DeliveryCode.PREPARATION_FAILED) }); }
  }
  return results;
}
