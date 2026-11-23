import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationEvent } from "../../../shared/notification-contract.js";
import { WhatsappTemplateField } from "../../../shared/whatsapp-templates-contract.js";
import { useMessageContract } from "../message-contract/use-message-contract";
import { useWhatsappCredentials } from "./use-whatsapp-credentials";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { WhatsappCredentials } from "./whatsapp-credentials";
import { WhatsappIntegrationTab } from "./whatsapp-integration-tab";
import { WhatsappTemplatesPanel } from "./whatsapp-templates-panel";
import { WhatsappTemplatesTable } from "./whatsapp-templates-table";
import { WhatsappTemplateLinkModal } from "./whatsapp-template-link-modal";
import {
  TEMPLATE_SYNC_STALE_MS, fieldsForVariables, firstMissingVariable, lockReason, needsAutoSync, templateBodySegments, templatePreview, templateStatusLabel,
  templateStatusTone, variableOrderHint,
} from "./whatsapp-template-display";
import type { WhatsappTemplateList, WhatsappTemplateRow } from "./whatsapp-integration-types";

vi.mock("./use-whatsapp-templates", () => ({ useWhatsappTemplates: vi.fn() }));
vi.mock("./use-whatsapp-credentials", () => ({ useWhatsappCredentials: vi.fn() }));
vi.mock("../message-contract/use-message-contract", () => ({ useMessageContract: vi.fn() }));

const row = (overrides: Partial<WhatsappTemplateRow> = {}): WhatsappTemplateRow => ({
  name: "castracao_confirmacao_agendamento", language: "pt_BR", status: "APPROVED", category: "UTILITY", label: "Agendamento confirmado",
  uses: ["schedule_confirmed"], variables: ["Nome do tutor", "Data do agendamento", "Horário do agendamento", "Local do atendimento"],
  reason: "", active: false, canActivate: true, configured: false, linkedUse: "", fields: ["tutor_name", "schedule_date", "schedule_time", "schedule_location_name"],
  bodyText: "Olá {{1}}, seu atendimento é em {{2}} às {{3}}, no {{4}}.", bodyVariables: 4, configurable: true, structureReason: "", ...overrides,
});
const samples = { tutor_name: "Maria Silva", schedule_date: "20/11/2026", schedule_time: "09:00", schedule_location_name: "Unidade Veterinária Municipal", protocol: "123/2026" };
const listOf = (...templates: WhatsappTemplateRow[]): WhatsappTemplateList => ({ syncedAt: "2026-11-15T14:32:00.000Z", templates, fieldSamples: samples });
const noop = vi.fn();
const tableProps = { syncing: false, busy: false, readOnly: false, canSync: true, master: false, onSync: noop, onToggle: vi.fn(), onConfigure: vi.fn() };
const templatesState = { list: listOf(), loading: false, ready: true, syncing: false, saving: false, error: "", notice: "", retry: noop, sync: noop, toggle: vi.fn(), saveLink: vi.fn() };
const credentialsState = {
  settings: {
    active: true, provider: "cloud_api", phoneNumberId: "123456", wabaId: "654321", hasAccessToken: true, tokenVariable: "WHATSAPP_TOKEN_TEST",
    tokenVariables: ["WHATSAPP_TOKEN_OTHER", "WHATSAPP_TOKEN_TEST"], tokenPreview: "EAAFAKE0", tokenIssue: null,
  },
  setSettings: noop, saveStatus: "", ready: true, loadFailed: false, retry: noop, saving: false,
  testPhone: "", setTestPhone: noop, testStatus: "", testing: false, hasCredentials: true, isActive: true, canSync: true, changed: false,
  savedTokenVariable: "WHATSAPP_TOKEN_TEST", save: noop, toggleActive: noop, sendTest: noop,
};
const contractState = {
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "",
  ready: true, loadFailed: false, retry: noop, saving: false, serviceStatus: "",
  live: { plan: 500, used: 12, remaining: 488, contractStart: null, contractEnd: "2026-12-31", active: true, enabled: true },
  confirmingEnd: false, setConfirmingEnd: noop, save: noop, endContractToday: noop, resetUsed: noop, setEnabled: noop,
};
const tab = (props: Partial<React.ComponentProps<typeof WhatsappIntegrationTab>> = {}) => renderToStaticMarkup(
  <WhatsappIntegrationTab municipalityId="municipality-a" master readOnly={false} canEditContract {...props} />,
);

beforeEach(() => {
  vi.mocked(useWhatsappTemplates).mockReturnValue(templatesState);
  vi.mocked(useWhatsappCredentials).mockReturnValue(credentialsState);
  vi.mocked(useMessageContract).mockReturnValue(contractState);
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
    expect(lockReason(row({ canActivate: false, label: "", reason: "O nome não indica um aviso do sistema." }))).toBe("Não usado pelo sistema");
    expect(lockReason(row({ canActivate: false, label: "", reason: "O corpo tem 2 variável(is); o esperado é 5." }))).toBe("O corpo tem 2 variável(is); o esperado é 5.");
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
    expect(html).toContain('<span class="whatsapp-muted">Não usado pelo sistema</span>');
    expect(html).toContain('Agendamento confirmado<small class="whatsapp-muted"> (pelo nome)</small>');
    expect(html).not.toMatch(/<button[^>]*aria-label="Configurar /);
    expect(html).not.toContain("Fora do padrão");
    expect(html).toContain("Última sincronização");
    expect(html).toContain('title="{{1}} Nome do tutor · {{2}} Data do agendamento');
    expect(html.match(/<td><div class="integration-table-actions">/g)).toHaveLength(4);
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

  it("keeps real template problems in red while a template that is simply not a system notice is neutral", () => {
    const html = renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(
      row({ name: "castracao_confirmacao_agendamento", label: "", uses: [], reason: "O corpo tem 2 variável(is); o esperado é 5.", canActivate: false }),
    )} />);
    expect(html).toContain('<span class="whatsapp-outside">Fora do padrão: O corpo tem 2 variável(is); o esperado é 5.</span>');
    expect(html).not.toContain("whatsapp-muted");
  });

  it("explains the empty state and blocks synchronization without credentials or for read-only users", () => {
    const disabledSyncButton = /<button\b[^>]*\bdisabled=""[^>]*>Sincronizar<\/button>/;
    const empty = renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={{ syncedAt: "", templates: [], fieldSamples: {} }} canSync={false} />);
    expect(empty).toContain("Ainda não sincronizado");
    expect(empty).toContain("Nenhum template carregado");
    expect(empty).toMatch(disabledSyncButton);
    expect(renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(row())} readOnly />)).toMatch(disabledSyncButton);
    expect(renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(row())} syncing />)).toContain("Sincronizando...");
    expect(renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} list={listOf(row())} readOnly />)).toMatch(/role="switch"[^>]*disabled/);
  });
});

describe("template configuration", () => {
  const modal = (overrides: Partial<WhatsappTemplateRow> = {}) => renderToStaticMarkup(
    <WhatsappTemplateLinkModal row={row(overrides)} samples={samples} onSave={async () => ""} onClose={noop} />,
  );

  it("splits the text into plain parts and numbers, and previews it with the example of each chosen field", () => {
    expect(templateBodySegments("Olá {{1}}, até {{ 2 }}.")).toEqual([
      { kind: "text", text: "Olá " }, { kind: "variable", number: 1 }, { kind: "text", text: ", até " }, { kind: "variable", number: 2 }, { kind: "text", text: "." },
    ]);
    expect(templatePreview("Olá {{1}}, protocolo {{2}} em {{3}}.", ["tutor_name", "protocol", ""], samples)).toBe("Olá Maria Silva, protocolo 123/2026 em {{3}}.");
    expect(fieldsForVariables(["tutor_name"], 3)).toEqual(["tutor_name", "", ""]);
    expect(fieldsForVariables(["tutor_name", "protocol", "city"], 2)).toEqual(["tutor_name", "protocol"]);
    expect([firstMissingVariable(["tutor_name", "", ""]), firstMissingVariable(["tutor_name"]), firstMissingVariable([])]).toEqual([2, 0, 0]);
  });

  it("offers the gear only to the master and only on templates that can carry a notice", () => {
    const html = renderToStaticMarkup(<WhatsappTemplatesTable {...tableProps} master list={listOf(
      row({ configured: true }), row({ name: "castracao_codigo_verificacao", label: "Códigos de acesso", configurable: false }),
    )} />);
    expect(html.match(/<button[^>]*aria-label="Configurar /g)).toHaveLength(1);
    expect(html).toContain('aria-label="Configurar castracao_confirmacao_agendamento"');
    expect(html).not.toContain('aria-label="Configurar castracao_codigo_verificacao"');
    expect(html).toContain("Agendamento confirmado</td>");
  });

  it("shows the Meta text with each number highlighted, the notice, one select per number and the preview", () => {
    const html = modal();
    expect(html).toContain("Configurar template");
    expect(html).toMatch(/<button[^>]*aria-label="Fechar"[^>]*data-ui-close-button/);
    expect(html).toContain("castracao_confirmacao_agendamento · pt_BR · Aprovado");
    expect(html).toContain('Olá <span class="whatsapp-link-var whatsapp-link-var--0">{{1}}</span>, seu atendimento é em <span class="whatsapp-link-var whatsapp-link-var--1">{{2}}</span>');
    expect(html).toContain('<option value="schedule_confirmed" selected="">Agendamento confirmado</option>');
    expect(html.match(/aria-label="O que vai em \{\{\d\}\}"/g)).toHaveLength(4);
    expect(html).toContain('<option value="schedule_location_name" selected="">Local do atendimento</option>');
    expect(html).toContain("Olá Maria Silva, seu atendimento é em 20/11/2026 às 09:00, no Unidade Veterinária Municipal.");
    expect(html).not.toContain("Escolha o que vai em");
    expect(html).not.toContain("Voltar ao padrão do nome");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Salvar<\/button>/);
  });

  it("asks for the missing numbers, offers going back to the name for a configured template and explains what cannot be configured", () => {
    const incomplete = modal({ configured: true, linkedUse: "no_show", fields: [WhatsappTemplateField.TUTOR_NAME] });
    expect(incomplete).toContain('<option value="no_show" selected="">Não comparecimento</option>');
    expect(incomplete).toContain("Escolha o que vai em {{2}}");
    expect(incomplete).toMatch(/<button[^>]*disabled=""[^>]*>Salvar<\/button>/);
    expect(incomplete).toContain("Voltar ao padrão do nome");
    const unknown = modal({ label: "", uses: [], fields: [] });
    expect(unknown).toContain('<option value="" selected="">Escolha o aviso</option>');
    expect(unknown).not.toContain("O que vai em cada número");
    expect(unknown).not.toContain("Prévia");
    const blocked = modal({ structureReason: "Cabeçalho com variável ou mídia não é suportado." });
    expect(blocked).toContain("Cabeçalho com variável ou mídia não é suportado.");
    expect(blocked).not.toContain("Qual aviso este template envia?");
    expect(modal({ bodyText: "" })).toContain("Sincronize os templates para ver o texto.");
  });

  it("offers each document outcome as its own notice and keeps a link and its field mapping editable", () => {
    const linked = modal({
      name: "castracao_documentos_analisados", configured: true, linkedUse: NotificationEvent.DOCUMENTS_REJECTED,
      bodyText: "Olá {{1}}, confira os documentos do protocolo {{2}}.", bodyVariables: 2, fields: ["tutor_name", "protocol"],
    });
    expect(linked).toContain('<option value="documents_approved">Documentos deferidos</option>');
    expect(linked).toContain('<option value="documents_rejected" selected="">Documentos indeferidos</option>');
    expect(linked).toContain("Olá Maria Silva, confira os documentos do protocolo 123/2026.");
    const distinct = modal({ uses: [NotificationEvent.DOCUMENTS_APPROVED], bodyVariables: 2, fields: ["protocol", "notification_message"] });
    expect(distinct).toContain('<option value="documents_approved" selected="">Documentos deferidos</option>');
    expect(distinct).not.toContain("Documentos deferidos e indeferidos");
  });
});

describe("templates panel", () => {
  const panel = (overrides = {}, props = {}) => renderToStaticMarkup(
    <WhatsappTemplatesPanel municipalityId="municipality-a" master={false} readOnly={false} canSync templates={{ ...templatesState, list: listOf(row()), ...overrides }} {...props} />,
  );

  it("renders the table for a ready municipality, without the old list of system variables", () => {
    const html = panel();
    expect(html).toContain("Templates da Meta");
    expect(html).toContain("castracao_confirmacao_agendamento");
    expect(html).not.toContain("Variáveis existentes no sistema");
    expect(html).not.toContain("Configurar template");
  });

  it("has no note about sending a notice through more than one channel", () => {
    expect(panel()).not.toContain("mais de um canal");
  });

  it("shows loading, errors with retry, notices and the municipality prompt", () => {
    expect(panel({ ready: false, loading: true })).toContain("Carregando templates...");
    const failed = panel({ ready: false, error: "Não foi possível carregar os templates do WhatsApp." });
    expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("<table");
    expect(panel({ notice: "4 template(s) sincronizado(s)." })).toContain("4 template(s) sincronizado(s).");
    expect(panel({ error: "A Meta recusou o token." })).not.toContain("Carregar novamente");
    expect(renderToStaticMarkup(<WhatsappTemplatesPanel municipalityId="" master={false} readOnly={false} canSync={false} templates={{ ...templatesState, ready: false }} />)).toContain("Selecione um município");
  });

  it("tells read-only users that only administrators can change templates", () => {
    expect(panel({}, { readOnly: true })).toContain("Você não tem permissão para ligar ou desligar templates.");
  });
});

describe("token variable", () => {
  const credentials = (settings = {}, extra = {}) => renderToStaticMarkup(
    <WhatsappCredentials municipalityId="municipality-a" credentials={{ ...credentialsState, settings: { ...credentialsState.settings, ...settings }, ...extra }} />,
  );

  it("shows a retry and keeps credential controls hidden when configuration could not be loaded", () => {
    const pending = credentials({}, { ready: false });
    const failed = credentials({}, { ready: false, loadFailed: true });
    expect(pending).toContain("Carregando configuração do WhatsApp...");
    expect(failed).toContain("Não foi possível carregar as credenciais do WhatsApp.");
    expect(failed).toContain("Carregar novamente");
    for (const html of [pending, failed]) {
      expect(html).not.toContain("Salvar credenciais");
      expect(html).not.toContain("Remover token");
      expect(html).not.toContain("ID da conta do WhatsApp Business");
    }
  });

  it("shows the token of the chosen variable by its start only, read-only, with nothing to type or remove", () => {
    const html = credentials();
    expect(html).toContain(`value="EAAFAKE0${"•".repeat(24)}"`);
    expect(html).toMatch(/<input(?=[^>]*type="text")(?=[^>]*readonly="")(?=[^>]*data-ui-input="")[^>]*value="EAAFAKE0/);
    expect(html).toContain("Vem da variável <code>WHATSAPP_TOKEN_TEST</code> do servidor.");
    for (const hidden of ["Remover token", 'type="password"', "Cole o token", "Começa com"]) expect(html).not.toContain(hidden);
  });

  it("offers one chip per variable of the server and one for none, with the chosen one selected", () => {
    const html = credentials();
    expect(html).toContain("Variável do token");
    for (const name of ["Nenhuma", "WHATSAPP_TOKEN_OTHER", "WHATSAPP_TOKEN_TEST"]) expect(html).toContain(`<span>${name}</span>`);
    expect(html).toContain('class="selected" title="WHATSAPP_TOKEN_TEST"');
    const none = credentials({ tokenVariable: "", hasAccessToken: false, tokenPreview: "", tokenIssue: "unset" }, { savedTokenVariable: "" });
    expect(none).toContain('class="selected" title="Nenhuma"');
    expect(none).not.toContain("Token de acesso");
  });

  it("tells which variable is missing on the server, and when there is none to choose", () => {
    const missing = credentials({ tokenPreview: "", tokenIssue: "missing", hasAccessToken: false });
    expect(missing).toContain("Falta WHATSAPP_TOKEN_TEST nas variáveis do servidor.");
    expect(missing).not.toContain("•");
    expect(credentials({ tokenVariables: [] })).toContain("Nenhuma variável <code>WHATSAPP_TOKEN_…</code> no servidor. Crie uma no Render para escolher aqui.");
    expect(credentials()).not.toContain("Crie uma no Render");
  });

  it("saves the ids and the variable only when something changed, with the standard button", () => {
    expect(credentials()).toMatch(/<button[^>]*disabled=""[^>]*data-ui-button[^>]*>Salvar credenciais<\/button>/);
    expect(credentials({}, { changed: true })).toMatch(/<button[^>]*data-ui-button[^>]*>Salvar credenciais<\/button>/);
    expect(credentials({}, { changed: true })).not.toMatch(/<button[^>]*disabled=""[^>]*>Salvar credenciais/);
  });

  it("uses standard fields for credentials and the test number", () => {
    const html = credentials();
    expect(html.match(/data-ui-input=""/g)).toHaveLength(4);
    expect(html).toMatch(/<button[^>]*data-ui-button[^>]*>Enviar teste<\/button>/);
    expect(html).not.toContain("Variáveis");
  });

  it("stops the browser from filling the ids with saved logins", () => {
    expect(credentials().match(/autoComplete="off"/g)).toHaveLength(2);
  });
});

describe("integration tab", () => {
  it("orders the screen: status, credentials with the test, templates, then contract and quota last", () => {
    const html = tab();
    const order = ['aria-label="Estado da integração"', "Credenciais", "Teste de envio", "Templates da Meta", "Contrato e cota"].map((text) => html.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the editable credentials and quota summary without the fixed provider field", () => {
    const html = tab();
    for (const label of ["ID da conta do WhatsApp Business (WABA)", "ID do número remetente", "Variável do token", "Token de acesso", "Enviar teste", "Limite mensal", "Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(html).toContain(label);
    for (const retired of ["WhatsApp Cloud API", "Template de confirmação", "Idioma", "Variáveis do template", "var-chip", "Vincular", "Mensagens de acesso e segurança por WhatsApp"]) expect(html).not.toContain(retired);
    expect(html).toContain("12/500");
    expect(html).toContain("Contrato vigente");
    expect(html).toContain("EAAFAKE0");
  });

  it("counts the messages at the top for who only reads the contract, and offers the form only to who edits it", () => {
    const viewer = tab({ canEditContract: false });
    expect(viewer).toContain('aria-label="Estado da integração"'); expect(viewer).toContain("12/500"); expect(viewer).toContain("Contrato vigente");
    for (const hidden of ["Contrato e cota", "Limite mensal", "Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(viewer).not.toContain(hidden);
    expect(viewer).toContain("EAAFAKE0");
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("whatsapp", "municipality-a");
  });

  it("keeps the connection for the master: whoever only has the permission sees the status and the templates, not the credentials, the test or the contract form", () => {
    const html = tab({ master: false, canEditContract: false });
    for (const hidden of ["Credenciais", "Token de acesso", "ID do número remetente", "Teste de envio", "Enviar teste", "Remover token", "Contrato e cota"]) expect(html).not.toContain(hidden);
    expect(html).toContain("é configurada pela administração da plataforma");
    expect(html).toContain('aria-label="Estado da integração"'); expect(html).toContain("12/500"); expect(html).toContain("Templates da Meta");
    expect(html.indexOf('aria-label="Estado da integração"')).toBeLessThan(html.indexOf("Templates da Meta"));
    expect(tab()).not.toContain("é configurada pela administração da plataforma");
    expect(tab().match(/type="checkbox"/g)).toHaveLength(1);
  });

  it("asks for a municipality before anything else and hides the status bar", () => {
    const html = tab({ municipalityId: "" });
    expect(html).not.toContain('aria-label="Estado da integração"');
    expect(html).toContain("Selecione um município");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("passes the synchronization permission from the credentials to the templates hook", () => {
    tab();
    expect(vi.mocked(useWhatsappTemplates)).toHaveBeenLastCalledWith("municipality-a", true);
    vi.mocked(useWhatsappCredentials).mockReturnValue({ ...credentialsState, canSync: false });
    tab();
    expect(vi.mocked(useWhatsappTemplates)).toHaveBeenLastCalledWith("municipality-a", false);
    vi.mocked(useWhatsappCredentials).mockReturnValue(credentialsState);
    tab({ master: false });
    expect(vi.mocked(useWhatsappTemplates)).toHaveBeenLastCalledWith("municipality-a", false);
  });
});
