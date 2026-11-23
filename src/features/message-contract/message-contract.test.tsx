import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ContractState } from "../../../shared/message-quota-contract.js";
import { MessageContractCard } from "./message-contract-card";
import type { MessageQuotaStatus } from "./message-contract-types";
import { contractInput, type MessageContract } from "./use-message-contract";

const noop = vi.fn();
const live: MessageQuotaStatus = { plan: 500, used: 12, contractStart: null, contractEnd: "2026-12-31", state: ContractState.IN_FORCE };
const contractOf = (extra: Partial<MessageContract> = {}): MessageContract => ({
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "", saveOk: false, live,
  ready: true, loadFailed: false, retry: noop, saving: false, contractOn: true, canTurnOn: true, setActive: noop, ...extra,
});
const card = (extra: Partial<MessageContract> = {}, master = true) => renderToStaticMarkup(<MessageContractCard contract={contractOf(extra)} master={master} />);
const fieldTags = (html: string) => html.match(/<input[^>]*data-ui-input=""[^>]*>/g) || [];
const switchTag = (html: string) => html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] || "";

describe("contract card", () => {
  it("tells where the contract stands and the month's usage at the top", () => {
    const html = card();
    expect(html).toContain("Contrato e cota");
    expect(html).toContain("Vigente");
    expect(html).toContain("12/500");
    expect(html).not.toContain("mensagens este mês");
  });

  it.each([
    [ContractState.OFF, "Desativado"],
    [ContractState.OUT_OF_PERIOD, "Fora do período"],
  ])("marks a contract that lets no message go (%s)", (state, label) => {
    const html = card({ live: { ...live, state } });
    expect(html).toContain(`tw:text-ui-danger">${label}</span>`);
  });

  it("says when there is no contract, without a count", () => {
    const html = card({ live: null, contractOn: false });
    expect(html).toContain("Sem contrato");
    expect(html).not.toContain("/500");
  });

  it("gives the master the three fields and the switch, and no other action", () => {
    const html = card();
    expect(fieldTags(html)).toHaveLength(3);
    expect(switchTag(html)).toContain('checked=""');
    expect(html).not.toMatch(/data-ui-button=""/);
    for (const gone of ["Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(html).not.toContain(gone);
  });

  it("locks the fields while the contract is on and frees them when it is off", () => {
    const locked = (html: string) => fieldTags(html).filter((tag) => tag.includes('disabled=""')).length;
    expect(locked(card())).toBe(3);
    expect(locked(card({ contractOn: false, live: { ...live, state: ContractState.OFF } }))).toBe(0);
  });

  it("keeps the switch locked without a valid limit to turn on, and during a save", () => {
    expect(switchTag(card({ contractOn: false, canTurnOn: false, live: null }))).toContain('disabled=""');
    expect(switchTag(card({ contractOn: false, canTurnOn: true, live: null }))).not.toContain('disabled=""');
    expect(switchTag(card({ saving: true }))).toContain('disabled=""');
  });

  it("shows the staff only where the contract stands and the usage", () => {
    const html = card({}, false);
    expect(html).toContain("Vigente");
    expect(html).toContain("12/500");
    expect(fieldTags(html)).toHaveLength(0);
    expect(html).not.toContain('type="checkbox"');
  });

  it("waits for the contract to load and offers a retry on failure", () => {
    expect(card({ ready: false, live: undefined })).toContain("Carregando contrato e cota...");
    const failed = card({ ready: false, loadFailed: true, live: undefined });
    expect(failed).toContain("Carregar novamente");
    expect(failed).not.toContain("Limite mensal");
  });

  it("tells a saved switch apart from a failure", () => {
    expect(card({ saveStatus: "Contrato ativado.", saveOk: true })).toContain('class="whatsapp-inline-status ok"');
    const failure = card({ saveStatus: "Não foi possível salvar: Informe um limite mensal válido." });
    expect(failure).toContain('class="whatsapp-inline-status"');
    expect(failure).not.toContain("inline-status ok");
  });
});

describe("what the contract switch saves", () => {
  const settings = { plan: "300", contractStart: "2026-01-01", contractEnd: "" };

  it("turns on with the form as typed", () => {
    expect(contractInput(true, settings, null)).toEqual({ plan: 300, contractStart: "2026-01-01", contractEnd: "", enabled: true });
    expect(contractInput(true, { ...settings, plan: "abc" }, null)?.plan).toBe(0);
    expect(contractInput(true, { ...settings, plan: "1.5" }, null)?.plan).toBe(0);
  });

  it("turns off keeping the stored limit and dates, whatever the form holds", () => {
    expect(contractInput(false, { ...settings, plan: "9" }, live)).toEqual({ plan: 500, contractStart: "", contractEnd: "2026-12-31", enabled: false });
    expect(contractInput(false, settings, null)).toBeNull();
  });
});
