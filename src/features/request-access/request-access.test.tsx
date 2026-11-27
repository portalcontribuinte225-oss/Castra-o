import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { AccessStep, initialAccessState } from "./access-state";
import type { AccessedRequest, AccessView } from "./access-types";
import { RequestAccess } from "./request-access";

const hook = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./use-request-access", () => ({ useRequestAccess: () => hook.state }));

const allChannels = [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP, NotificationChannel.SMS];
const accessed = (protocol: string, overrides: Partial<AccessedRequest> = {}) => ({
  protocol, status: "AGENDADA", request_type: "", created_at: "2026-11-02T12:00:00.000Z", updated_at: "2026-11-03T12:00:00.000Z",
  schedule_date: "2026-11-20", schedule_location_name: "Unidade Exemplo", schedule_address: "Rua Exemplo, 100", cpf: "52998224725",
  documents: { total: 3, approved: 1, needsCorrection: 1, pending: 1 }, ...overrides,
}) as AccessedRequest;
const view = (exists: boolean) => ({
  requests: [accessed("000123/2026"), accessed("000045/2026", { status: "NOVA", schedule_date: "", schedule_location_name: "", schedule_address: "",
    documents: { total: 0, approved: 0, needsCorrection: 0, pending: 0 } })],
  account: { exists },
}) as AccessView;

function render(state: Record<string, unknown> = {}, municipalityId = "municipality-a") {
  hook.state = { ...initialAccessState({ cpf: "52998224725" }), channel: NotificationChannel.EMAIL, clock: { retryIn: 0, expiresIn: 600 },
    availableChannels: { channels: allChannels, loading: false, error: "", retry: vi.fn() },
    send: vi.fn(), open: vi.fn(), createPassword: vi.fn(), edit: vi.fn(), correct: vi.fn(), ...state };
  return renderToStaticMarkup(<RequestAccess municipalityId={municipalityId} createRequirement={async () => "data:application/pdf;base64,AAAA"} onSession={vi.fn()} onLogin={vi.fn()} />);
}

describe("Acompanhar solicitação", () => {
  beforeEach(() => { hook.state = {}; });

  it("marks the CPF as required in its title, asks no protocol, and keeps every main button on the right", () => {
    const html = render();
    expect(html).toContain('>CPF do tutor<span class="required-asterisk">*</span></span>');
    expect(html).not.toContain("Protocolo");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"/);
    expect(render({ step: AccessStep.CODE, challenge: { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 } })).toContain("tw:flex tw:flex-wrap tw:justify-end tw:gap-2");
    expect(render({ step: AccessStep.VERIFIED, token: "access-token", view: view(false) })).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"[^>]*>Criar minha senha/);
    expect(render({ step: AccessStep.VERIFIED, token: "access-token", view: view(true) })).toMatch(/<button[^>]*class="[^"]*tw:justify-self-end[^"]*"[^>]*>Entrar/);
  });

  it("asks only the tutor's CPF, already filled from the last screen, and offers the channels the municipality has on", () => {
    const html = render();
    expect(html).toContain('aria-label="Acompanhar solicitação"');
    expect(html).not.toContain("<h2");
    expect(html).toContain("Informe o CPF do tutor. Enviamos um código para o contato informado na solicitação.");
    expect(html).toContain('value="529.982.247-25"');
    expect(html).toContain("Receber o código por");
    for (const label of ["E-mail", "WhatsApp", "SMS"]) expect(html).toContain(label);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Enviar código</);
    expect(html).not.toMatch(/Senha inicial|senha temporária/i);
    const smsOnly = render({ channel: NotificationChannel.SMS, availableChannels: { channels: [NotificationChannel.SMS], loading: false, error: "", retry: vi.fn() } });
    expect(smsOnly).toContain("SMS");
    expect(smsOnly).not.toContain("WhatsApp");
  });

  it("while the channels load, when they fail or when none is on, it cannot send the code", () => {
    const loading = render({ channel: "", availableChannels: { channels: [], loading: true, error: "", retry: vi.fn() } });
    expect(loading).toContain("Carregando as formas de envio do código");
    expect(loading).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>Enviar código</);
    const failed = render({ channel: "", availableChannels: { channels: [], loading: false, error: "Não foi possível carregar as formas de envio do código.", retry: vi.fn() } });
    expect(failed).toContain("Não foi possível carregar as formas de envio do código.");
    expect(failed).toContain("Tentar novamente");
    const none = render({ channel: "", availableChannels: { channels: [], loading: false, error: "", retry: vi.fn() } });
    expect(none).toContain("No momento não é possível enviar o código. Procure o atendimento do município.");
    expect(none).not.toContain("Receber o código por");
    expect(none).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>Enviar código</);
  });

  it("without a municipality asks to choose one, and a wait blocks a new code", () => {
    expect(render({}, "")).toContain("Selecione o município na página");
    expect(render({ clock: { retryIn: 42, expiresIn: 600 } })).toContain("Aguarde 42s");
  });

  it("asks for the code saying by which channel it went, never the contact itself", () => {
    const html = render({ step: AccessStep.CODE, channel: NotificationChannel.WHATSAPP, challenge: { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 } });
    expect(html).toMatch(/<h3[^>]*>Digite o código<\/h3>/);
    expect(html).toContain("enviamos um código de 6 dígitos por WhatsApp para o contato informado nela");
    expect(html).toContain("Ver solicitações"); expect(html).toContain("Reenviar código"); expect(html).toContain("Corrigir dados");
    expect(render({ step: AccessStep.CODE, clock: { retryIn: 0, expiresIn: 0 }, challenge: { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 } })).toContain("Código expirado");
  });

  it("once open, shows where each request stands with its own request document, and the creation of the password", () => {
    const html = render({ step: AccessStep.VERIFIED, token: "access-token", view: view(false) });
    expect(html).toContain("Solicitação 000123/2026");
    expect(html).toContain("Solicitação 000045/2026");
    expect(html).toContain("20/11/2026"); expect(html).toContain("Unidade Exemplo"); expect(html).toContain("Rua Exemplo, 100");
    expect(html).toContain("Sem agenda");
    expect(html).toContain("1 aprovado(s)"); expect(html).toContain("1 precisa(m) de correção"); expect(html).toContain("1 em análise");
    expect(html).toContain("Nenhum documento enviado.");
    expect(html.match(/Baixar requerimento/g)?.length).toBe(2);
    expect(html).toMatch(/<h4[^>]*>Criar minha senha<\/h4>/);
    expect(html.match(/type="password"/g)?.length).toBe(2);
    expect(html).not.toContain(">Entrar<");
  });

  it("when the CPF already has an account, offers to sign in instead and creates nothing", () => {
    const html = render({ step: AccessStep.VERIFIED, token: "access-token", view: view(true), error: "Este CPF já tem acesso. Entre com seu CPF e sua senha." });
    expect(html).toContain("Este CPF já tem acesso neste município");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Entrar</);
    expect(html).toContain("Baixar requerimento");
    expect(html).not.toContain('type="password"');
  });
});
