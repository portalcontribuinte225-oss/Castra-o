import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultSmsConfig, SMS_CONFIG_KEY, SmsEnvironment } from "../../../shared/sms-contract.js";
import { smsUses } from "../../../shared/sms-uses-contract.js";
import { createSmsSettingsController } from "./sms-settings-controller";
import { SmsSettings } from "./sms-settings";
import { useSmsSettings } from "./use-sms-settings";
import type { SmsConfig, SmsConnectionResult, SmsSettingsApi } from "./sms-types";

vi.mock("./use-sms-settings", () => ({ useSmsSettings: vi.fn() }));

const PREVIEW = "SMSTOKEN";
const stored: SmsConfig = { ...buildDefaultSmsConfig(), hasToken: true, tokenPreview: PREVIEW, secureStorageAvailable: true, municipalityName: "Test Town",
  environment: SmsEnvironment.PRODUCTION, tokenValid: true, lastValidatedAt: "2026-11-13T12:00:00Z" };
const connected: SmsConnectionResult = { valid: true, environment: SmsEnvironment.PRODUCTION,
  balance: { credits: 0, sms: 0 }, checkedAt: "2026-11-13T12:01:00Z" };
const withoutToken: SmsConfig = { ...stored, hasToken: false, tokenPreview: "" };
const channelOn: SmsConfig = { ...stored, active: true };

// A stand-in server that keeps what was stored, so a sequence of changes answers like the real one.
function apiFixture(initial: SmsConfig = stored) {
  let server = initial;
  return {
    getConfig: vi.fn<SmsSettingsApi["getConfig"]>(async () => server),
    setConfig: vi.fn<SmsSettingsApi["setConfig"]>(async (_key, value) => {
      server = value.clearToken ? buildDefaultSmsConfig()
        : { ...server, ...(value.active === undefined ? {} : { active: value.active }), ...(value.token ? { hasToken: true, tokenPreview: value.token.slice(0, 8) } : {}) };
      return { value: server };
    }),
    testSmsConnection: vi.fn<SmsSettingsApi["testSmsConnection"]>(async () => connected),
    setSmsUseActive: vi.fn<SmsSettingsApi["setSmsUseActive"]>(async (_municipalityId, use, active) => {
      server = { ...server, uses: server.uses.map((row) => row.key === use ? { ...row, active } : row) };
      return server;
    }),
  } satisfies SmsSettingsApi;
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
      await controller.load(); controller.setToken("new-token"); controller.setConfirmingRemoval(true);
      await controller.saveToken(); await controller.toggleActive(true); await controller.setUseActive("password_reset", true);
      await controller.testConnection(); await controller.removeToken();
      expect(api.getConfig).not.toHaveBeenCalled(); expect(api.setConfig).not.toHaveBeenCalled();
      expect(api.testSmsConnection).not.toHaveBeenCalled(); expect(api.setSmsUseActive).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toMatchObject({ token: "", confirmingRemoval: false });
    }
  });

  it("loads only safe metadata: the start of the token and the municipality's messages, never the token", async () => {
    const api = apiFixture(); api.getConfig.mockResolvedValue({ ...stored, token: "server-secret", encryptedToken: "encrypted-secret", tokenPreview: "SMSTOKEN-and-more-secret" });
    const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    expect(api.getConfig).toHaveBeenCalledWith(SMS_CONFIG_KEY, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ ready: true, token: "", config: { hasToken: true, active: false, municipalityName: "Test Town", tokenPreview: PREVIEW } });
    expect(controller.getSnapshot().config.uses).toHaveLength(smsUses.length);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("secret");
  });

  it("stores a new token, the channel switch and the removal at once, keeping the token out of the state", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    await controller.toggleActive(true);
    expect(api.setConfig).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toContain("token");
    controller.setToken("replacement-token"); await controller.saveToken();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { token: "replacement-token" }, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ token: "", notice: "Token salvo.", config: { hasToken: true, tokenPreview: "replacem" } });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("replacement-token");
    await controller.toggleActive(true);
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: true }, "municipality-a");
    expect(controller.getSnapshot().config.active).toBe(true);
    await controller.toggleActive(false);
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: false }, "municipality-a");
    controller.setConfirmingRemoval(true); expect(controller.getSnapshot().confirmingRemoval).toBe(true);
    await controller.removeToken();
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { clearToken: true }, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ token: "", confirmingRemoval: false, config: { active: false, hasToken: false, tokenPreview: "" } });
  });

  it("tests connection with an unsaved token without saving, activating or marking it valid", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load(); controller.setToken("draft-token");
    await controller.testConnection();
    expect(api.testSmsConnection).toHaveBeenCalledWith({ municipalityId: "municipality-a", token: "draft-token" });
    expect(api.setConfig).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ token: "draft-token", config: { active: false }, connection: { valid: true, balance: { credits: 0, sms: 0 } } });
    controller.setToken("another-token");
    expect(controller.getSnapshot().connection).toBeNull();
  });

  it("rejects malformed tokens and refuses secret changes or activation without secure storage", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    for (const token of ["Bearer secret", "bad\nvalue", "bad value"]) {
      controller.setToken(token); await controller.saveToken(); await controller.testConnection();
    }
    expect(api.setConfig).not.toHaveBeenCalled(); expect(api.testSmsConnection).not.toHaveBeenCalled();
    api.getConfig.mockResolvedValue({ ...stored, hasToken: false, secureStorageAvailable: false });
    await controller.load(); controller.setToken("new-token"); await controller.saveToken();
    expect(api.setConfig).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toContain("indisponível");
    await controller.testConnection();
    expect(api.testSmsConnection).toHaveBeenLastCalledWith({ municipalityId: "municipality-a", token: "new-token" });
    api.getConfig.mockResolvedValue({ ...stored, active: true, secureStorageAvailable: false });
    await controller.load(); await controller.toggleActive(false);
    expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { active: false }, "municipality-a");
    await controller.removeToken(); expect(api.setConfig).toHaveBeenLastCalledWith(SMS_CONFIG_KEY, { clearToken: true }, "municipality-a");
  });

  it("turns a message on or off through its own route, and only turns one on while the channel is active", async () => {
    const inactive = apiFixture(); const idle = createSmsSettingsController(inactive, "municipality-a", true);
    await idle.load(); await idle.setUseActive("schedule_confirmed", true);
    expect(inactive.setSmsUseActive).not.toHaveBeenCalled();
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    await controller.setUseActive("schedule_confirmed", true);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "schedule_confirmed", true);
    expect(controller.getSnapshot().config.uses.find((row) => row.key === "schedule_confirmed")?.active).toBe(true);
    await controller.setUseActive("password_reset", false);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "password_reset", false);
    expect(controller.getSnapshot().config.uses.find((row) => row.key === "password_reset")?.active).toBe(false);
    expect(api.setConfig).not.toHaveBeenCalled();
  });

  it("shows a failure of a message switch without exposing the server detail, and a missing answer as a failure", async () => {
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true);
    await controller.load();
    api.setSmsUseActive.mockRejectedValue(Object.assign(new Error("raw-provider-secret"), { status: 400 }));
    await controller.setUseActive("completed", true);
    expect(controller.getSnapshot().error).toContain("Não foi possível alterar a mensagem"); expect(controller.getSnapshot().error).not.toContain("secret");
    expect(controller.getSnapshot().saving).toBe(false);
    api.setSmsUseActive.mockResolvedValue(null);
    await controller.setUseActive("completed", true);
    expect(controller.getSnapshot().error).toContain("Não foi possível alterar a mensagem");
    expect(controller.getSnapshot().config.active).toBe(true);
  });

  it("discards late load, save and message responses after cancellation without retaining draft secrets", async () => {
    const api = apiFixture(withoutToken); const pendingLoad = deferred<typeof stored>(); api.getConfig.mockReturnValue(pendingLoad.promise);
    const controller = createSmsSettingsController(api, "municipality-a", true);
    const loading = controller.load(); controller.cancel(); pendingLoad.resolve(stored); await loading;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, loading: false, token: "" });
    api.getConfig.mockResolvedValue(withoutToken); await controller.load(); controller.setToken("discard-me");
    const pendingSave = deferred<{ value: typeof stored }>(); api.setConfig.mockReturnValue(pendingSave.promise);
    const saving = controller.saveToken(); controller.cancel(); pendingSave.resolve({ value: { ...stored, active: true } }); await saving;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, saving: false, token: "", notice: "", config: { active: false } });
    await controller.saveToken(); expect(api.setConfig).toHaveBeenCalledTimes(1);
    api.getConfig.mockResolvedValue(channelOn); await controller.load();
    const pendingUse = deferred<typeof stored>(); api.setSmsUseActive.mockReturnValue(pendingUse.promise);
    const switching = controller.setUseActive("completed", true); controller.cancel(); pendingUse.resolve({ ...channelOn }); await switching;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, saving: false, error: "" });
  });

  it("ignores an old connection response after another municipality opens and permits one in-flight action", async () => {
    const api = apiFixture(); const old = createSmsSettingsController(api, "municipality-a", true); await old.load();
    const pending = deferred<SmsConnectionResult>(); api.testSmsConnection.mockReturnValue(pending.promise);
    const testing = old.testConnection(); await old.saveToken(); await old.removeToken(); await old.toggleActive(true); await old.testConnection();
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
    api.setConfig.mockRejectedValue(new Error("raw-provider-secret")); await controller.toggleActive(true);
    expect(controller.getSnapshot().error).not.toContain("secret"); expect(controller.getSnapshot().saving).toBe(false);
  });
});

describe("SMS settings interface", () => {
  const view = (overrides: Partial<ReturnType<typeof useSmsSettings>> = {}) => {
    const controller = createSmsSettingsController(apiFixture(), "municipality-a", true);
    return { ...controller.getSnapshot(), config: stored, ready: true, loading: false, retry: controller.load, setToken: controller.setToken,
      setConfirmingRemoval: controller.setConfirmingRemoval, saveToken: controller.saveToken, toggleActive: controller.toggleActive,
      removeToken: controller.removeToken, setUseActive: controller.setUseActive, testConnection: controller.testConnection, ...overrides };
  };
  const screen = (overrides: Partial<ReturnType<typeof useSmsSettings>> = {}) => {
    vi.mocked(useSmsSettings).mockReturnValue(view(overrides));
    return renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" canManage />);
  };
  beforeEach(() => { vi.mocked(useSmsSettings).mockReturnValue(view()); });

  it("shows a saved token by its start only, with a confirmed removal and no way to read it whole", () => {
    const saved = screen();
    expect(saved).toContain(`value="${PREVIEW}${"•".repeat(24)}"`); expect(saved).toContain("readonly=\"\"");
    expect(saved).toContain("Remover token"); expect(saved).not.toContain("Salvar credenciais");
    expect(saved).toContain("Testar conexão / Consultar saldo"); expect(saved).not.toContain("Enviar SMS");
    const confirming = screen({ confirmingRemoval: true });
    expect(confirming).toContain("Confirmar"); expect(confirming).toContain("O SMS será desativado.");
  });

  it("asks for the token when none is saved, and shows the start of what is being typed", () => {
    const empty = screen({ config: withoutToken });
    expect(empty).toContain('type="password"'); expect(empty).toContain("Salvar credenciais"); expect(empty).not.toContain("Remover token");
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>Salvar credenciais/);
    const typing = screen({ config: withoutToken, token: "typed-token-value" });
    expect(typing).toContain("<code>typed-to</code>"); expect(typing).not.toMatch(/<button[^>]*disabled=""[^>]*>Salvar credenciais/);
  });

  it("lists the nine messages with their sample text, named for the municipality", () => {
    const html = screen();
    expect(html.match(/<tr>/g)).toHaveLength(smsUses.length + 1);
    for (const use of smsUses) expect(html).toContain(use.label);
    expect(html).toContain("Test Town: seu codigo e 123456. Valido por 10 minutos. Nao compartilhe.");
    expect(html).toContain("Test Town: atendimento concluido. Protocolo 123/2026.");
    expect(html).toContain("<th>Exemplo do texto</th>");
    expect(screen({ config: { ...stored, municipalityName: "" } })).toContain("Municipio: seu codigo e 123456.");
  });

  it("locks every switch while the channel is inactive, and unlocks them with the stored state once it is active", () => {
    const locked = screen();
    expect(locked.match(/role="switch"/g)).toHaveLength(smsUses.length);
    expect(locked.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(smsUses.length);
    expect(locked.match(/aria-label="Ative o SMS para ligar as mensagens\."/g)).toHaveLength(smsUses.length);
    expect(locked).not.toContain('aria-checked="true"');
    const open = screen({ config: channelOn });
    expect(open).not.toMatch(/<button[^>]*role="switch"[^>]*disabled=""/);
    expect(open).not.toContain("Ative o SMS para ligar as mensagens.");
    expect(open.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(open).toContain('aria-label="Desativar Recuperação de senha"');
    expect(open).toContain('aria-label="Ativar Agendamento confirmado"');
  });

  it("does not render settings for unauthorized or missing municipality contexts", () => {
    expect(renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" canManage={false} />)).not.toContain("Credenciais");
    expect(renderToStaticMarkup(<SmsSettings municipalityId="" canManage />)).toContain("Selecione um município");
  });

  it("shows loading, and an error with a way to try again but without the settings", () => {
    expect(screen({ ready: false, loading: true })).toContain("Carregando configuração de SMS...");
    const failed = screen({ ready: false, error: "Não foi possível carregar a configuração de SMS." });
    expect(failed).toContain("Não foi possível carregar a configuração de SMS."); expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("Credenciais"); expect(failed).not.toContain("<table");
    expect(screen({ error: "Informe um token antes de ativar o SMS." })).toContain("<table");
  });

  it("labels sandbox and current zero balance without implying activation", () => {
    const html = screen({ config: { ...stored, environment: SmsEnvironment.SANDBOX }, connection: { ...connected, environment: SmsEnvironment.SANDBOX } });
    expect(html).toContain("Homologação"); expect(html).toContain("Créditos: 0"); expect(html).toContain("O teste não salva");
    expect(html).toContain("não envia SMS nem ativa o canal");
  });

  it("permits a connection test when secure storage is unavailable while blocking saving a new token", () => {
    const html = screen({ config: { ...withoutToken, secureStorageAvailable: false }, token: "new-token" });
    expect(html.match(/<input[^>]*type="password"[^>]*>/)?.[0]).not.toContain("disabled");
    expect(html).toContain("configuração segura do servidor está indisponível");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Salvar credenciais/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Testar conexão/);
  });
});
