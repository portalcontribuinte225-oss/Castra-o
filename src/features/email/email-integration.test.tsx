import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailImageStatus } from "../../../shared/email-contract.js";
import { emailUses } from "../../../shared/email-uses-contract.js";
import { useMessageContract } from "../message-contract/use-message-contract";
import { EmailIntegrationTab } from "./email-integration-tab";
import type { EmailAccountView, EmailSettings, EmailUseRow } from "./email-integration-types";
import { useEmailAccount } from "./use-email-account";
import { useEmailSettings } from "./use-email-settings";

vi.mock("./use-email-settings", () => ({ useEmailSettings: vi.fn() }));
vi.mock("./use-email-account", () => ({ useEmailAccount: vi.fn() }));
vi.mock("../message-contract/use-message-contract", () => ({ useMessageContract: vi.fn() }));

const noop = vi.fn();
const account: EmailAccountView = { serviceId: "service_test", publicKey: "public-key-test", publicUrl: "https://system.example.test", hasPrivateKey: true, privateKeyPreview: "PRIVATE0" };
// Three uses are configured (ids set by the master) and two of those are on; the other eight have no template yet.
const rows = (master: boolean): EmailUseRow[] => emailUses.map((use, index) => ({
  key: use.key, kind: use.kind, label: use.label, configured: index < 3, active: index < 2 || index === emailUses.length - 1,
  ...(master ? { variables: [...use.variables], templateId: index < 3 ? `tpl_${index}` : "" } : {}),
}));
const settingsOf = (overrides: Partial<EmailSettings> = {}, master = true): EmailSettings => ({
  account: master ? account : null, configured: true, municipal: true, uses: rows(master),
  identity: { name: "Test Town", departmentName: "Animal Department", brasao: EmailImageStatus.READY, departmentLogo: EmailImageStatus.READY }, ...overrides,
});
const emailState = (settings: EmailSettings | null, overrides = {}) => ({
  settings, drafts: {}, dirty: false, loading: false, saving: false, error: "", notice: "", ready: Boolean(settings), retry: noop, apply: noop,
  editId: noop, saveTemplates: noop, toggle: noop, ...overrides,
});
const accountState = (overrides = {}) => ({
  form: { serviceId: "service_test", publicKey: "public-key-test", publicUrl: "https://system.example.test", privateKey: "" }, edit: noop, status: "", statusOk: false,
  saving: false, changed: false, fieldsChanged: false, confirmingRemoval: false, setConfirmingRemoval: noop, save: noop, removeKey: noop, ...overrides,
});

const contractState = {
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "",
  live: { plan: 500, used: 12, remaining: 488, contractStart: null, contractEnd: "2026-12-31", active: true, enabled: true },
  confirmingEnd: false, setConfirmingEnd: noop, save: noop, endContractToday: noop, resetUsed: noop, setEnabled: noop,
};
const tab = (props: Partial<React.ComponentProps<typeof EmailIntegrationTab>> = {}) => renderToStaticMarkup(
  <EmailIntegrationTab municipalityId="municipality-a" master canManage canEditContract {...props} />,
);
const on = (html: string) => (html.match(/aria-checked="true"/g) || []).length;

beforeEach(() => {
  vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf()));
  vi.mocked(useEmailAccount).mockReturnValue(accountState());
  vi.mocked(useMessageContract).mockReturnValue(contractState);
});

describe("e-mail contract", () => {
  it("counts the messages of the contract at the top, whether the account is configured or not", () => {
    const html = tab({ master: false, canEditContract: false });
    expect(html).toContain('aria-label="Estado da integração"'); expect(html).toContain("12/500"); expect(html).toContain("Contrato vigente"); expect(html).toContain("Ativo");
    expect(html.indexOf('aria-label="Estado da integração"')).toBeLessThan(html.indexOf("Templates"));
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf({ configured: false })));
    expect(tab()).toContain("Inativo");
  });

  it("offers the contract form only to who edits it, after the templates", () => {
    const viewer = tab({ master: false, canEditContract: false });
    for (const hidden of ["Contrato e cota", "Limite mensal", "Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(viewer).not.toContain(hidden);
    const editor = tab();
    for (const shown of ["Contrato e cota", "Limite mensal", "Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(editor).toContain(shown);
    expect(editor.indexOf("Templates")).toBeLessThan(editor.indexOf("Contrato e cota"));
  });

  it("offers the service switch to who edits the contract, and locks the messages with the reason while the service is off", () => {
    expect(tab()).toContain("Serviço ativo para este município");
    expect(tab({ master: false, canEditContract: false })).not.toContain("Serviço ativo para este município");
    vi.mocked(useMessageContract).mockReturnValue({ ...contractState, live: { ...contractState.live, enabled: false } });
    const off = tab({ master: false, canEditContract: false });
    expect(off).toContain("Inativo");
    expect(off.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(emailUses.length);
    expect(off.match(/aria-label="O serviço de e-mail está desativado para este município\."/g)).toHaveLength(emailUses.length);
    expect(off).not.toContain('aria-checked="true"');
    expect(tab()).toContain("Serviço desativado para este município");
  });

  it("reads the contract of the e-mail channel for the municipality, and for none while the viewer cannot manage", () => {
    tab();
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("email", "municipality-a");
    tab({ canManage: false });
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("email", "");
  });

  it("shows neither the counter nor the form while the screen is not loaded or no municipality is chosen", () => {
    vi.mocked(useEmailSettings).mockReturnValue(emailState(null));
    expect(tab()).not.toContain('aria-label="Estado da integração"');
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf()));
    const noMunicipality = tab({ municipalityId: "" });
    expect(noMunicipality).not.toContain('aria-label="Estado da integração"');
  });
});

describe("e-mail tab for the master", () => {
  it("shows the platform credentials and one table of eleven messages without group titles", () => {
    const html = tab();
    for (const label of ["ID do serviço (Service ID)", "Chave pública (Public Key)", "Endereço público do sistema", "Chave privada (Private Key)", "Salvar templates", "Variáveis"]) expect(html).toContain(label);
    expect(html).toContain("Allow EmailJS API for non-browser applications");
    expect(html.match(/<tr>/g)).toHaveLength(12);
    for (const use of emailUses) expect(html).toContain(use.label);
    expect(html).not.toContain("Confirmação de telefone");
    expect(html).not.toContain("Avisos da solicitação");
    expect(html).toContain("<th>ID do template</th>");
    expect(html).toContain('value="tpl_0"');
    expect(html).toContain("{{municipality_brasao_url}}");
    expect(html).toContain("{{department_logo_url}}");
  });

  it("shows a saved private key by its start only, with removal, and the save button only when something changed", () => {
    const saved = tab();
    expect(saved).toContain(`value="PRIVATE0${"•".repeat(24)}"`);
    expect(saved).toContain("Remover chave");
    expect(saved).not.toContain("Salvar credenciais");
    vi.mocked(useEmailAccount).mockReturnValue(accountState({ fieldsChanged: true, changed: true }));
    const edited = tab();
    expect(edited).toContain("Salvar credenciais");
    expect(edited).not.toContain("Remover chave");
    vi.mocked(useEmailAccount).mockReturnValue(accountState({ confirmingRemoval: true }));
    const confirming = tab();
    expect(confirming).toContain("Confirmar");
    expect(confirming).toContain("Remover a chave privada?");
  });

  it("asks for the private key when none is saved, and shows what happened after a save", () => {
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf({ account: { ...account, hasPrivateKey: false, privateKeyPreview: "" } })));
    vi.mocked(useEmailAccount).mockReturnValue(accountState({ status: "Credenciais salvas.", statusOk: true }));
    const html = tab();
    expect(html).toContain("Salvar credenciais");
    expect(html).not.toContain("Remover chave");
    expect(html).toContain('type="password"');
    expect(html).toContain("whatsapp-inline-status ok");
  });

  it("keeps the ids editable without a municipality, but hides the switches", () => {
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf({ municipal: false, identity: null })));
    const html = tab({ municipalityId: "" });
    expect(html).toContain("Salvar templates");
    expect(html).toContain("Selecione um município para ligar ou desligar as mensagens.");
    expect(html).not.toContain("<th>Ativo</th>");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Identificação nos e-mails");
  });

  it("enables the template save only with unsaved ids and while nothing is being saved", () => {
    const disabled = tab();
    expect(disabled).toMatch(/<button[^>]*disabled=""[^>]*>Salvar templates<\/button>/);
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf(), { dirty: true }));
    expect(tab()).not.toMatch(/<button[^>]*disabled=""[^>]*>Salvar templates<\/button>/);
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf(), { dirty: true, saving: true }));
    expect(tab()).toContain("Salvando...");
  });
});

describe("e-mail tab for a municipal viewer", () => {
  beforeEach(() => {
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf({}, false)));
  });

  it("shows neither credentials nor ids nor variables, only whether each message has a template", () => {
    const html = tab({ master: false });
    for (const hidden of ["Credenciais", "Service ID", "Private Key", "Salvar templates", "Variáveis", "tpl_0", "Cole o ID aqui"]) expect(html).not.toContain(hidden);
    expect(html).toContain("<th>Template</th>");
    expect(html.match(/Configurado/g)).toHaveLength(3);
    expect(html.match(/Sem template/g)).toHaveLength(8);
    expect(html).toContain("<th>Ativo</th>");
  });

  it("shows a switch per message, on only when it is both active and configured, and locks the unconfigured ones", () => {
    const html = tab({ master: false });
    expect(html.match(/role="switch"/g)).toHaveLength(11);
    expect(on(html)).toBe(2);
    expect(html.match(/aria-label="Liga quando o master configurar o template\."/g)).toHaveLength(8);
    expect((html.match(/whatsapp-switch whatsapp-switch--on/g) || []).length).toBe(2);
  });

  it("says who the e-mails identify, and whether the brasão and the department logo will appear", () => {
    const ready = tab({ master: false });
    expect(ready).toContain("<strong>Test Town</strong> · Animal Department · Brasão: cadastrado · Logo do órgão: cadastrado");
    expect(ready).not.toContain("endereço público do sistema");
    const identity = (brasao: string, departmentLogo: string) => settingsOf({ identity: { name: "Test Town", departmentName: "", brasao, departmentLogo } }, false);
    vi.mocked(useEmailSettings).mockReturnValue(emailState(identity(EmailImageStatus.READY, EmailImageStatus.MISSING)));
    const noLogo = tab({ master: false });
    expect(noLogo).toContain("Brasão: cadastrado · Logo do órgão: não cadastrado ⚠");
    expect(noLogo).not.toContain("Animal Department");
    expect(noLogo).not.toContain("endereço público do sistema");
    vi.mocked(useEmailSettings).mockReturnValue(emailState(identity(EmailImageStatus.MISSING, EmailImageStatus.NO_PUBLIC_URL)));
    const noAddress = tab({ master: false });
    expect(noAddress).toContain("Brasão: não cadastrado ⚠ · Logo do órgão: cadastrado");
    expect(noAddress).toContain("As imagens ficam fora dos e-mails até o master configurar o endereço público do sistema ⚠");
  });

  it("has no shared option to send one notice through more than one channel", () => {
    for (const master of [true, false]) expect(tab({ master })).not.toContain("mais de um canal");
  });
});

describe("e-mail tab states", () => {
  it("is restricted for who cannot manage, and asks a non-master for a municipality", () => {
    expect(tab({ canManage: false })).toContain("restrita à administração");
    expect(tab({ canManage: false })).not.toContain("Credenciais");
    expect(tab({ municipalityId: "", master: false })).toContain("Selecione um município para configurar o e-mail.");
  });

  it("shows loading and an error with a way to try again, without the table", () => {
    vi.mocked(useEmailSettings).mockReturnValue(emailState(null, { loading: true }));
    expect(tab()).toContain("Carregando a integração de e-mail...");
    vi.mocked(useEmailSettings).mockReturnValue(emailState(null, { error: "Não foi possível carregar a integração de e-mail." }));
    const failed = tab();
    expect(failed).toContain("Não foi possível carregar a integração de e-mail.");
    expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("<table");
    expect(failed).not.toContain("Credenciais");
  });

  it("shows the result of a save, and a failure of a switch without hiding the table", () => {
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf(), { notice: "Templates salvos. Valem para todos os municípios." }));
    expect(tab()).toContain("Valem para todos os municípios.");
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf({}, false), { error: "Só é possível ligar mensagens com a conta de envio e o template configurados." }));
    const failed = tab({ master: false });
    expect(failed).toContain("Só é possível ligar mensagens");
    expect(failed).toContain("<table");
    expect(failed).not.toContain("Carregar novamente");
  });
});
