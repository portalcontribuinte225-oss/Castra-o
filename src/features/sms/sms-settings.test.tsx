import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultSmsConfig, SMS_CONFIG_KEY, SmsEnvironment } from "../../../shared/sms-contract.js";
import { createSmsSettingsController } from "./sms-settings-controller";
import { SmsSettings } from "./sms-settings";
import { useSmsSettings } from "./use-sms-settings";
import type { SmsConnectionResult, SmsSettingsApi } from "./sms-types";

vi.mock("./use-sms-settings", () => ({ useSmsSettings: vi.fn() }));

const stored = { ...buildDefaultSmsConfig(), hasToken: true, secureStorageAvailable: true,
  environment: SmsEnvironment.PRODUCTION, tokenValid: true, lastValidatedAt: "2026-11-13T12:00:00Z" };
const connected: SmsConnectionResult = { valid: true, environment: SmsEnvironment.PRODUCTION,
  balance: { credits: 0, sms: 0 }, checkedAt: "2026-11-13T12:01:00Z" };
function apiFixture() {
  return { getConfig: vi.fn<SmsSettingsApi["getConfig"]>(async () => stored), setConfig: vi.fn<SmsSettingsApi["setConfig"]>(async (_key, value) => ({
    value: value.clearToken ? buildDefaultSmsConfig() : { ...stored, active: value.active === true },
  })), testSmsConnection: vi.fn<SmsSettingsApi["testSmsConnection"]>(async () => connected) } satisfies SmsSettingsApi;
}
function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve: (value: T) => resolve(value) };
}

describe("municipal SMS settings", () => {
  it("does not load or mutate without administrative permission or municipality", async () => {
    for (const context of [{ id: "municipality-a", allowed: false }, { id: "", allowed: true }]) {
      const api = apiFixture();
      const controller = createSmsSettingsController(api, context.id, context.allowed);
      await controller.load(); controller.setToken("new-token"); controller.setActive(true);
      await controller.save(); await controller.testConnection(); await controller.removeToken();
      expect(api.getConfig).not.toHaveBeenCalled(); expect(api.setConfig).not.toHaveBeenCalled(); expect(api.testSmsConnection).not.toHaveBeenCalled();
      expect(controller.getSnapshot().token).toBe("");
    }
  });

  it("loads only safe metadata and keeps a saved token out of the editable state", async () => {
    const api = apiFixture(); api.getConfig.mockResolvedValue({ ...stored, token: "server-secret", encryptedToken: "encrypted-secret" });
    const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    expect(api.getConfig).toHaveBeenCalledWith(SMS_CONFIG_KEY, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ ready: true, active: false, token: "", config: { hasToken: true } });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("secret");
  });

  it("preserves the token on empty save and disable; replacing and removing are explicit", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load(); controller.setActive(true); await controller.save();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: true }, "municipality-a");
    controller.setActive(false); await controller.save();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: false }, "municipality-a");
    controller.setToken("replacement-token"); await controller.save();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: false, token: "replacement-token" }, "municipality-a");
    expect(controller.getSnapshot().token).toBe("");
    await controller.removeToken();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { clearToken: true }, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ active: false, token: "", config: { hasToken: false } });
  });

  it("tests connection with an unsaved token without saving, activating or marking it valid", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load(); controller.setToken("draft-token");
    await controller.testConnection();
    expect(api.testSmsConnection).toHaveBeenCalledWith({ municipalityId: "municipality-a", token: "draft-token" });
    expect(api.setConfig).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ active: false, token: "draft-token", connection: { valid: true, balance: { credits: 0, sms: 0 } } });
    controller.setToken("another-token");
    expect(controller.getSnapshot().connection).toBeNull();
  });

  it("rejects malformed tokens and refuses secret changes or activation without secure storage", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    for (const token of ["Bearer secret", "bad\nvalue", "bad value"]) {
      controller.setToken(token); await controller.save(); await controller.testConnection();
    }
    expect(api.setConfig).not.toHaveBeenCalled(); expect(api.testSmsConnection).not.toHaveBeenCalled();
    api.getConfig.mockResolvedValue({ ...stored, active: true, secureStorageAvailable: false });
    await controller.load(); controller.setToken("new-token"); await controller.save();
    expect(api.setConfig).not.toHaveBeenCalled();
    await controller.testConnection();
    expect(api.testSmsConnection).toHaveBeenLastCalledWith({ municipalityId: "municipality-a", token: "new-token" });
    controller.setToken(""); controller.setActive(false); await controller.save();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: false }, "municipality-a");
    await controller.removeToken(); expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { clearToken: true }, "municipality-a");
  });

  it("discards late load and save responses after cancellation without retaining draft secrets", async () => {
    const api = apiFixture(); const pendingLoad = deferred<typeof stored>(); api.getConfig.mockReturnValue(pendingLoad.promise);
    const controller = createSmsSettingsController(api, "municipality-a", true);
    const loading = controller.load(); controller.cancel(); pendingLoad.resolve(stored); await loading;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, loading: false, token: "" });
    api.getConfig.mockResolvedValue(stored); await controller.load(); controller.setToken("discard-me");
    const pendingSave = deferred<{ value: typeof stored }>(); api.setConfig.mockReturnValue(pendingSave.promise);
    const saving = controller.save(); controller.cancel(); pendingSave.resolve({ value: { ...stored, active: true } }); await saving;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, active: false, saving: false, token: "", notice: "" });
    await controller.save(); expect(api.setConfig).toHaveBeenCalledTimes(1);
  });

  it("ignores an old connection response after another municipality opens and permits one in-flight action", async () => {
    const api = apiFixture(); const old = createSmsSettingsController(api, "municipality-a", true); await old.load();
    const pending = deferred<SmsConnectionResult>(); api.testSmsConnection.mockReturnValue(pending.promise);
    const testing = old.testConnection(); await old.save(); await old.testConnection();
    expect(api.testSmsConnection).toHaveBeenCalledTimes(1); expect(api.setConfig).not.toHaveBeenCalled();
    old.cancel(); const next = createSmsSettingsController(api, "municipality-b", true); await next.load();
    pending.resolve(connected); await testing;
    expect(next.getSnapshot().connection).toBeNull(); expect(old.getSnapshot().connection).toBeNull();
    expect(api.getConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, "municipality-b");
  });

  it("handles invalid connection envelopes and failures without displaying provider secrets", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true); await controller.load();
    api.testSmsConnection.mockResolvedValue({ ...connected, valid: false, reason: "raw-provider-secret" });
    await controller.testConnection();
    expect(controller.getSnapshot().connection).toBeNull(); expect(controller.getSnapshot().error).not.toContain("secret");
    api.testSmsConnection.mockRejectedValue(Object.assign(new Error("raw-provider-secret"), { status: 403 }));
    await controller.testConnection(); expect(controller.getSnapshot().error).toContain("Sem permissão");
    api.setConfig.mockRejectedValue(new Error("raw-provider-secret")); await controller.save();
    expect(controller.getSnapshot().error).not.toContain("secret"); expect(controller.getSnapshot().saving).toBe(false);
  });
});

describe("SMS settings interface", () => {
  beforeEach(() => {
    const controller = createSmsSettingsController(apiFixture(), "municipality-a", true);
    vi.mocked(useSmsSettings).mockReturnValue({ ...controller.getSnapshot(), config: stored, ready: true, loading: false,
      retry: controller.load, setToken: controller.setToken, setActive: controller.setActive,
      save: controller.save, removeToken: controller.removeToken, testConnection: controller.testConnection });
  });
  it("shows a write-only password field and separate save, test and removal actions", () => {
    const html = renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" canManage />);
    expect(html).toContain("SMSMais"); expect(html).toContain('type="password"'); expect(html).toContain('value=""');
    expect(html).toContain("Deixe vazio para manter o token salvo"); expect(html).toContain("Salvar SMS");
    expect(html).toContain("Testar conexão / Consultar saldo"); expect(html).toContain("Remover token e desativar");
    expect(html).toContain('role="switch"'); expect(html).not.toContain("Enviar SMS");
  });
  it("does not render settings for unauthorized or missing municipality contexts", () => {
    expect(renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" canManage={false} />)).not.toContain('type="password"');
    expect(renderToStaticMarkup(<SmsSettings municipalityId="" canManage />)).toContain("Selecione um município");
  });
  it("labels sandbox and current zero balance without implying activation", () => {
    vi.mocked(useSmsSettings).mockReturnValue({ ...useSmsSettings("municipality-a", true),
      connection: { ...connected, environment: SmsEnvironment.SANDBOX } });
    const html = renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" canManage />);
    expect(html).toContain("Homologação"); expect(html).toContain("Créditos: 0"); expect(html).toContain("O teste não salva");
  });
  it("permits a connection test when secure storage is unavailable while blocking saving a new token", () => {
    vi.mocked(useSmsSettings).mockReturnValue({ ...useSmsSettings("municipality-a", true),
      config: { ...stored, secureStorageAvailable: false }, token: "new-token" });
    const html = renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" canManage />);
    expect(html.match(/<input[^>]*type="password"[^>]*>/)?.[0]).not.toContain("disabled");
    expect(html).toContain("configuração segura do servidor está indisponível");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Salvar SMS/);
  });
});
