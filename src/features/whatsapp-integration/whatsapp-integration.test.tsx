import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationEvent } from "../../../shared/notification-contract.js";
import { buildDefaultWhatsappBindings } from "../../../shared/whatsapp-binding-contract.js";
import { normalizeAuthDeliveryConfig } from "../../../shared/auth-contract.js";
import { AuthDeliverySettings } from "../tutor-access/auth-delivery-settings";
import { useAuthDeliverySettings } from "../tutor-access/use-auth-delivery-settings";
import { WhatsappBindingEditor } from "./whatsapp-binding-editor";
import { WhatsappBindingsGrid } from "./whatsapp-bindings-grid";
import { WhatsappCatalogGrid } from "./whatsapp-catalog-grid";
import { WhatsappTemplatesPanel } from "./whatsapp-templates-panel";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { bindableTemplates, describeBinding, renderTemplatePreview } from "./whatsapp-template-display";
import type { CatalogTemplate, TemplateCatalog } from "./whatsapp-integration-types";

vi.mock("./use-whatsapp-templates", () => ({ useWhatsappTemplates: vi.fn() }));
vi.mock("../tutor-access/use-auth-delivery-settings", async (importOriginal) => ({ ...(await importOriginal<object>()), useAuthDeliverySettings: vi.fn() }));

const template = (overrides: Partial<CatalogTemplate> = {}): CatalogTemplate => ({
  name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY",
  bodyText: "Olá {{1}}, sua castração está marcada para {{2}} às {{3}} em {{4}}.", variableCount: 4, supported: true, unsupportedReason: "", ...overrides,
});
const catalogOf = (...templates: CatalogTemplate[]): TemplateCatalog => ({ syncedAt: "2026-11-15T12:00:00.000Z", templates });
const noop = vi.fn();
const baseState = { catalog: catalogOf(), bindings: buildDefaultWhatsappBindings(), loading: false, ready: true, syncing: false, saving: false, error: "", notice: "", retry: noop, sync: noop, saveBinding: vi.fn(), removeBinding: vi.fn() };

beforeEach(() => {
  vi.mocked(useWhatsappTemplates).mockReturnValue(baseState);
  vi.mocked(useAuthDeliverySettings).mockReturnValue({ loading: false, saving: false, error: "", success: false, ready: true, retry: noop, save: noop, setValue: noop,
    value: normalizeAuthDeliveryConfig({ whatsappTemplates: { verify_phone: "legacy_name" } }) });
});

describe("template display helpers", () => {
  it("fills the preview with sample data, fixed text and keeps unmapped positions visible", () => {
    const body = template().bodyText;
    const preview = renderTemplatePreview(body, [{ kind: "field", value: "tutor_name" }, { kind: "field", value: "schedule_date" }, { kind: "text", value: "manhã" }]);
    expect(preview).toBe("Olá Maria Silva, sua castração está marcada para 20/11/2026 às manhã em {{4}}.");
    expect(renderTemplatePreview("Sem variáveis", [])).toBe("Sem variáveis");
  });

  it("lists only approved templates with a supported format", () => {
    const catalog = catalogOf(template(), template({ name: "paused", status: "PAUSED" }), template({ name: "media", supported: false }), template({ name: "pending", status: "PENDING" }));
    expect(bindableTemplates(catalog).map(({ name }) => name)).toEqual(["castracao_confirmacao_agendamento"]);
  });

  it("describes what is wrong with a binding before an e-mail fallback surprises anyone", () => {
    const binding = buildDefaultWhatsappBindings()[NotificationEvent.SCHEDULE_CONFIRMED];
    expect(describeBinding(null, catalogOf()).label).toContain("e-mail");
    expect(describeBinding(binding, { syncedAt: "", templates: [] }).label).toContain("sincronize");
    expect(describeBinding(binding, catalogOf()).label).toContain("Não encontrado");
    expect(describeBinding(binding, catalogOf(template())).tone).toBe("ok");
    expect(describeBinding(binding, catalogOf(template({ status: "PAUSED" })))).toEqual({ label: "Pausado", tone: "off" });
    expect(describeBinding(binding, catalogOf(template({ status: "PENDING" })))).toEqual({ label: "Em análise", tone: "warn" });
    expect(describeBinding(binding, catalogOf(template({ variableCount: 3 }))).label).toContain("revise");
  });
});

describe("bindings grid", () => {
  const props = { catalog: catalogOf(template()), readOnly: false, busy: false, onEdit: noop, onRemove: vi.fn() };

  it("shows every notification event with its template, variables and situation", () => {
    const html = renderToStaticMarkup(<WhatsappBindingsGrid bindings={buildDefaultWhatsappBindings()} {...props} />);
    for (const label of ["Agendamento confirmado", "Agendamento alterado (reagendamento)", "Agendamento cancelado", "Documentos conferidos", "Atendimento concluído"]) expect(html).toContain(label);
    expect(html).toContain("castracao_confirmacao_agendamento");
    expect(html).toContain("{{1}} Nome do tutor");
    expect(html).toContain("Pronto para enviar");
    expect(html).toContain("Não encontrado no catálogo");
    expect(html).toContain("Sem vínculo: o aviso segue por e-mail");
    expect(html).toContain("Vincular");
    expect(html).not.toContain("Telefone");
  });

  it("disables editing for read-only users", () => {
    const html = renderToStaticMarkup(<WhatsappBindingsGrid bindings={buildDefaultWhatsappBindings()} {...props} readOnly />);
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(5);
  });
});

describe("binding editor", () => {
  const current = buildDefaultWhatsappBindings()[NotificationEvent.SCHEDULE_CONFIRMED];
  const editorProps = { eventLabel: "Agendamento confirmado", saving: false, onSave: vi.fn(), onCancel: noop };

  it("starts from the current template and shows the mapped preview", () => {
    const html = renderToStaticMarkup(<WhatsappBindingEditor {...editorProps} current={current} catalog={catalogOf(template())} />);
    expect(html).toContain("Vínculo: Agendamento confirmado");
    expect(html).toContain("Campo da variável 4");
    expect(html).toContain("Olá Maria Silva, sua castração está marcada para 20/11/2026 às 09:00 em Unidade Veterinária Municipal.");
    expect(html).not.toContain("disabled=\"\">Salvar vínculo");
  });

  it("asks to synchronize when there is no approved template to choose from", () => {
    const html = renderToStaticMarkup(<WhatsappBindingEditor {...editorProps} current={null} catalog={catalogOf(template({ status: "PAUSED" }))} />);
    expect(html).toContain("Sincronize os templates com a Meta");
    expect(html).toContain("disabled=\"\">Salvar vínculo");
  });
});

describe("catalog grid", () => {
  it("lists templates with status and unsupported formats, and offers synchronization", () => {
    const html = renderToStaticMarkup(<WhatsappCatalogGrid syncing={false} readOnly={false} onSync={noop}
      catalog={catalogOf(template(), template({ name: "with_media", supported: false, unsupportedReason: "Cabeçalho com variável ou mídia não é suportado.", status: "PAUSED" }))} />);
    expect(html).toContain("Sincronizar com a Meta");
    expect(html).toContain("Última sincronização");
    expect(html).toContain("Aprovado");
    expect(html).toContain("Pausado");
    expect(html).toContain("Cabeçalho com variável ou mídia não é suportado.");
  });

  it("explains the empty state and blocks synchronization for read-only users", () => {
    const html = renderToStaticMarkup(<WhatsappCatalogGrid syncing={false} readOnly onSync={noop} catalog={{ syncedAt: "", templates: [] }} />);
    expect(html).toContain("Ainda não sincronizado");
    expect(html).toContain("Informe o token e o ID da conta");
    expect(html).toContain("disabled=\"\">Sincronizar com a Meta");
  });
});

describe("templates panel", () => {
  it("renders bindings, catalog and access templates for a ready municipality", () => {
    vi.mocked(useWhatsappTemplates).mockReturnValue({ ...baseState, catalog: catalogOf(template(), template({ name: "paused_one", status: "PAUSED" })) });
    const html = renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="municipality-a" />);
    expect(html).toContain("Vínculos por aviso");
    expect(html).toContain("Catálogo de templates da Meta");
    expect(html).toContain("Mensagens de acesso e segurança por WhatsApp");
    expect(html).toContain("<option value=\"castracao_confirmacao_agendamento\">");
    expect(html).not.toContain("<option value=\"paused_one\">");
    expect(html).toContain("legacy_name (fora do catálogo)");
  });

  it("shows loading, errors with retry and the municipality prompt", () => {
    vi.mocked(useWhatsappTemplates).mockReturnValue({ ...baseState, ready: false, loading: true });
    expect(renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="municipality-a" />)).toContain("Carregando templates...");
    vi.mocked(useWhatsappTemplates).mockReturnValue({ ...baseState, ready: false, error: "Não foi possível carregar os templates do WhatsApp." });
    const failed = renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="municipality-a" />);
    expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("Vínculos por aviso");
    expect(renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="" />)).toContain("Selecione um município");
  });

  it("tells read-only users that only administrators can change templates", () => {
    expect(renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="municipality-a" readOnly />)).toContain("Apenas administradores");
  });
});

describe("access template field", () => {
  it("stays a text input until a catalog is available", () => {
    const html = renderToStaticMarkup(<AuthDeliverySettings municipalityId="municipality-a" channel="whatsappTemplates" />);
    expect(html).toContain("legacy_name");
    expect(html).not.toContain("<select");
  });
});
