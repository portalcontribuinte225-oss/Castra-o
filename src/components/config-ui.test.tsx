import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfigField, ConfigRow, ConfigStatusFilter, ModalHeader } from "./ui";

describe("configuration controls", () => {
  it("uses the same field component for the default type and for e-mail", () => {
    const text = renderToStaticMarkup(<ConfigField label="Nome" value="" />);
    const email = renderToStaticMarkup(<ConfigField label="E-mail" type="email" value="" invalid disabled />);
    expect(text).toMatch(/type="text"[^>]*data-ui-input/);
    expect(email).toMatch(/type="email"[^>]*data-ui-input/);
    expect(email).toContain('aria-invalid="true"');
    expect(email).toContain('disabled=""');
  });

  it("uses a non-submitting native button for the catalog row", () => {
    const html = renderToStaticMarkup(<ConfigRow onClick={() => {}}><span>Pequeno</span></ConfigRow>);
    expect(html).toMatch(/^<button type="button"/);
    expect(html).toContain("Pequeno");
  });

  it("exposes one pressed status filter", () => {
    const html = renderToStaticMarkup(<ConfigStatusFilter value="inactive" onChange={() => {}} inactiveCount={3} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Inativos \(3\)<\/button>/);
  });

  it("uses the shared close button only for configuration headers", () => {
    const close = () => {};
    const config = renderToStaticMarkup(<ModalHeader title="Editar porte" appearance="config" onClose={close} />);
    const legacy = renderToStaticMarkup(<ModalHeader title="Visualizar documento" onClose={close} />);
    expect(config).toContain('data-ui-close-button=""');
    expect(legacy).toContain('class="modal-header-close"');
  });
});
