import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntegrationStatusBadge } from "./integration-card";
import { ConfigField, ConfigRow, ConfigSelectField, ConfigStatusFilter, ModalHeader, PanelHeader } from "./ui";

describe("configuration controls", () => {
  it("uses the same field component for the default type and for e-mail", () => {
    const text = renderToStaticMarkup(<ConfigField label="Nome" value="" />);
    const email = renderToStaticMarkup(<ConfigField label="E-mail" type="email" value="" invalid disabled />);
    expect(text).toMatch(/type="text"[^>]*data-ui-input/);
    expect(email).toMatch(/type="email"[^>]*data-ui-input/);
    expect(email).toContain('aria-invalid="true"');
    expect(email).toContain('disabled=""');
  });

  it("offers known options in a select with the label and box of the other fields", () => {
    const options = [{ value: "", label: "Nenhuma" }, { value: "KEY_A", label: "KEY_A" }];
    const html = renderToStaticMarkup(<ConfigSelectField label="Key do token" value="KEY_A" options={options} onChange={() => {}} />);
    expect(html).toMatch(/^<label class="[^"]*"><span>Key do token<\/span><select class="[^"]*tw:h-11/);
    expect(html).toContain('<option value="">Nenhuma</option>');
    expect(html).toContain('<option value="KEY_A" selected="">KEY_A</option>');
    expect(renderToStaticMarkup(<ConfigSelectField label="Key" value="" options={options} onChange={() => {}} disabled />)).toContain('disabled=""');
  });

  it("puts a status beside the panel title and keeps the plain header as it was", () => {
    const withStatus = renderToStaticMarkup(<PanelHeader title="SMS" aside={<IntegrationStatusBadge integrated />} />);
    expect(withStatus).toMatch(/<div class="panel-header"><div class="[^"]*"><h2>SMS<\/h2><span role="status"[^>]*>.*Integrado<\/span><\/div><\/div>/);
    expect(renderToStaticMarkup(<PanelHeader title="Agenda" />)).toBe('<div class="panel-header"><h2>Agenda</h2></div>');
  });

  it("says whether an integration is in the server, and nothing else", () => {
    expect(renderToStaticMarkup(<IntegrationStatusBadge integrated />)).toContain("tw:text-ui-accent");
    const off = renderToStaticMarkup(<IntegrationStatusBadge integrated={false} />);
    expect(off).toContain("tw:text-ui-danger");
    expect(off).toContain("Não integrado");
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
