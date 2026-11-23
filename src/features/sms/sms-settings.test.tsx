import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractState } from "../../../shared/message-quota-contract.js";
import { buildDefaultSmsConfig } from "../../../shared/sms-contract.js";
import { smsUses } from "../../../shared/sms-uses-contract.js";
import { useMessageContract, type MessageContract } from "../message-contract/use-message-contract";
import { createSmsSettingsController } from "./sms-settings-controller";
import { SmsSettings } from "./sms-settings";
import { SmsTestMessage } from "./sms-test-message";
import { useSmsSettings } from "./use-sms-settings";
import type { SmsConfig, SmsSettingsApi } from "./sms-types";

vi.mock("./use-sms-settings", () => ({ useSmsSettings: vi.fn() }));
vi.mock("../message-contract/use-message-contract", () => ({ useMessageContract: vi.fn() }));

const integrated: SmsConfig = { ...buildDefaultSmsConfig(), integrated: true, municipalityName: "Test Town" };
const notIntegrated: SmsConfig = { ...integrated, integrated: false };
const contractState: MessageContract = {
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: vi.fn(), saveStatus: "", saveOk: false,
  ready: true, loadFailed: false, retry: vi.fn(), saving: false, contractOn: true, canTurnOn: true, setActive: vi.fn(),
  live: { plan: 500, used: 12, contractStart: null, contractEnd: "2026-12-31", state: ContractState.IN_FORCE },
};

// A stand-in server that keeps what was stored, so a sequence of changes answers like the real one.
function apiFixture(initial: SmsConfig = integrated) {
  let server = initial;
  return {
    getSmsSettings: vi.fn<SmsSettingsApi["getSmsSettings"]>(async () => server),
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

describe("SMS settings controller", () => {
  it("does not load or mutate without administrative permission, nor for a municipal administrator without a municipality", async () => {
    for (const context of [{ id: "municipality-a", master: true, allowed: false }, { id: "", master: false, allowed: true }]) {
      const api = apiFixture();
      const controller = createSmsSettingsController(api, context.id, context.master, context.allowed);
      await controller.load(); await controller.setUseActive("password_reset", true);
      controller.setTestPhone("(48) 99999-1234"); await controller.sendTest();
      expect(api.getSmsSettings).not.toHaveBeenCalled(); expect(api.setSmsUseActive).not.toHaveBeenCalled(); expect(api.sendSmsTest).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toMatchObject({ testPhone: "", testOutcome: null });
    }
  });

  it("lets the master load with no municipality, and keeps the messages for a municipality", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "", true, true);
    expect(controller.getSnapshot().loading).toBe(true);
    await controller.load();
    expect(api.getSmsSettings).toHaveBeenCalledWith(""); expect(controller.getSnapshot().ready).toBe(true);
    await controller.setUseActive("password_reset", false);
    expect(api.setSmsUseActive).not.toHaveBeenCalled();
  });

  it("lets the municipal administration read the settings and switch the messages, and never send a test", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", false, true);
    await controller.load();
    expect(api.getSmsSettings).toHaveBeenCalledWith("municipality-a");
    expect(controller.getSnapshot()).toMatchObject({ ready: true, config: { integrated: true, municipalityName: "Test Town" } });
    await controller.setUseActive("schedule_confirmed", true);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "schedule_confirmed", true);
    controller.setTestPhone("(48) 99999-1234"); await controller.sendTest();
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ testPhone: "" });
  });

  it("keeps only whether SMS is integrated and the messages, never anything of the token", async () => {
    const api = apiFixture();
    api.getSmsSettings.mockResolvedValue({ ...integrated, token: "server-secret", tokenPreview: "SMSTOKEN-secret", environment: "production", active: true });
    const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    expect(controller.getSnapshot().config).toEqual({ integrated: true, municipalityName: "Test Town", uses: expect.any(Array) });
    expect(controller.getSnapshot().config.uses).toHaveLength(smsUses.length);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("secret");
  });

  it("turns a message on or off through its own route, and only turns one on while SMS is integrated", async () => {
    const off = apiFixture(notIntegrated); const idle = createSmsSettingsController(off, "municipality-a", true, true);
    await idle.load(); await idle.setUseActive("schedule_confirmed", true);
    expect(off.setSmsUseActive).not.toHaveBeenCalled();
    await idle.setUseActive("password_reset", false);
    expect(off.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "password_reset", false);
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    await controller.setUseActive("schedule_confirmed", true);
    expect(api.setSmsUseActive).toHaveBeenLastCalledWith("municipality-a", "schedule_confirmed", true);
    expect(controller.getSnapshot().config.uses.find((row) => row.key === "schedule_confirmed")?.active).toBe(true);
  });

  it("shows a failure of a message switch without exposing the server detail, and a missing answer as a failure", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    api.setSmsUseActive.mockRejectedValue(Object.assign(new Error("raw-provider-secret"), { status: 400 }));
    await controller.setUseActive("completed", true);
    expect(controller.getSnapshot().error).toContain("Não foi possível alterar a mensagem"); expect(controller.getSnapshot().error).not.toContain("secret");
    expect(controller.getSnapshot().saving).toBe(false);
    api.setSmsUseActive.mockResolvedValue(null);
    await controller.setUseActive("completed", true);
    expect(controller.getSnapshot().error).toContain("Não foi possível alterar a mensagem");
    expect(controller.getSnapshot().config.integrated).toBe(true);
  });

  it("sends one test message to the typed number through the server's token, and says the provider took it", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load();
    await controller.sendTest();
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    expect(controller.getSnapshot().testOutcome).toEqual({ sent: false, reason: "Informe um número para o teste.", detail: "", providerMessageId: "" });
    controller.setTestPhone("  (48) 99999-1234  "); expect(controller.getSnapshot().testOutcome).toBeNull();
    await controller.sendTest();
    expect(api.sendSmsTest).toHaveBeenCalledTimes(1);
    expect(api.sendSmsTest).toHaveBeenLastCalledWith("municipality-a", "(48) 99999-1234");
    expect(controller.getSnapshot()).toMatchObject({ sendingTest: false, testPhone: "  (48) 99999-1234  ", testOutcome: { sent: true, reason: "", detail: "", providerMessageId: "4321" } });
    controller.setTestPhone("48999990000"); expect(controller.getSnapshot().testOutcome).toBeNull();
  });

  it("tells that SMS is not integrated instead of sending a test", async () => {
    const api = apiFixture(notIntegrated); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load(); controller.setTestPhone("48999991234"); await controller.sendTest();
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    expect(controller.getSnapshot().testOutcome).toEqual({ sent: false, reason: "O SMS não está integrado.", detail: "", providerMessageId: "" });
  });

  it("tells why a test was not sent, with the server's words for a refused number or too many tests and nothing else of the failure", async () => {
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true, true);
    await controller.load(); controller.setTestPhone("48999991234");
    const outcome = () => controller.getSnapshot().testOutcome;
    api.sendSmsTest.mockResolvedValue({ status: "skipped", reason: "O SMS não está integrado." });
    await controller.sendTest(); expect(outcome()).toEqual({ sent: false, reason: "O SMS não está integrado.", detail: "", providerMessageId: "" });
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
    const api = apiFixture(); const controller = createSmsSettingsController(api, "municipality-a", true, true); await controller.load();
    for (const phone of ["(48) 9999-9999", "(48) 99999-12", "48", "(48) 99999-12345", "abc"]) {
      controller.setTestPhone(phone); await controller.sendTest();
      expect(controller.getSnapshot().testOutcome).toEqual({ sent: false, reason: "Informe o celular completo, com DDD e o 9: (00) 00000-0000.", detail: "", providerMessageId: "" });
    }
    expect(api.sendSmsTest).not.toHaveBeenCalled();
    controller.setTestPhone("(48) 99999-1234"); await controller.sendTest();
    expect(api.sendSmsTest).toHaveBeenCalledTimes(1);
  });

  it("keeps one test in flight and ignores its answer after another municipality opens", async () => {
    const api = apiFixture(); const old = createSmsSettingsController(api, "municipality-a", true, true); await old.load();
    const pending = deferred<{ status: string; providerMessageId: string }>(); api.sendSmsTest.mockReturnValue(pending.promise);
    old.setTestPhone("48999991234"); const sending = old.sendTest();
    expect(old.getSnapshot().sendingTest).toBe(true);
    await old.sendTest(); await old.setUseActive("completed", true); old.setTestPhone("48988887777");
    expect(api.sendSmsTest).toHaveBeenCalledTimes(1); expect(api.setSmsUseActive).not.toHaveBeenCalled();
    expect(old.getSnapshot().testPhone).toBe("48999991234");
    old.cancel(); const next = createSmsSettingsController(api, "municipality-b", true, true); await next.load();
    pending.resolve({ status: "sent", providerMessageId: "4321" }); await sending;
    expect(next.getSnapshot().testOutcome).toBeNull(); expect(old.getSnapshot()).toMatchObject({ testOutcome: null, sendingTest: false, testPhone: "" });
  });

  it("discards late load and message responses after cancellation", async () => {
    const api = apiFixture(); const pendingLoad = deferred<SmsConfig>(); api.getSmsSettings.mockReturnValue(pendingLoad.promise);
    const controller = createSmsSettingsController(api, "municipality-a", true, true);
    const loading = controller.load(); controller.cancel(); pendingLoad.resolve(integrated); await loading;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, loading: false });
    api.getSmsSettings.mockResolvedValue(integrated); await controller.load();
    const pendingUse = deferred<SmsConfig>(); api.setSmsUseActive.mockReturnValue(pendingUse.promise);
    const switching = controller.setUseActive("completed", true); controller.cancel(); pendingUse.resolve({ ...integrated }); await switching;
    expect(controller.getSnapshot()).toMatchObject({ ready: false, saving: false, error: "" });
  });
});

describe("SMS settings interface", () => {
  const view = (overrides: Partial<ReturnType<typeof useSmsSettings>> = {}) => {
    const controller = createSmsSettingsController(apiFixture(), "municipality-a", true, true);
    return { ...controller.getSnapshot(), config: integrated, ready: true, loading: false, retry: controller.load,
      setUseActive: controller.setUseActive, setTestPhone: controller.setTestPhone, sendTest: controller.sendTest, ...overrides };
  };
  const screen = (overrides: Partial<ReturnType<typeof useSmsSettings>> = {}, props: Partial<React.ComponentProps<typeof SmsSettings>> = {}) => {
    vi.mocked(useSmsSettings).mockReturnValue(view(overrides));
    return renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" master canManage {...props} />);
  };
  beforeEach(() => { vi.mocked(useSmsSettings).mockReturnValue(view()); vi.mocked(useMessageContract).mockReturnValue(contractState); });

  it("says beside the title whether SMS is integrated, and nothing of the token", () => {
    const html = screen();
    expect(html.indexOf("<h2>SMS</h2>")).toBeLessThan(html.indexOf("Integrado"));
    for (const hidden of ["Credenciais", "Token de API SMSMais", "SMS_TOKEN", "•", "Ambiente", "Testar conexão", "Consultar saldo", "Créditos", "Homologação", 'readonly=""']) {
      expect(html).not.toContain(hidden);
    }
    expect(screen({ config: notIntegrated })).toContain("Não integrado");
  });

  it("lists the final texts for the municipality and the decisions in independent rows", () => {
    const html = screen();
    expect(html.match(/<tr>/g)).toHaveLength(smsUses.length + 1);
    for (const use of smsUses) expect(html).toContain(use.label);
    expect(html).toContain("Test Town: recebemos um pedido para redefinir sua senha. Código: {codigo}. Válido por {minutos} minutos. Não compartilhe.");
    expect(html).toContain("Test Town: atendimento concluído! Obrigado pelo cuidado com seu animal. Protocolo: {protocolo}.");
    expect(html).toContain("<th>Texto</th>"); expect(html).not.toContain("Exemplo");
    expect(html).toContain("Até 70 caracteres por SMS. Textos maiores seguem em partes de 67 caracteres, e cada parte é cobrada.");
    expect(html.indexOf("Mensagens")).toBeLessThan(html.indexOf("Até 70 caracteres por SMS"));
    expect(html).toContain("<td>Documentos deferidos</td><td>Test Town: um ou mais documentos foram deferidos. Acesse sua solicitação para acompanhar a análise. Protocolo: {protocolo}.</td>");
    expect(html).toContain("<td>Documentos indeferidos</td><td>Test Town: um ou mais documentos foram indeferidos. Acesse sua solicitação para ver o motivo. Protocolo: {protocolo}.</td>");
    expect(screen({ config: { ...integrated, municipalityName: "" } })).toContain("Município: recebemos um pedido para redefinir sua senha.");
  });

  it("locks every message switch while SMS is not integrated, telling why, and unlocks them with the stored state once it is", () => {
    const locked = screen({ config: notIntegrated });
    expect(locked.match(/<td><div class="integration-table-actions">/g)).toHaveLength(smsUses.length);
    expect(locked.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(smsUses.length);
    expect(locked.match(/aria-label="O SMS precisa estar integrado para ligar as mensagens\."/g)).toHaveLength(smsUses.length);
    expect(locked).not.toContain('aria-checked="true"');
    const open = screen();
    expect(open).not.toMatch(/<button[^>]*role="switch"[^>]*disabled=""/);
    expect(open).not.toContain("O SMS precisa estar integrado");
    expect(open.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(open).toContain('aria-label="Desativar Recuperação de senha"');
    expect(open).toContain('aria-label="Ativar Agendamento confirmado"');
  });

  it("puts the send test, the contract and the messages in this order, with no switch but the contract's", () => {
    const html = screen();
    const order = ["Teste de envio", "Contrato e cota", "Mensagens"].map((text) => html.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/type="checkbox"/g)).toHaveLength(1);
    expect(html).toContain("12/500");
    for (const gone of ['aria-label="Estado da integração"', "Ativo na plataforma", "Ativo no município", "O SMS da plataforma está inativo", "Salvar cota", "Encerrar contrato",
      "Zerar cota do mês"]) {
      expect(html).not.toContain(gone);
    }
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("sms", "municipality-a");
    screen({}, { canManage: false });
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("sms", "");
  });

  it("asks for a number to test, and only lets it go while SMS is integrated", () => {
    const html = screen();
    expect(html).toContain("Número"); expect(html).toContain("Enviar teste");
    expect(html).toContain('placeholder="(00) 00000-0000"');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Enviar teste/);
    expect(screen({ config: notIntegrated })).toMatch(/<button[^>]*disabled=""[^>]*>Enviar teste/);
    const sending = screen({ sendingTest: true });
    expect(sending).toMatch(/<button[^>]*disabled=""[^>]*>Enviando\.\.\./); expect(sending).not.toContain("Enviar teste");
    expect(screen({ testPhone: "48999991234" })).toContain('value="48999991234"');
  });

  it("masks the number as it is typed: (00) 00000-0000, digits only, never more than eleven", () => {
    const setTestPhone = vi.fn();
    const tree = SmsTestMessage({ state: view({ setTestPhone }) }) as React.ReactElement<{ children: React.ReactNode }>;
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
    expect(screen({}, { canManage: false })).not.toContain("Teste de envio");
    expect(screen({}, { municipalityId: "", master: false })).toContain("Selecione um município");
    expect(screen({}, { municipalityId: "", master: false })).not.toContain("Teste de envio");
  });

  it("shows the send test only to the master, and the municipal administration the contract state and the messages", () => {
    vi.mocked(useSmsSettings).mockReturnValue(view());
    const admin = renderToStaticMarkup(<SmsSettings municipalityId="municipality-a" master={false} canManage />);
    for (const hidden of ["Teste de envio", "Enviar teste", "Limite mensal", 'type="checkbox"']) expect(admin).not.toContain(hidden);
    expect(admin).toContain("<table"); expect(admin).toContain("Mensagens"); expect(admin).toContain("12/500");
    expect(admin).not.toMatch(/role="switch"[^>]*disabled=""/);
  });

  it("lets the master send a test with no municipality, while the messages and the contract wait for one", () => {
    const html = screen({}, { municipalityId: "" });
    expect(html).toContain("Teste de envio");
    expect(html).not.toContain("Contrato e cota");
    expect(html).toContain("Selecione um município para ligar ou desligar as mensagens.");
    expect(html.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(smsUses.length);
    expect(html).not.toContain('type="checkbox"');
    expect(screen()).not.toContain("Selecione um município");
  });

  it("shows loading, and an error with a way to try again but without the settings", () => {
    expect(screen({ ready: false, loading: true })).toContain("Carregando configuração de SMS...");
    const failed = screen({ ready: false, error: "Não foi possível carregar a configuração de SMS." });
    expect(failed).toContain("Não foi possível carregar a configuração de SMS."); expect(failed).toContain("Carregar novamente");
    for (const hidden of ["Teste de envio", "<table", "Integrado", "Contrato e cota"]) expect(failed).not.toContain(hidden);
    expect(screen({ error: "Não foi possível alterar a mensagem. Tente novamente." })).toContain("<table");
  });
});
