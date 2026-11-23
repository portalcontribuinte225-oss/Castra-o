import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailImageStatus } from "../../../shared/email-contract.js";
import { emailUses } from "../../../shared/email-uses-contract.js";
import { ContractState } from "../../../shared/message-quota-contract.js";
import { useMessageContract, type MessageContract } from "../message-contract/use-message-contract";
import { EmailIntegrationTab } from "./email-integration-tab";
import type { EmailSettings, EmailUseRow } from "./email-integration-types";
import { useEmailSettings } from "./use-email-settings";

vi.mock("./use-email-settings", () => ({ useEmailSettings: vi.fn() }));
vi.mock("../message-contract/use-message-contract", () => ({ useMessageContract: vi.fn() }));

const noop = vi.fn();
const CONFIGURED_USES = 3;
// Two of the configured uses are active.
const rows = (master: boolean): EmailUseRow[] => emailUses.map((use, index) => ({
  key: use.key, kind: use.kind, label: use.label, configured: index < CONFIGURED_USES, active: index < 2 || index === emailUses.length - 1,
  ...(master ? { variables: [...use.variables], templateId: index < CONFIGURED_USES ? `tpl_${index}` : "" } : {}),
}));
const settingsOf = (overrides: Partial<EmailSettings> = {}, master = true): EmailSettings => ({
  integrated: true, municipal: true, uses: rows(master),
  identity: { name: "Test Town", departmentName: "Animal Department", brasao: EmailImageStatus.READY, departmentLogo: EmailImageStatus.READY }, ...overrides,
});
const emailState = (settings: EmailSettings | null, overrides = {}) => ({
  settings, drafts: {}, dirty: false, loading: false, saving: false, error: "", notice: "", ready: Boolean(settings), retry: noop,
  editId: noop, saveTemplates: noop, toggle: noop, ...overrides,
});

const contractState: MessageContract = {
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "", saveOk: false,
  ready: true, loadFailed: false, retry: noop, saving: false, contractOn: true, canTurnOn: true, setActive: noop,
  live: { plan: 500, used: 12, contractStart: null, contractEnd: "2026-12-31", state: ContractState.IN_FORCE },
};
const tab = (props: Partial<React.ComponentProps<typeof EmailIntegrationTab>> = {}) => renderToStaticMarkup(
  <EmailIntegrationTab municipalityId="municipality-a" master canManage {...props} />,
);
const on = (html: string) => (html.match(/aria-checked="true"/g) || []).length;

beforeEach(() => {
  vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf()));
  vi.mocked(useMessageContract).mockReturnValue(contractState);
});

describe("e-mail integration and contract", () => {
  it("says beside the title whether the account is integrated, and nothing of the account itself", () => {
    const html = tab();
    expect(html).toContain("Integrado");
    expect(html.indexOf("E-mail")).toBeLessThan(html.indexOf("Integrado"));
    for (const hidden of ["Credenciais", "Service ID", "Public Key", "Private Key", "Endereço público do sistema", "EMAILJS_", "Allow EmailJS API", "•"]) expect(html).not.toContain(hidden);
    vi.mocked(useEmailSettings).mockReturnValue(emailState(settingsOf({ integrated: false })));
    expect(tab()).toContain("Não integrado");
  });

  it("puts the contract, with its usage, right above the templates", () => {
    const html = tab();
    expect(html).toContain("12/500");
    expect(html).toContain("Vigente");
    expect(html.indexOf("Contrato e cota")).toBeLessThan(html.indexOf("Templates"));
    for (const gone of ["Estado da integração", "mensagens este mês", "Ativo no município", "Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(html).not.toContain(gone);
  });

  it("gives only the master the contract fields and its switch, the only one of the channel", () => {
    const editor = tab();
    expect(editor.match(/type="checkbox"/g)).toHaveLength(1);
    expect(editor.indexOf("Contrato e cota")).toBeLessThan(editor.indexOf('type="checkbox"'));
    expect(editor).toContain("Limite mensal");
    const viewer = tab({ master: false });
    expect(viewer).toContain("12/500");
    expect(viewer).not.toContain("Limite mensal");
    expect(viewer).not.toContain('type="checkbox"');
  });

  it("leaves the message switches to the templates, whatever the state of the contract", () => {
    vi.mocked(useMessageContract).mockReturnValue({ ...contractState, contractOn: false, live: { ...contractState.live!, state: ContractState.OFF } });
    const html = tab({ master: false });
    expect(html).toContain("Desativado");
    expect(html.match(/role="switch"[^>]*disabled=""/g)).toHaveLength(emailUses.length - CONFIGURED_USES);
    expect(on(html)).toBe(2);
  });

  it("reads the contract of the e-mail channel for the municipality, and for none while the viewer cannot manage", () => {
    tab();
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("email", "municipality-a");
    tab({ canManage: false });
    expect(vi.mocked(useMessageContract)).toHaveBeenLastCalledWith("email", "");
  });

  it("shows no contract without a municipality, and no badge while the screen is not loaded", () => {
    expect(tab({ municipalityId: "" })).not.toContain("Contrato e cota");
    vi.mocked(useEmailSettings).mockReturnValue(emailState(null));
    expect(tab()).not.toContain("Integrado");
  });
});

describe("e-mail tab for the master", () => {
  it("shows all messages in one table, with the ids and the variables", () => {
    const html = tab();
    for (const label of ["Salvar templates", "Variáveis"]) expect(html).toContain(label);
    expect(html.match(/<tr>/g)).toHaveLength(emailUses.length + 1);
    for (const use of emailUses) expect(html).toContain(use.label);
    expect(html).not.toContain("Confirmação de telefone");
    expect(html).not.toContain("Avisos da solicitação");
    expect(html).toContain("<th>ID do template</th>");
    expect(html).toContain('value="tpl_0"');
    expect(html).toContain("{{municipality_brasao_url}}");
    expect(html).toContain("{{department_logo_url}}");
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
    expect(html.match(/Sem template/g)).toHaveLength(emailUses.length - CONFIGURED_USES);
    expect(html).toContain("<th>Ativo</th>");
  });

  it("shows a switch per message, on only when it is both active and configured, and locks the unconfigured ones", () => {
    const html = tab({ master: false });
    expect(html.match(/<td><div class="integration-table-actions">/g)).toHaveLength(emailUses.length);
    expect(html.match(/role="switch"/g)).toHaveLength(emailUses.length);
    expect(on(html)).toBe(2);
    expect(html.match(/aria-label="Liga quando o master configurar o template\."/g)).toHaveLength(emailUses.length - CONFIGURED_USES);
    expect((html.match(/whatsapp-switch whatsapp-switch--on/g) || []).length).toBe(2);
  });

  it("says who the e-mails identify, and whether the brasão and the department logo will appear", () => {
    const ready = tab({ master: false });
    expect(ready).toContain("<strong>Test Town</strong> · Animal Department · Brasão: cadastrado · Logo do órgão: cadastrado");
    expect(ready).not.toContain("APP_PUBLIC_URL");
    const identity = (brasao: string, departmentLogo: string) => settingsOf({ identity: { name: "Test Town", departmentName: "", brasao, departmentLogo } }, false);
    vi.mocked(useEmailSettings).mockReturnValue(emailState(identity(EmailImageStatus.READY, EmailImageStatus.MISSING)));
    const noLogo = tab({ master: false });
    expect(noLogo).toContain("Brasão: cadastrado · Logo do órgão: não cadastrado ⚠");
    expect(noLogo).not.toContain("Animal Department");
    expect(noLogo).not.toContain("APP_PUBLIC_URL");
    vi.mocked(useEmailSettings).mockReturnValue(emailState(identity(EmailImageStatus.MISSING, EmailImageStatus.NO_PUBLIC_URL)));
    const noAddress = tab({ master: false });
    expect(noAddress).toContain("Brasão: não cadastrado ⚠ · Logo do órgão: cadastrado");
    expect(noAddress).toContain("As imagens ficam fora dos e-mails até o endereço público (APP_PUBLIC_URL) ser cadastrado nas variáveis do servidor ⚠");
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
