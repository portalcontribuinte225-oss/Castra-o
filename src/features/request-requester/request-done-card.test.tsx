import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RequestDoneCard } from "./request-done-card";

const noop = vi.fn();
const markup = (overrides: Partial<React.ComponentProps<typeof RequestDoneCard>> = {}) => renderToStaticMarkup(
  <RequestDoneCard protocol="000123/2026" createRequirement={async () => "data:application/pdf;base64,AAAA"} closeLabel="Voltar ao início" onClose={noop} {...overrides} />);

describe("the last screen of a request", () => {
  it("says the request was received and is under analysis, with the protocol, the same for the public and for the staff", () => {
    const html = markup();
    expect(html).toContain("Recebemos sua solicitação!"); expect(html).toContain("Ela está em análise.");
    expect(html).toContain("Protocolo oficial:"); expect(html).toContain("<strong>000123/2026</strong>");
    expect(html).toContain("Baixar requerimento");
    expect(html).not.toContain("Solicitação enviada");
  });

  it("closes with the label of the place it is in", () => {
    expect(markup({ closeLabel: "Voltar ao início" })).toContain("Voltar ao início");
    expect(markup({ closeLabel: "Fechar" })).toMatch(/class="primary-action"[^>]*>Fechar</);
  });

  it("tells what was chosen about the notices, with the contacts masked, and says nothing when nothing was chosen", () => {
    expect(markup({ followUp: { enabled: false } })).toContain("Você escolheu não receber avisos");
    const yes = markup({ followUp: { enabled: true, email: "tutor@example.com", phone: "48999991234" } });
    expect(yes).toContain("t*****@example.com"); expect(yes).toContain("(48) *****-1234");
    expect(yes).not.toContain("tutor@example.com"); expect(yes).not.toContain("48999991234");
    expect(markup()).not.toContain("avisos");
  });

  it("offers to create the password only where it is given, after the request document, and never shows a password", () => {
    const html = markup({ onCreatePassword: noop });
    expect(html).toMatch(/class="ghost-button"[^>]*>Criar minha senha</);
    expect(html.indexOf("Baixar requerimento")).toBeLessThan(html.indexOf("Criar minha senha"));
    expect(markup()).not.toContain("Criar minha senha");
    expect(html).not.toMatch(/Senha inicial|senha temporária/i);
  });

  it("starts without an error and with the download ready", () => {
    const html = markup();
    expect(html).not.toContain("form-error"); expect(html).not.toContain("Gerando...");
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });
});
