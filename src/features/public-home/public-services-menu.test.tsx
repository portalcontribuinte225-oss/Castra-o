import { AlertCircle, ClipboardCheck, Search, Shield } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicMenuButton, PublicServiceButtons, PublicServicesMenu } from "./public-services-menu";

const services = [
  { id: "procedure_form", label: "Solicitar procedimento", icon: ClipboardCheck },
  { id: "tracking", label: "Acompanhar solicitação", icon: Search },
  { id: "credential", label: "Credenciamento", icon: Shield },
  { id: "report", label: "Denunciar", icon: AlertCircle, danger: true },
];
const noop = () => {};

describe("public services menu", () => {
  it("opens as a dialog from the ☰ button of a phone", () => {
    const html = renderToStaticMarkup(<PublicMenuButton expanded={false} onClick={noop} />);
    expect(html).toMatch(/<button(?=[^>]*aria-haspopup="dialog")(?=[^>]*aria-expanded="false")[^>]*>.*Menu<\/button>/);
  });

  it("lists the services and the sign-in, marking the open service", () => {
    const html = renderToStaticMarkup(
      <PublicServicesMenu services={services} activeServiceId="tracking" onSelect={noop} onEnter={noop} onClose={noop} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Fechar menu"');
    const nav = html.match(/<nav[^>]*aria-label="Serviços públicos">(.*)<\/nav>/)?.[1] || "";
    for (const label of ["Solicitar procedimento", "Acompanhar solicitação", "Credenciamento", "Denunciar", "Entrar"]) {
      expect(nav).toContain(label);
    }
    expect(nav.match(/<button/g)).toHaveLength(5);
    expect(nav.match(/aria-current="true"/g)).toHaveLength(1);
    expect(nav).toMatch(/aria-current="true"[^>]*>.*?Acompanhar solicitação/);
  });

  it("keeps the services of a wide header at their own width", () => {
    const html = renderToStaticMarkup(<PublicServiceButtons services={services} activeServiceId={null} onSelect={noop} onEnter={noop} />);
    expect(html).not.toContain("tw:w-full");
    expect(html).not.toContain('aria-current="true"');
  });
});
