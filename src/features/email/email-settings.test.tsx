import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultAuthDeliveryConfig, normalizeAuthDeliveryConfig } from "../../../shared/auth-contract.js";
import { normalizeNotificationConfig } from "../../../shared/notification-contract.js";
import { AuthDeliverySettings } from "../tutor-access/auth-delivery-settings";
import { authChannelPatch, useAuthDeliverySettings } from "../tutor-access/use-auth-delivery-settings";
import { NotificationSettings } from "../notifications/notification-settings";
import { notificationChannelPatch, useNotificationSettings } from "../notifications/use-notification-settings";
import { EmailSettings } from "./email-settings";
import { useEmailStatus } from "./use-email-status";

vi.mock("./use-email-status", () => ({ useEmailStatus: vi.fn() }));
vi.mock("../notifications/use-notification-settings", async (importOriginal) => ({ ...(await importOriginal<object>()), useNotificationSettings: vi.fn() }));
vi.mock("../tutor-access/use-auth-delivery-settings", async (importOriginal) => ({ ...(await importOriginal<object>()), useAuthDeliverySettings: vi.fn() }));

const retry = vi.fn();
const settingsBase = { loading: false, saving: false, error: "", success: false, ready: true, retry, save: vi.fn(), setValue: vi.fn() };
const complete = { serviceConfigured: true, publicKeyConfigured: true, privateKeyConfigured: false, recoveryTemplateConfigured: true };

beforeEach(() => {
  vi.mocked(useEmailStatus).mockReturnValue({ status: complete, loading: false, error: "", retry });
  vi.mocked(useNotificationSettings).mockReturnValue({ ...settingsBase,
    value: normalizeNotificationConfig({ emailTemplateId: "notify_email", whatsappTemplates: { completed: "done" } }) });
  vi.mocked(useAuthDeliverySettings).mockReturnValue({ ...settingsBase, value: normalizeAuthDeliveryConfig({
    emailTemplates: { password_reset: "reset_email" }, whatsappTemplates: { verify_phone: "phone_whatsapp" } }) });
});

describe("e-mail settings tab", () => {
  it("shows credential presence without values and only e-mail templates", () => {
    const html = renderToStaticMarkup(<EmailSettings municipalityId="municipality-a" canManage />);
    expect(html).toContain("Integração EmailJS");
    expect(html).toContain("EMAILJS_SERVICE_ID");
    expect(html.match(/<strong>configurado<\/strong>/g)).toHaveLength(3);
    expect(html.match(/<strong>não configurado<\/strong>/g)).toHaveLength(1);
    expect(html).toContain("notify_email");
    expect(html).toContain("reset_email");
    expect(html).toContain("Confirmação de e-mail");
    expect(html).not.toContain("Confirmação de telefone");
    expect(html).not.toContain("WhatsApp: Mudança de agendamento");
    expect(html).not.toContain("phone_whatsapp");
  });

  it("warns when the service or public key is missing and offers a retry after a failed query", () => {
    vi.mocked(useEmailStatus).mockReturnValue({ status: { ...complete, serviceConfigured: false }, loading: false, error: "", retry });
    expect(renderToStaticMarkup(<EmailSettings municipalityId="municipality-a" canManage />)).toContain("nenhum e-mail é enviado");
    vi.mocked(useEmailStatus).mockReturnValue({ status: null, loading: false, error: "Não foi possível consultar a integração de e-mail.", retry });
    const html = renderToStaticMarkup(<EmailSettings municipalityId="municipality-a" canManage />);
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("<strong>configurado</strong>");
  });

  it("does not render settings for unauthorized or missing municipality contexts", () => {
    expect(renderToStaticMarkup(<EmailSettings municipalityId="municipality-a" canManage={false} />)).toContain("restrita à administração");
    expect(renderToStaticMarkup(<EmailSettings municipalityId="" canManage />)).toContain("Selecione um município");
    expect(renderToStaticMarkup(<EmailSettings municipalityId="municipality-a" canManage={false} />)).not.toContain("notify_email");
  });
});

describe("WhatsApp settings tab keeps only WhatsApp fields", () => {
  it("shows WhatsApp events and templates but no e-mail template fields", () => {
    const notifications = renderToStaticMarkup(<NotificationSettings municipalityId="municipality-a" channel="whatsapp" />);
    expect(notifications).toContain("WhatsApp: Mudança de agendamento");
    expect(notifications).not.toContain("Template de notificações por e-mail");
    expect(notifications).not.toContain("notify_email");
    const access = renderToStaticMarkup(<AuthDeliverySettings municipalityId="municipality-a" channel="whatsappTemplates" />);
    expect(access).toContain("Confirmação de telefone");
    expect(access).toContain("phone_whatsapp");
    expect(access).not.toContain("Confirmação de e-mail");
    expect(access).not.toContain("reset_email");
  });
});

describe("channel save payloads", () => {
  it("send only the fields owned by the channel so the other channel is never rewritten", () => {
    const notifications = normalizeNotificationConfig({ emailTemplateId: "notify_email", whatsappTemplates: { completed: "done" } });
    expect(notificationChannelPatch(notifications, "email")).toEqual({ emailTemplateId: "notify_email" });
    expect(Object.keys(notificationChannelPatch(notifications, "whatsapp"))).toEqual(["whatsappTemplates"]);
    const access = normalizeAuthDeliveryConfig({ emailTemplates: { password_reset: "reset_email" } });
    expect(Object.keys(authChannelPatch(access, "emailTemplates"))).toEqual(["emailTemplates"]);
    expect(authChannelPatch(access, "whatsappTemplates")).toEqual({ whatsappTemplates: buildDefaultAuthDeliveryConfig().whatsappTemplates });
  });
});
