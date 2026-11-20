import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultSmsConfig, SmsEnvironment } from "../../../shared/sms-contract.js";
import { smsUses } from "../../../shared/sms-uses-contract.js";
import { useMessageContract } from "../message-contract/use-message-contract";
import { createSmsSettingsController } from "./sms-settings-controller";
import { SmsCredentials } from "./sms-credentials";
import { SmsSettings } from "./sms-settings";
import { useSmsSettings } from "./use-sms-settings";
import type { SmsConfig, SmsConnectionResult, SmsSettingsApi } from "./sms-types";

vi.mock("./use-sms-settings", () => ({ useSmsSettings: vi.fn() }));
vi.mock("../message-contract/use-message-contract", () => ({ useMessageContract: vi.fn() }));

const PREVIEW = "SMSTOKEN";
const stored: SmsConfig = { ...buildDefaultSmsConfig(), hasToken: true, tokenPreview: PREVIEW, secureStorageAvailable: true, municipalityName: "Test Town",
  environment: SmsEnvironment.PRODUCTION, tokenValid: true, lastValidatedAt: "2026-11-13T12:00:00Z" };
const connected: SmsConnectionResult = { valid: true, environment: SmsEnvironment.PRODUCTION,
  balance: { credits: 0, sms: 0 }, checkedAt: "2026-11-13T12:01:00Z" };
const withoutToken: SmsConfig = { ...stored, hasToken: false, tokenPreview: "" };
const channelOn: SmsConfig = { ...stored, active: true };
// What the municipal administration reads: whether the channel is on, the municipality's name and messages, and no account.
const municipal: SmsConfig = { ...buildDefaultSmsConfig(), active: true, municipalityName: "Test Town" };
const contractState = {
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: vi.fn(), saveStatus: "",
  ready: true, loadFailed: false, retry: vi.fn(), saving: false,
  live: { plan: 500, used: 12, remaining: 488, contractStart: null, contractEnd: "2026-12-31", active: true, enabled: true },
  confirmingEnd: false, setConfirmingEnd: vi.fn(), save: vi.fn(), endContractToday: vi.fn(), resetUsed: vi.fn(), setEnabled: vi.fn(),
};

// A stand-in server that keeps what was stored, so a sequence of changes answers like the real one.
function apiFixture(initial: SmsConfig = stored) {
  let server = initial;
  return {
    getSmsSettings: vi.fn<SmsSettingsApi["getSmsSettings"]>(async () => server),
    saveSmsAccount: vi.fn<SmsSettingsApi["saveSmsAccount"]>(async (value) => {
      server = value.clearToken ? buildDefaultSmsConfig()
        : { ...server, ...(value.active === undefined ? {} : { active: value.active }), ...(value.token ? { hasToken: true, tokenPreview: value.token.slice(0, 8) } : {}) };
      return server;
    }),
    testSmsConnection: vi.fn<SmsSettingsApi["testSmsConnection"]>(async () => connected),
    sendSmsTest: vi.fn<SmsSettingsApi["sendSmsTest"]>(async () => ({ status: "sent", providerMessageId: "4321" })),
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

describe("platform SMS settings", () => {
  it("does not load or mutate without administrative permission, nor for a municipal administrator without a municipality", async () => {
    for (const context of [{ id: "municipality-a", master: true, allowed: false }, { id: "", master: false, allowed: true }]) {
      const api = apiFixture();
      const controller = createSmsSettingsController(api, context.id, context.master, context.allowed);
      await controller.load(); controller.setToken("new-token"); controller.setConfirmingRemoval(true);
      await controller.saveToken(); await controller.toggleActive(true); await controller.setUseActive("password_reset", true);
      await controller.testConnection(); await controller.removeToken();
      controller.setTestPhone("(48) 99999-1234"); await controller.sendTest();
      expect(api.getSmsSettings).not.toHaveBeenCalled(); expect(api.saveSmsAccount).not.toHaveBeenCalled();
      expect(api.testSmsConnection).not.toHaveBeenCalled(); expect(api.setSmsUseActive).not.toHaveBeenCalled(); expect(api.sendSmsTest).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toMatchObject({ token: "", confirmingRemoval: false, testPhone: "", testOutcome: null });
    }
  });

  it("lets the master manage the account with no municipality, and keeps the messages for a municipality", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "", true, true);
    expect(controller.getSnapshot().loading).toBe(true);
    await controller.load();
    expect(api.getSmsSettings).toHaveBeenCalledWith(""); expect(controller.getSnapshot().ready).toBe(true);
    controller.setToken("platform-token"); await controller.saveToken();
    expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ token: "platform-token" }, "");
    await controller.setUseActive("password_reset", false);
    expect(api.setSmsUseActive).not.toHaveBeenCalled();
  });

  it("lets the municipal administration read the settings and switch the messages, and never save or test the account", async () => {
    const api = apiFixture(municipal); const controller = createSmsSettingsController(api, "municipality-a", false, true);
    await controller.load();
    expect(api.getSmsSettings).toHaveBeenCalledWith("municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ ready: true, config: { active: true, hasToken: false, tokenPreview: "", municipalityName: "Test Town" } });
    await controller.setUseActive("schedule_confirmed", true);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "schedule_confirmed", true);
    controller.setToken("new-token"); controller.setConfirmingRemoval(true); controller.setTestPhone("(48) 99999-1234");
    await controller.saveToken(); await controller.toggleActive(false); await controller.removeToken(); await controller.testConnection(); await controller.sendTest();
    expect(api.saveSmsAccount).not.toHaveBeenCalled(); expect(api.testSmsConnection).not.toHaveBeenCalled(); expect(api.sendSmsTest).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ token: "", confirmingRemoval: false, testPhone: "" });
  });

  it("loads only safe metadata: the start of the token and the municipality's messages, never the token", async () => {
    const api = apiFixture(); api.getSmsSettings.mockResolvedValue({ ...stored, token: "server-secret", encryptedToken: "encrypted-secret", tokenPreview: "SMSTOKEN-and-more-secret" });
    const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    expect(api.getSmsSettings).toHaveBeenCalledWith("municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ ready: true, token: "", config: { hasToken: true, active: false, municipalityName: "Test Town", tokenPreview: PREVIEW } });
    expect(controller.getSnapshot().config.uses).toHaveLength(smsUses.length);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("secret");
  });

  it("stores a new token, the channel switch and the removal at once, keeping the token out of the state", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    await controller.toggleActive(true);
    expect(api.saveSmsAccount).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toContain("token");
    controller.setToken("replacement-token"); await controller.saveToken();
    expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ token: "replacement-token" }, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ token: "", notice: "Token salvo.", config: { hasToken: true, tokenPreview: "replacem" } });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("replacement-token");
    await controller.toggleActive(true);
    expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ active: true }, "municipality-a");
    expect(controller.getSnapshot().config.active).toBe(true);
    await controller.toggleActive(false);
    expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ active: false }, "municipality-a");
    controller.setConfirmingRemoval(true); expect(controller.getSnapshot().confirmingRemoval).toBe(true);
    await controller.removeToken();
    expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ clearToken: true }, "municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ token: "", confirmingRemoval: false, config: { active: false, hasToken: false, tokenPreview: "" } });
  });

  it("tests connection with an unsaved token without saving, activating or marking it valid", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load(); controller.setToken("draft-token");
    await controller.testConnection();
    expect(api.testSmsConnection).toHaveBeenCalledWith({ token: "draft-token" });
    expect(api.saveSmsAccount).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ token: "draft-token", config: { active: false }, connection: { valid: true, balance: { credits: 0, sms: 0 } } });
    controller.setToken("another-token");
    expect(controller.getSnapshot().connection).toBeNull();
  });

  it("rejects malformed tokens and refuses secret changes or activation without secure storage", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    for (const token of ["Bearer secret", "bad\nvalue", "bad value"]) {
      controller.setToken(token); await controller.saveToken(); await controller.testConnection();
    }
    expect(api.saveSmsAccount).not.toHaveBeenCalled(); expect(api.testSmsConnection).not.toHaveBeenCalled();
    api.getSmsSettings.mockResolvedValue({ ...stored, hasToken: false, secureStorageAvailable: false });
    await controller.load(); controller.setToken("new-token"); await controller.saveToken();
    expect(api.saveSmsAccount).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toContain("indisponível");
    await controller.testConnection();
    expect(api.testSmsConnection).toHaveBeenLastCalledWith({ token: "new-token" });
    api.getSmsSettings.mockResolvedValue({ ...stored, active: true, secureStorageAvailable: false });
    await controller.load(); await controller.toggleActive(false);
    expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ active: false }, "municipality-a");
    await controller.removeToken(); expect(api.saveSmsAccount).toHaveBeenLastCalledWith({ clearToken: true }, "municipality-a");
  });

  it("turns a message on or off through its own route, and only turns one on while the channel is active", async () => {
    const inactive = apiFixture(); const idle = createSmsSettingsController(inactive, "municipality-a", true, true);
    await idle.load(); await idle.setUseActive("schedule_confirmed", true);
    expect(inactive.setSmsUseActive).not.toHaveBeenCalled();
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    await controller.setUseActive("schedule_confirmed", true);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "schedule_confirmed", true);
    expect(controller.getSnapshot().config.uses.find((row) => row.key === "schedule_confirmed")?.active).toBe(true);
    await controller.setUseActive("password_reset", false);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "password_reset", false);
    expect(controller.getSnapshot().config.uses.find((row) => row.key === "password_reset")?.active).toBe(false);
    expect(api.saveSmsAccount).not.toHaveBeenCalled();
  });

  it("shows a failure of a message switch without exposing the server detail, and a missing answer as a failure", async () => {
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true, true);
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

  it("sends one test message to the typed number through the saved token, and says the provider took it", async () => {
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    await controller.sendTest();
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    expect(controller.getSnapshot().testOutcome).toEqual({ sent: false, reason: "Informe um número para o teste.", detail: "", providerMessageId: "" });
    controller.setTestPhone("  (48) 99999-1234  "); expect(controller.getSnapshot().testOutcome).toBeNull();
    await controller.sendTest();
    expect(api.sendSmsTest).toHaveBeenCalledTimes(1);
    expect(api.sendSmsTest).toHaveBeenLastCalledWith("municipality-a", "(48) 99999-1234");
    expect(controller.getSnapshot()).toMatchObject({ sendingTest: false, testPhone: "  (48) 99999-1234  ", testOutcome: { sent: true, reason: "", detail: "", providerMessageId: "4321" } });
    expect(api.saveSmsAccount).not.toHaveBeenCalled();
    controller.setTestPhone("48999990000"); expect(controller.getSnapshot().testOutcome).toBeNull();
  });

  it("asks for a saved token before testing, and clears the result when the channel or the token changes", async () => {
    const api = apiFixture(withoutToken); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load(); controller.setTestPhone("48999991234"); await controller.sendTest();
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    expect(controller.getSnapshot().testOutcome).toEqual({ sent: false, reason: "Salve o token antes de enviar um teste.", detail: "", providerMessageId: "" });
    const saved = apiFixture(channelOn); const next = createSmsSettingsController(saved, "municipality-a", true, true);
    await next.load(); next.setTestPhone("48999991234"); await next.sendTest();
    expect(next.getSnapshot().testOutcome?.sent).toBe(true);
    await next.toggleActive(false); expect(next.getSnapshot().testOutcome).toBeNull();
    await next.sendTest(); await next.removeToken(); expect(next.getSnapshot().testOutcome).toBeNull();
  });

  it("tells why a test was not sent, with the server's words for a refused number or too many tests and nothing else of the failure", async () => {
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load(); controller.setTestPhone("48999991234");
    const outcome = () => controller.getSnapshot().testOutcome;
    api.sendSmsTest.mockResolvedValue({ status: "skipped", reason: "Ative o SMS antes de enviar um teste." });
    await controller.sendTest(); expect(outcome()).toEqual({ sent: false, reason: "Ative o SMS antes de enviar um teste.", detail: "", providerMessageId: "" });
    api.sendSmsTest.mockResolvedValue({ status: "failed", reason: "Saldo de SMS insuficiente.", providerMessageId: "must-not-show" });
    await controller.sendTest(); expect(outcome()).toEqual({ sent: false, reason: "Saldo de SMS insuficiente.", detail: "", providerMessageId: "" });
    api.sendSmsTest.mockResolvedValue({ status: "failed", reason: "Não foi possível confirmar o aceite da mensagem.", detail: "externalId: enviado com 36 caracteres, devolvido com 32 caracteres" });
    await controller.sendTest();
    expect(outcome()).toEqual({ sent: false, reason: "Não foi possível confirmar o aceite da mensagem.", detail: "externalId: enviado com 36 caracteres, devolvido com 32 caracteres", providerMessageId: "" });
    api.sendSmsTest.mockResolvedValue({ status: "failed" });
    await controller.sendTest(); expect(outcome()?.reason).toBe("erro desconhecido");
    api.sendSmsTest.mockResolvedValue(null as never);
    await controller.sendTest(); expect(outcome()).toMatchObject({ sent: false, reason: "erro desconhecido" });
    api.sendSmsTest.mockRejectedValue(Object.assign(new Error("Informe um telefone válido com DDD."), { status: 400 }));
    await controller.sendTest(); expect(outcome()?.reason).toBe("Informe um telefone válido com DDD.");
    api.sendSmsTest.mockRejectedValue(Object.assign(new Error("Muitos testes de envio. Aguarde alguns minutos."), { status: 429 }));
    await controller.sendTest(); expect(outcome()?.reason).toBe("Muitos testes de envio. Aguarde alguns minutos.");
    api.sendSmsTest.mockRejectedValue(Object.assign(new Error("raw-provider-secret"), { status: 502 }));
    await controller.sendTest(); expect(outcome()?.reason).toBe("Não foi possível enviar o teste. Tente novamente."); expect(JSON.stringify(outcome())).not.toContain("secret");
    api.sendSmsTest.mockRejectedValue(Object.assign(new Error("raw-provider-secret"), { status: 403 }));
    await controller.sendTest(); expect(outcome()?.reason).toContain("Sem permissão");
    expect(controller.getSnapshot()).toMatchObject({ sendingTest: false, error: "" });
  });

  it("sends the test only to a complete mobile number: eleven digits, with the DDD and the 9", async () => {
    const api = apiFixture(channelOn); const controller = createSmsSettingsController(api, "municipality-a", true, true); await controller.load();
    for (const phone of ["(48) 9999-9999", "(48) 99999-12", "48", "(48) 99999-12345", "abc"]) {
      controller.setTestPhone(phone); await controller.sendTest();
      expect(controller.getSnapshot().testOutcome).toEqual({ sent: false, reason: "Informe o celular completo, com DDD e o 9: (00) 00000-0000.", detail: "", providerMessageId: "" });
    }
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    controller.setTestPhone("(48) 99999-1234"); await controller.sendTest();
    expect(api.sendSmsTest).toHaveBeenCalledTimes(1);
  });

  it("keeps one test in flight and ignores its answer after another municipality opens", async () => {
    const api = apiFixture(channelOn); const old = createSmsSettingsController(api, "municipality-a", true, true); await old.load();
    const pending = deferred<{ status: string; providerMessageId: string }>(); api.sendSmsTest.mockReturnValue(pending.promise);
    old.setTestPhone("48999991234"); const sending = old.sendTest();
    expect(old.getSnapshot().sendingTest).toBe(true);
    await old.sendTest(); await old.testConnection(); await old.toggleActive(false); old.setTestPhone("48988887777");
    expect(api.sendSmsTest).toHaveBeenCalledTimes(1); expect(api.testSmsConnection).not.toHaveBeenCalled(); expect(api.saveSmsAccount).not.toHaveBeenCalled();
    expect(old.getSnapshot().testPhone).toBe("48999991234");
    old.cancel(); const next = createSmsSettingsController(api, "municipality-b", true, true); await next.load();
    pending.resolve({ status: "sent", providerMessageId: "4321" }); await sending;
    expect(next.getSnapshot().testOutcome).toBeNull(); expect(old.getSnapshot()).toMatchObject({ testOutcome: null, sendingTest: false, testPhone: "" });
  });

  it("discards late load, save and message responses after cancellation without retaining draft secrets", async () => {
    const api = apiFixture(withoutToken); const pendingLoad = deferred<typeof stored>(); api.getSmsSettings.mockReturnValue(pendingLoad.promise);
    const controller = createSmsSettingsController(api, "municipality-a", true, true);
    const loading = controller.load(); controller.cancel(); pendingLoad.resolve(stored); await loading;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, loading: false, token: "" });
    api.getSmsSettings.mockResolvedValue(withoutToken); await controller.load(); controller.setToken("discard-me");
    const pendingSave = deferred<typeof stored>(); api.saveSmsAccount.mockReturnValue(pendingSave.promise);
    const saving = controller.saveToken(); controller.cancel(); pendingSave.resolve({ ...stored, active: true }); await saving;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, saving: false, token: "", notice: "", config: { active: false } });
    await controller.saveToken(); expect(api.saveSmsAccount).toHaveBeenCalledTimes(1);
    api.getSmsSettings.mockResolvedValue(channelOn); await controller.load();
    const pendingUse = deferred<typeof stored>(); api.setSmsUseActive.mockReturnValue(pendingUse.promise);
    const switching = controller.setUseActive("completed", true); controller.cancel(); pendingUse.resolve({ ...channelOn }); await switching;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, saving: false, error: "" });
  });

  it("ignores an old connection response after another municipality opens and permits one in-flight action", async () => {
    const api = apiFixture(); const old = createSmsSettingsController(api, "municipality-a", true, true); await old.load();
    const pending = deferred<SmsConnectionResult>(); api.testSmsConnection.mockReturnValue(pending.promise);
    const testing = old.testConnection(); await old.saveToken(); await old.removeToken(); await old.toggleActive(true); await old.testConnection();
    expect(api.testSmsConnection).toHaveBeenCalledTimes(1); expect(api.saveSmsAccount).not.toHaveBeenCalled();
    old.cancel(); const next = createSmsSettingsController(api, "municipality-b", true, true); await next.load();
    pending.resolve(connected); await testing;
    expect(next.getSnapshot().connection).toBeNull(); expect(old.getSnapshot().connection).toBeNull();
    expect(api.getSmsSettings).toHaveBeenLastCalledWith("municipality-b");
  });

  it("handles invalid connection envelopes and failures without displaying provider secrets", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true, true); await controller.load();
    api.testSmsConnection.mockResolvedValue({ ...connected, valid: false, reason: "raw-provider-secret" });
    await controller.testConnection();
    expect(controller.getSnapshot().connection).toBeNull(); expect(controller.getSnapshot().error).not.toContain("secret");
    api.testSmsConnection.mockRejectedValue(Object.assign(new Error("raw-provider-secret"), { status: 403 }));
    await controller.testConnection(); expect(controller.getSnapshot().error).toContain("Sem permissão");
    api.saveSmsAccount.mockRejectedValue(new Error("raw-provider-secret")); await controller.toggleActive(true);
    expect(controller.getSnapshot().error).not.toContain("secret"); expect(controller.getSnapshot().saving).toBe(false);
  });
});

describe("SMS settings interface", () => {
  const view = (overrides: Partial<ReturnType<typeof useSmsSettings>> = {}) => {
    const controller = createSmsSettingsController(apiFixture(), "municipality-a", true, true);
    return { ...controller.getSnapshot(), config: stored, ready: true, loading: false, retry: controller.load, setToken: controller.setToken,
      setConfirmingRemoval: controller.setConfirmingRemoval, saveToken: controller.saveToken, toggleActive: controller.toggleActive,
      removeToken: controller.removeToken, setUseActive: controller.setUseActive, testConnection: controller.testConnection,
      setTestPhone: controller.setTestPhone, sendTest: controller.sendTest, ...overrides };
  };
  const screen = (overrides: Partial<ReturnType<typeof useSmsSettings>> = {}, props: Partial<React.ComponentProps<typeof SmsSettings>> = {}) => {
    vi.mocked(useSmsSettings).mockReturnValue(view(overrides));
    return renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" master canManage canEditContract={false} {...props} />);
  };
  beforeEach(() => { vi.mocked(useSmsSettings).mockReturnValue(view()); vi.mocked(useMessageContract).mockReturnValue(contractState); });

  it("shows a saved token by its start only, with a confirmed removal and no way to read it whole", () => {
    const saved = screen();
    expect(saved).toContain(`value="${PREVIEW}${"•".repeat(24)}"`); expect(saved).toContain("readonly=\"\"");
    expect(saved).toContain("Remover token"); expect(saved).not.toContain("Salvar credenciais");
    expect(saved).toContain("Testar conexão / Consultar saldo"); expect(saved).not.toContain("Enviar SMS");
    const confirming = screen({ confirmingRemoval: true });
    expect(confirming).toContain("Confirmar"); expect(confirming).toContain("O SMS será desativado para todos os municípios.");
  });

  it("asks for the token when none is saved, and shows the start of what is being typed", () => {
    const empty = screen({ config: withoutToken });
    expect(empty).toContain('type="password"'); expect(empty).toContain("Salvar credenciais"); expect(empty).not.toContain("Remover token");
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>Salvar credenciais/);
    const typing = screen({ config: withoutToken, token: "typed-token-value" });
    expect(typing).toContain("<code>typed-to</code>"); expect(typing).not.toMatch(/<button[^>]*disabled=""[^>]*>Salvar credenciais/);
  });

  it("lists the nine messages with their text as it goes out, named for the municipality, and the two texts of the documents told apart", () => {
    const html = screen();
    expect(html.match(/<tr>/g)).toHaveLength(smsUses.length + 1);
    for (const use of smsUses) expect(html).toContain(use.label);
    expect(html).toContain("Test Town: recebemos um pedido para redefinir sua senha. Codigo: {codigo}. Valido por {minutos} minutos. Nao compartilhe.");
    expect(html).toContain("Test Town: atendimento de castracao concluido! Obrigado pelo cuidado com seu animal. Protocolo: {protocolo}.");
    expect(html).toContain("<th>Texto</th>"); expect(html).not.toContain("Exemplo");
    expect(html).toContain("<strong>Documentos aprovados</strong><br/>Test Town: seus documentos foram aprovados e a solicitacao segue para as proximas etapas. Protocolo: {protocolo}.");
    expect(html).toContain("<strong>Documentos não aprovados</strong><br/>Test Town: seus documentos nao foram aprovados. Acesse a solicitacao para ver o motivo. Protocolo: {protocolo}.");
    expect(html.match(/<strong>Documentos/g)).toHaveLength(2);
    expect(screen({ config: { ...stored, municipalityName: "" } })).toContain("Municipio: recebemos um pedido para redefinir sua senha.");
  });

  it("locks every switch while the channel is inactive, and unlocks them with the stored state once it is active", () => {
    const locked = screen();
    expect(locked.match(/<td><div class="integration-table-actions">/g)).toHaveLength(smsUses.length);
    expect(locked.match(/role="switch"/g)).toHaveLength(smsUses.length);
    expect(locked.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(smsUses.length);
    expect(locked.match(/aria-label="O SMS precisa estar ativo na plataforma para ligar as mensagens\."/g)).toHaveLength(smsUses.length);
    expect(locked).not.toContain('aria-checked="true"');
    const open = screen({ config: channelOn });
    expect(open).not.toMatch(/<button[^>]*role="switch"[^>]*disabled=""/);
    expect(open).not.toContain("O SMS precisa estar ativo na plataforma");
    expect(open.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(open).toContain('aria-label="Desativar Recuperação de senha"');
    expect(open).toContain('aria-label="Ativar Agendamento confirmado"');
  });

  it("asks for a number to test next to the credentials, and only lets it go with a saved token", () => {
    const html = screen();
    expect(html).toContain("Teste de envio"); expect(html).toContain("Número"); expect(html).toContain("Enviar teste");
    expect(html).toContain('placeholder="(00) 00000-0000"');
    expect(html.indexOf("Credenciais")).toBeLessThan(html.indexOf("Teste de envio")); expect(html.indexOf("Teste de envio")).toBeLessThan(html.indexOf("Mensagens"));
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Enviar teste/);
    expect(screen({ config: withoutToken })).toMatch(/<button[^>]*disabled=""[^>]*>Enviar teste/);
    const sending = screen({ sendingTest: true });
    expect(sending).toMatch(/<button[^>]*disabled=""[^>]*>Enviando\.\.\./); expect(sending).not.toContain("Enviar teste");
    expect(screen({ testPhone: "48999991234" })).toContain('value="48999991234"');
  });

  it("masks the number as it is typed: (00) 00000-0000, digits only, never more than eleven", () => {
    const setTestPhone = vi.fn();
    const tree = SmsCredentials({ state: view({ setTestPhone }) }) as React.ReactElement<{ children: React.ReactNode }>;
    const find = (node: React.ReactNode): React.ReactElement<{ onChange?: (value: string) => void; type?: string }> | null => {
      if (!React.isValidElement(node)) return Array.isArray(node) ? node.map(find).find(Boolean) ?? null : null;
      const props = node.props as { label?: string; children?: React.ReactNode };
      return props.label === "Número" ? node as never : find(props.children);
    };
    const field = find(tree);
    expect(field?.props.type).toBe("tel");
    for (const [typed, shown] of [["4", "4"], ["48", "48"], ["489", "(48) 9"], ["48999991234", "(48) 99999-1234"], ["489999912345678", "(48) 99999-1234"],
      ["(48) 99999-12a34", "(48) 99999-1234"], ["abc", ""], ["", ""]]) {
      setTestPhone.mockClear(); field?.props.onChange?.(typed);
      expect(setTestPhone).toHaveBeenCalledWith(shown);
    }
  });

  it("shows the result of a test: taken by the provider with its code, and told to check the phone, or why it was not sent", () => {
    expect(screen()).not.toContain("sms-status");
    const sent = screen({ testOutcome: { sent: true, reason: "", detail: "", providerMessageId: "4321" } });
    expect(sent).toContain('class="sms-status confirmed"'); expect(sent).toContain("Teste enviado ao provedor (código 4321).");
    expect(sent).toContain("a entrega depende da operadora"); expect(sent).not.toContain("com sucesso");
    expect(screen({ testOutcome: { sent: true, reason: "", detail: "", providerMessageId: "" } })).toContain("Teste enviado ao provedor. Confira");
    const refused = screen({ testOutcome: { sent: false, reason: "Saldo de SMS insuficiente.", detail: "", providerMessageId: "" } });
    expect(refused).toContain('class="sms-status"'); expect(refused).toContain("Não enviado: Saldo de SMS insuficiente."); expect(refused).not.toContain("confirmed");
    expect(refused).not.toContain("Detalhe");
    const mismatch = screen({ testOutcome: { sent: false, reason: "Não foi possível confirmar o aceite da mensagem.", detail: "to: enviado com 13 dígitos, devolvido com 12 dígitos", providerMessageId: "" } });
    expect(mismatch).toContain("Não enviado: Não foi possível confirmar o aceite da mensagem. Detalhe: to: enviado com 13 dígitos, devolvido com 12 dígitos.");
  });

  it("does not render settings for unauthorized contexts, and asks a municipal administrator without a municipality for one", () => {
    expect(screen({}, { canManage: false })).not.toContain("Credenciais");
    expect(screen({}, { municipalityId: "", master: false })).toContain("Selecione um município");
    expect(screen({}, { municipalityId: "", master: false })).not.toContain("Credenciais");
  });

  it("shows the credentials only to the master, and the municipal administration only the messages", () => {
    vi.mocked(useSmsSettings).mockReturnValue(view({ config: municipal }));
    const admin = renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" master={false} canManage canEditContract={false} />);
    for (const hidden of ["Credenciais", "Teste de envio", "Token de API SMSMais", "Enviar teste", "Remover token"]) expect(admin).not.toContain(hidden);
    expect(admin).toContain("<table"); expect(admin).toContain("Mensagens");
    expect(admin).not.toMatch(/role="switch"[^>]*disabled=""/);
    expect(screen()).toContain("Credenciais");
  });

  it("lets the master work on the account with no municipality, while the messages wait for one", () => {
    const html = screen({}, { municipalityId: "" });
    expect(html).toContain("Credenciais"); expect(html).toContain("Teste de envio");
    expect(html).toContain("Selecione um município para ligar ou desligar as mensagens.");
    expect(html.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(smsUses.length);
    expect(html).not.toContain('aria-label="Estado da integração"');
    expect(screen()).not.toContain("Selecione um município");
  });

  it("counts the messages of the contract at the top, and offers the contract only to who edits it", () => {
    const viewer = screen();
    expect(viewer).toContain('aria-label="Estado da integração"'); expect(viewer).toContain("12/500"); expect(viewer).toContain("Contrato vigente");
    expect(viewer).not.toContain("Contrato e cota"); expect(viewer).not.toContain("Salvar cota");
    expect(viewer.indexOf('aria-label="Estado da integração"')).toBeLessThan(viewer.indexOf("Credenciais"));
    const editor = screen({}, { canEditContract: true });
    expect(editor).toContain("Contrato e cota"); expect(editor).toContain("Salvar cota");
    expect(editor).toContain("Serviço ativo para este município"); expect(viewer).not.toContain("Serviço ativo para este município");
    expect(editor.indexOf("Mensagens")).toBeLessThan(editor.indexOf("Contrato e cota"));
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("sms", "municipality-a");
    screen({}, { canManage: false });
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("sms", "");
  });

  it("locks the messages and marks the channel inactive while the service is switched off for the municipality, telling why", () => {
    vi.mocked(useMessageContract).mockReturnValue({ ...contractState, live: { ...contractState.live, enabled: false } });
    const off = screen({ config: channelOn });
    expect(off).toContain("Inativo"); expect(off).not.toContain("whatsapp-dot--on");
    expect(off.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(smsUses.length);
    expect(off.match(/aria-label="O serviço de SMS está desativado para este município\."/g)).toHaveLength(smsUses.length);
    expect(off).not.toContain('aria-checked="true"');
    const platformOff = screen({ config: { ...channelOn, active: false } });
    expect(platformOff).toContain("O SMS precisa estar ativo na plataforma para ligar as mensagens.");
    vi.mocked(useMessageContract).mockReturnValue(contractState);
    expect(screen({ config: channelOn })).not.toContain("O serviço de SMS está desativado");
    expect(screen({ config: channelOn })).toContain("Ativo");
  });

  it("shows loading, and an error with a way to try again but without the settings", () => {
    expect(screen({ ready: false, loading: true })).toContain("Carregando configuração de SMS...");
    const failed = screen({ ready: false, error: "Não foi possível carregar a configuração de SMS." });
    expect(failed).toContain("Não foi possível carregar a configuração de SMS."); expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("Credenciais"); expect(failed).not.toContain("<table"); expect(failed).not.toContain('aria-label="Estado da integração"');
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
