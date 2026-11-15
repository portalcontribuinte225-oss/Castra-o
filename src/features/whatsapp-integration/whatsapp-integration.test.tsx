import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { whatsappFieldLabels } from "../../../shared/whatsapp-templates-contract.js";
import { useWhatsappCredentials } from "./use-whatsapp-credentials";
import { useWhatsappQuota } from "./use-whatsapp-quota";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { WhatsappIntegrationTab } from "./whatsapp-integration-tab";
import { WhatsappTemplatesPanel } from "./whatsapp-templates-panel";
import { WhatsappTemplatesTable } from "./whatsapp-templates-table";
import { WhatsappVariablesList } from "./whatsapp-variables-list";
import { TEMPLATE_SYNC_STALE_MS, lockReason, needsAutoSync, templateStatusLabel, templateStatusTone, variableOrderHint } from "./whatsapp-template-display";
import type { WhatsappTemplateList, WhatsappTemplateRow } from "./whatsapp-integration-types";

vi.mock("./use-whatsapp-templates", () => ({ useWhatsappTemplates: vi.fn() }));
vi.mock("./use-whatsapp-credentials", () => ({ useWhatsappCredentials: vi.fn() }));
vi.mock("./use-whatsapp-quota", () => ({ useWhatsappQuota: vi.fn() }));

const row = (overrides: Partial<WhatsappTemplateRow> = {}): WhatsappTemplateRow => ({
  name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY", label: "Agendamento confirmado",
  uses: ["schedule_confirmed"], variables: ["Nome do tutor", "Data do agendamento", "Horário do agendamento", "Local do atendimento"],
  reason: "", active: false, canActivate: true, ...overrides,
});
const listOf = (...templates: WhatsappTemplateRow[]): WhatsappTemplateList => ({ syncedAt: "2026-11-15T14:32:00.000Z", templates });
const noop = vi.fn();
const tableProps = { syncing: false, busy: false, readOnly: false, canSync: true, onSync: noop, onToggle: vi.fn() };
const templatesState = { list: listOf(), loading: false, ready: true, syncing: false, saving: false, error: "", notice: "", retry: noop, sync: noop, toggle: vi.fn() };
const credentialsState = {
  settings: { active: true, provider: "cloud_api", phoneNumberId: "123456", wabaId: "654321", hasAccessToken: true }, setSettings: noop, saveStatus: "",
  testPhone: "", setTestPhone: noop, testStatus: "", testing: false, hasCredentials: true, isActive: true, canSync: true, save: noop, sendTest: noop,
};
const quotaState = {
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "", live: { plan: 500, used: 12, active: true, contractEnd: "2026-12-31" },
  confirmingEnd: false, setConfirmingEnd: noop, save: noop, endContractToday: noop, resetUsed: noop,
};

beforeEach(() => {
  vi.mocked(useWhatsappTemplates).mockReturnValue(templatesState);
  vi.mocked(useWhatsappCredentials).mockReturnValue(credentialsState);
  vi.mocked(useWhatsappQuota).mockReturnValue(quotaState);
});

describe("template display helpers", () => {
  it("labels and colors the Meta statuses", () => {
    expect(templateStatusLabel("APPROVED")).toBe("Aprovado");
    expect(templateStatusLabel("PENDING")).toBe("Em análise");
    expect(templateStatusLabel("NOT_FOUND")).toBe("Não encontrado");
    expect(templateStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(templateStatusLabel("")).toBe("Desconhecido");
    expect([templateStatusTone("APPROVED"), templateStatusTone("PENDING"), templateStatusTone("IN_APPEAL"), templateStatusTone("PAUSED"), templateStatusTone("REJECTED")]).toEqual(["ok", "warn", "warn", "off", "off"]);
  });

  it("describes the variable order of a use and why a switch is locked", () => {
    expect(variableOrderHint(row())).toBe("{{1}} Nome do tutor · {{2}} Data do agendamento · {{3}} Horário do agendamento · {{4}} Local do atendimento");
    expect(variableOrderHint(row({ variables: [] }))).toBe("");
    expect(lockReason(row())).toBe("");
    expect(lockReason(row({ canActivate: false, status: "PENDING" }))).toBe("Liga quando a Meta aprovar o template.");
    expect(lockReason(row({ canActivate: false, label: "", reason: "O nome não indica um aviso do sistema." }))).toBe("O nome não indica um aviso do sistema.");
    expect(lockReason(row({ active: true, canActivate: false }))).toBe("");
  });

  it("synchronizes on open only when there is no recent synchronization", () => {
    const now = Date.parse("2026-11-15T15:00:00.000Z");
    expect(needsAutoSync("", now)).toBe(true);
    expect(needsAutoSync("not a date", now)).toBe(true);
    expect(needsAutoSync(new Date(now - TEMPLATE_SYNC_STALE_MS - 1).toISOString(), now)).toBe(true);
    expect(needsAutoSync(new Date(now - TEMPLATE_SYNC_STALE_MS + 1000).toISOString(), now)).toBe(false);
  });
});

describe("templates table", () => {
  it("lists each template with status, recognized use and a switch, and locks what cannot be turned on", () => {
    const html = renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(
      row({ active: true }),
      row({ name: "castracao_cancelamento", label: "Agendamento cancelado", status: "PENDING", canActivate: false, variables: ["Nome do tutor", "Data do agendamento", "Horário do agendamento"] }),
      row({ name: "lembrete_atendimento", label: "", uses: [], variables: [], reason: "O nome não indica um aviso do sistema.", canActivate: false }),
      row({ name: "castracao_reagendamento", label: "Agendamento alterado", status: "NOT_FOUND", active: true, canActivate: false }),
    )} />);
    expect(html).toContain("castracao_confirmacao_agendamento");
    expect(html).toContain("Aprovado");
    expect(html).toContain("Em análise");
    expect(html).toContain("Não encontrado");
    expect(html).toContain("Agendamento cancelado");
    expect(html).toContain("Fora do padrão: O nome não indica um aviso do sistema.");
    expect(html).toContain("Última sincronização");
    expect(html).toContain('title="{{1}} Nome do tutor · {{2}} Data do agendamento');
    const switches = html.match(/<button[^>]*role="switch"[^>]*>/g) || [];
    expect(switches).toHaveLength(4);
    expect(switches[0]).toContain('aria-checked="true"');
    expect(switches[0]).not.toContain("disabled");
    expect(switches[1]).toContain('aria-checked="false"');
    expect(switches[1]).toContain("disabled");
    expect(switches[2]).toContain("disabled");
    expect(switches[3]).toContain('aria-checked="true"');
    expect(switches[3]).not.toContain("disabled");
    expect(html).toContain("Liga quando a Meta aprovar o template.");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Detalhes");
  });

  it("explains the empty state and blocks synchronization without credentials or for read-only users", () => {
    const empty = renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={{ syncedAt: "", templates: [] }} canSync={false} />);
    expect(empty).toContain("Ainda não sincronizado");
    expect(empty).toContain("Nenhum template carregado");
    expect(empty).toContain('disabled="">Sincronizar');
    expect(renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(row())} readOnly />)).toContain('disabled="">Sincronizar');
    expect(renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(row())} syncing />)).toContain("Sincronizando...");
    expect(renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(row())} readOnly />)).toMatch(/role="switch"[^>]*disabled/);
  });
});

describe("variables list", () => {
  it("lists the system variables by name only, without examples and without anything selectable", () => {
    const html = renderToStaticMarkup(<WhatsappVariablesList />);
    for (const label of Object.values(whatsappFieldLabels)) expect(html).toContain(`<li>${label}</li>`);
    expect(Object.values(whatsappFieldLabels)).toHaveLength(11);
    expect(html).toContain("Ver lista");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<option");
    expect(html).not.toContain("<input");
    expect(html).not.toMatch(/Maria Silva|123\/2026|20\/11\/2026/);
    expect(html).not.toMatch(/CPF|Telefone|E-mail/);
  });
});

describe("templates panel", () => {
  const panel = (overrides = {}, props = {}) => renderToStaticMarkup(
    <WhatsappTemplatesPanel municipalityId="municipality-a" readOnly={false} canSync templates={{ ...templatesState, list: listOf(row()), ...overrides }} {...props} />,
  );

  it("renders the table for a ready municipality", () => {
    const html = panel();
    expect(html).toContain("Templates da Meta");
    expect(html).toContain("castracao_confirmacao_agendamento");
  });

  it("shows loading, errors with retry, notices and the municipality prompt", () => {
    expect(panel({ ready: false, loading: true })).toContain("Carregando templates...");
    const failed = panel({ ready: false, error: "Não foi possível carregar os templates do WhatsApp." });
    expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("<table");
    expect(panel({ notice: "4 template(s) sincronizado(s)." })).toContain("4 template(s) sincronizado(s).");
    expect(panel({ error: "A Meta recusou o token." })).not.toContain("Carregar novamente");
    expect(renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="" readOnly={false} canSync={false} templates={{ ...templatesState, ready: false }} />)).toContain("Selecione um município");
  });

  it("tells read-only users that only administrators can change templates", () => {
    expect(panel({}, { readOnly: true })).toContain("Apenas administradores");
  });
});

describe("integration tab", () => {
  it("orders the screen: status, credentials with the test, templates, then contract and quota last", () => {
    const html = renderToStaticMarkup(<WhatsappIntegrationTab municipalityId="municipality-a" readOnly={false} />);
    const order = ["whatsapp-statusbar", "Credenciais", "Teste de envio", "Variáveis", "Templates da Meta", "Contrato e cota"].map((text) => html.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf("Ver lista")).toBeGreaterThan(html.indexOf("Enviar teste"));
    expect(html.indexOf("Ver lista")).toBeLessThan(html.indexOf("Templates da Meta"));
  });

  it("keeps the credentials fields, drops the retired template and language fields, and shows the quota summary", () => {
    const html = renderToStaticMarkup(<WhatsappIntegrationTab municipalityId="municipality-a" readOnly={false} />);
    for (const label of ["ID da conta do WhatsApp Business (WABA)", "ID do número remetente", "Token de acesso", "Salvar credenciais", "Enviar teste", "Limite mensal", "Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(html).toContain(label);
    for (const retired of ["Template de confirmação", "Idioma", "Variáveis do template", "var-chip", "Vincular", "Mensagens de acesso e segurança por WhatsApp"]) expect(html).not.toContain(retired);
    expect(html).toContain("12/500");
    expect(html).toContain("Contrato vigente");
    expect(html).toContain("Token já salvo");
  });

  it("asks for a municipality before anything else and hides the status bar", () => {
    const html = renderToStaticMarkup(<WhatsappIntegrationTab municipalityId="" readOnly={false} />);
    expect(html).not.toContain("whatsapp-statusbar");
    expect(html).toContain("Selecione um município");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("passes the synchronization permission from the credentials to the templates hook", () => {
    renderToStaticMarkup(<WhatsappIntegrationTab municipalityId="municipality-a" readOnly={false} />);
    expect(vi.mocked(useWhatsappTemplates)).toHaveBeenLastCalledWith("municipality-a", true);
    vi.mocked(useWhatsappCredentials).mockReturnValue({ ...credentialsState, canSync: false });
    renderToStaticMarkup(<WhatsappIntegrationTab municipalityId="municipality-a" readOnly={false} />);
    expect(vi.mocked(useWhatsappTemplates)).toHaveBeenLastCalledWith("municipality-a", false);
  });
});
