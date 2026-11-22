import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactKind } from "../../../shared/auth-contract.js";
import { AccessStep, initialAccessState } from "./access-state";
import type { AccessView } from "./access-types";
import { RequestAccess } from "./request-access";

const hook = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./use-request-access", () => ({ useRequestAccess: () => hook.state }));

const view = (exists: boolean) => ({ request: { protocol: "000123/2026", cpf: "52998224725" }, account: { exists } }) as AccessView;
function render(state: Record<string, unknown> = {}, municipalityId = "municipality-a") {
  hook.state = { ...initialAccessState({ protocol: "000123/2026", cpf: "52998224725" }), clock: { retryIn: 0, expiresIn: 600 },
    send: vi.fn(), open: vi.fn(), createPassword: vi.fn(), edit: vi.fn(), correct: vi.fn(), ...state };
  return renderToStaticMarkup(<RequestAccess municipalityId={municipalityId} createRequirement={async () => "data:application/pdf;base64,AAAA"} onSession={vi.fn()} onLogin={vi.fn()} />);
}

describe("Acessar minha solicitação", () => {
  beforeEach(() => { hook.state = {}; });

  it("marks the protocol and the CPF as required in their titles, and keeps every main button on the right", () => {
    const html = render();
    expect(html).toContain('>Protocolo<span class="required-asterisk">*</span></span>');
    expect(html).toContain('>CPF do tutor<span class="required-asterisk">*</span></span>');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"/);
    expect(render({ step: AccessStep.CODE, challenge: { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 } })).toContain("tw:flex tw:flex-wrap tw:justify-end tw:gap-2");
    expect(render({ step: AccessStep.VERIFIED, token: "access-token", view: view(false) })).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"[^>]*>Criar minha senha/);
    expect(render({ step: AccessStep.VERIFIED, token: "access-token", view: view(true) })).toMatch(/<button[^>]*class="[^"]*tw:justify-self-end[^"]*"[^>]*>Entrar/);
  });

  it("asks for the protocol, the tutor's CPF and where to receive the code, already filled from the link or the last screen", () => {
    const html = render();
    expect(html).toContain('aria-label="Acessar minha solicitação"');
    expect(html).not.toContain("<h2");
    expect(html).toContain("Enviamos o código para o contato informado na solicitação.");
    expect(html).toContain('value="000123/2026"'); expect(html).toContain('value="529.982.247-25"');
    expect(html).toContain("Receber o código por"); expect(html).toContain("E-mail"); expect(html).toContain("Celular");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Enviar código</);
    expect(html).not.toMatch(/Senha inicial|senha temporária/i);
  });

  it("without a municipality asks to choose one, and a wait blocks a new code", () => {
    expect(render({}, "")).toContain("Selecione o município na página");
    expect(render({ clock: { retryIn: 42, expiresIn: 600 } })).toContain("Aguarde 42s");
  });

  it("asks for the code saying where it went, never the contact itself", () => {
    const html = render({ step: AccessStep.CODE, channel: ContactKind.PHONE, challenge: { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 } });
    expect(html).toMatch(/<h3[^>]*>Digite o código<\/h3>/);
    expect(html).toContain("para o celular informado na solicitação");
    expect(html).toContain("Abrir solicitação"); expect(html).toContain("Reenviar código"); expect(html).toContain("Corrigir dados");
    expect(render({ step: AccessStep.CODE, clock: { retryIn: 0, expiresIn: 0 }, challenge: { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 } })).toContain("Código expirado");
  });

  it("once open, offers the request document and the creation of the password", () => {
    const html = render({ step: AccessStep.VERIFIED, token: "access-token", view: view(false) });
    expect(html).toContain("Solicitação 000123/2026");
    expect(html).toContain("Baixar requerimento");
    expect(html).toMatch(/<h4[^>]*>Criar minha senha<\/h4>/);
    expect(html.match(/type="password"/g)?.length).toBe(2);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Criar minha senha</);
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
