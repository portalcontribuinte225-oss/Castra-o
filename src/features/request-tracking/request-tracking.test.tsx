import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maskTrackingContact } from "./tracking-contact";
import { RequestTracking } from "./request-tracking";
import { TrackingStep, initialTrackingState } from "./tracking-state";
import type { TrackedRequest } from "./tracking-types";
import { useRequestTracking } from "./use-request-tracking";

vi.mock("./use-request-tracking", () => ({ useRequestTracking: vi.fn() }));

const challenge = { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 };
const tracked: TrackedRequest = {
  protocol: "000123/2026", requestType: "Castração", status: "AGENDADA", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-05T10:00:00.000Z",
  schedule: { date: "20/11/2026 09:00", locationName: "Unidade Municipal", address: "Rua das Flores, 10" },
  documents: { total: 4, approved: 2, needsCorrection: 1, pending: 1 },
};
const actions = { send: vi.fn(), open: vi.fn(), refresh: vi.fn(), edit: vi.fn(), correct: vi.fn(), restart: vi.fn() };

function mockTracking(state: Partial<ReturnType<typeof initialTrackingState>> = {}, clock = { retryIn: 0, expiresIn: 0 }) {
  vi.mocked(useRequestTracking).mockReturnValue({ ...initialTrackingState(), ...state, clock, ...actions });
}
const render = (municipalityId = "town-a") => renderToStaticMarkup(<RequestTracking municipalityId={municipalityId} />);

beforeEach(() => { vi.clearAllMocks(); });

describe("request tracking screens", () => {
  it("marks both fields as required in their titles and places the send button on the right, also beside the code", () => {
    mockTracking();
    const html = render();
    expect(html).toContain('>Protocolo<span class="required-asterisk">*</span></span>');
    expect(html).toContain('>E-mail ou telefone do acompanhamento<span class="required-asterisk">*</span></span>');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"/);
    mockTracking({ step: TrackingStep.CODE });
    expect(render()).toContain("tw:flex tw:flex-wrap tw:justify-end tw:gap-2");
  });

  it("asks for the municipality before anything else", () => {
    mockTracking();
    const html = render("");
    expect(html).toContain("Selecione o município"); expect(html).not.toContain("<form");
  });

  it("explains who can follow a request and keeps the send action disabled until both fields are filled", () => {
    mockTracking();
    const empty = render();
    expect(empty).toContain("Acompanhar solicitação"); expect(empty).toContain("Protocolo"); expect(empty).toContain("E-mail ou telefone do acompanhamento");
    expect(empty).toContain("escolheu receber avisos"); expect(empty).toContain("Enviar código");
    expect(empty).not.toContain("<h2");
    expect(empty).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/);
    mockTracking({ protocol: "000123/2026", contact: "citizen@example.com" });
    expect(render()).toMatch(/<button(?=[^>]*type="submit")(?![^>]*disabled="")[^>]*>Enviar código/);
  });

  it("shows the waiting time after a send and after a rate limit", () => {
    mockTracking({ protocol: "000123/2026", contact: "citizen@example.com" }, { retryIn: 30, expiresIn: 0 });
    const html = render();
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>Aguarde 30s/);
  });

  it("answers the same way whether or not the request exists and only echoes the masked contact", () => {
    mockTracking({ step: TrackingStep.CODE, challenge, protocol: "000123/2026", contact: "citizen@example.com" }, { retryIn: 0, expiresIn: 590 });
    const html = render();
    expect(html).toContain("Se os dados conferirem"); expect(html).toContain("c*****@example.com"); expect(html).toContain("10 minutos");
    expect(html).not.toContain("citizen@example.com"); expect(html).not.toContain("não encontrada"); expect(html).not.toContain("não existe");
    expect(html).toContain("Código recebido"); expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain("Reenviar código"); expect(html).toContain("Corrigir dados");
  });

  it("blocks consulting before six digits are typed or after the code expired, and blocks resending while waiting", () => {
    mockTracking({ step: TrackingStep.CODE, challenge, contact: "48999991234", code: "123" }, { retryIn: 20, expiresIn: 0 });
    const html = render();
    expect(html).toContain("(48) *****-1234"); expect(html).not.toContain("48999991234");
    expect(html).toContain("Código expirado"); expect(html).toContain("Reenviar em 20s");
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>Consultar solicitação/);
    mockTracking({ step: TrackingStep.CODE, challenge, contact: "citizen@example.com", code: "123456" }, { retryIn: 0, expiresIn: 300 });
    expect(render()).toMatch(/<button(?=[^>]*type="submit")(?![^>]*disabled="")[^>]*>Consultar solicitação/);
  });

  it("shows a failure as an alert on every step", () => {
    mockTracking({ error: "Código inválido ou expirado. Solicite um novo código.", step: TrackingStep.CODE, challenge, contact: "citizen@example.com" }, { retryIn: 0, expiresIn: 300 });
    const html = render();
    expect(html).toContain('role="alert"'); expect(html).toContain("Código inválido ou expirado");
  });

  it("shows only the situation of the request once the code is accepted", () => {
    mockTracking({ step: TrackingStep.VIEW, token: "tracking-token", request: tracked });
    const html = render();
    expect(html).toContain("Solicitação #000123/2026"); expect(html).toContain("Agendada"); expect(html).toContain("Castração");
    expect(html).toContain("20/11/2026 09:00"); expect(html).toContain("Unidade Municipal"); expect(html).toContain("Rua das Flores, 10");
    expect(html).toContain("2 aprovado(s)"); expect(html).toContain("1 precisa(m) de correção"); expect(html).toContain("1 em análise");
    expect(html).toContain("não são exibidos"); expect(html).toContain("Nova consulta"); expect(html).toContain("Atualizar");
    expect(html).not.toContain("tracking-token"); expect(html).not.toContain("citizen@example.com");
  });

  it("handles a request without schedule or documents", () => {
    mockTracking({ step: TrackingStep.VIEW, token: "tracking-token", request: { ...tracked, schedule: null, documents: { total: 0, approved: 0, needsCorrection: 0, pending: 0 } } });
    const html = render();
    expect(html).toContain("Sem agenda"); expect(html).toContain("Nenhum documento enviado");
    expect(html).not.toContain("aprovado(s)"); expect(html).not.toContain("Endereço do local");
  });
});

describe("tracking contact echo", () => {
  it("masks e-mails and phones and falls back to a neutral phrase", () => {
    expect(maskTrackingContact(" Citizen@Example.com ")).toBe("C*****@Example.com");
    expect(maskTrackingContact("(48) 99999-1234")).toBe("(48) *****-1234");
    expect(maskTrackingContact("12")).toBe("o contato informado");
    expect(maskTrackingContact("@")).toBe("o contato informado");
  });
});
