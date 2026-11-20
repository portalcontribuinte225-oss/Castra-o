import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageContractForm } from "./message-contract-form";
import { MessageContractStatus } from "./message-contract-status";
import type { MessageQuotaStatus } from "./message-contract-types";
import type { MessageContract } from "./use-message-contract";

const noop = vi.fn();
const live: MessageQuotaStatus = { plan: 500, used: 12, remaining: 488, contractStart: null, contractEnd: "2026-12-31", active: true, enabled: true };
const contractState = (extra: Partial<MessageContract> = {}): MessageContract => ({
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "", live,
  ready: true, loadFailed: false, retry: noop, saving: false,
  confirmingEnd: false, setConfirmingEnd: noop, save: noop, endContractToday: noop, resetUsed: noop, setEnabled: noop, ...extra,
});

describe("contract status", () => {
  const status = (active: boolean, contract: MessageQuotaStatus | null) => renderToStaticMarkup(<MessageContractStatus active={active} live={contract} />);

  it("tells whether the channel is on, how many messages the month has used and until when the contract goes", () => {
    const html = status(true, live);
    expect(html).toContain("whatsapp-dot--on"); expect(html).toContain("Ativo"); expect(html).not.toContain("Inativo");
    expect(html).toContain("<strong>12/500</strong> mensagens este mês");
    expect(html).toContain("Contrato vigente até 31/12/2026");
    expect(html).not.toContain("whatsapp-status-err\">Contrato");
  });

  it("marks an inactive channel and an ended contract", () => {
    const html = status(false, { ...live, active: false });
    expect(html).toContain("whatsapp-dot--off"); expect(html).toContain("Inativo");
    expect(html).toContain("Contrato encerrado até 31/12/2026"); expect(html).toContain('whatsapp-statusbar-text whatsapp-status-err');
  });

  it("says the quota is not configured when the municipality has no contract, and drops the end date when there is none", () => {
    expect(status(true, null)).toContain("Cota não configurada");
    expect(status(true, null)).not.toContain("mensagens este mês");
    const open = status(true, { ...live, contractEnd: null });
    expect(open).toContain("Contrato vigente"); expect(open).not.toContain(" até ");
  });

  it("keeps unavailable settings distinct from a turned-off channel or a municipality without a quota", () => {
    const html = renderToStaticMarkup(<MessageContractStatus active={null} live={undefined} />);
    expect(html).toContain("Status da integração indisponível");
    expect(html).toContain("Cota indisponível");
    expect(html).not.toContain("Inativo");
    expect(html).not.toContain("Cota não configurada");
  });
});

describe("contract form", () => {
  const form = (extra: Partial<MessageContract> = {}, municipalityId = "municipality-a", serviceSwitch = false) => renderToStaticMarkup(
    <MessageContractForm municipalityId={municipalityId} contract={contractState(extra)} serviceSwitch={serviceSwitch} />,
  );

  it("puts the contract actions beside the save button, without an actions legend, using the standard buttons", () => {
    const html = form();
    expect(html).toContain("Contrato e cota"); expect(html).toContain("Limite mensal");
    expect(html).not.toContain("Ações");
    const labels = Array.from(html.matchAll(/<button[^>]*data-ui-button=""[^>]*>([^<]*)<\/button>/g), ([, label]) => label);
    expect(labels).toEqual(["Salvar cota", "Encerrar contrato", "Zerar cota do mês"]);
    expect(html).toMatch(/<button[^>]*tw:border-ui-danger[^>]*>Encerrar contrato<\/button>/);
    expect(html.match(/data-ui-input=""/g)).toHaveLength(3);
  });

  it("asks for confirmation in the same line before ending the contract", () => {
    const html = form({ confirmingEnd: true });
    expect(html).toContain("Encerrar contrato hoje (");
    expect(html).toContain("Confirmar");
    expect(html).toContain("Cancelar");
    expect(html).not.toContain("Zerar cota do mês");
    expect(html.indexOf("Confirmar")).toBeGreaterThan(html.indexOf("Salvar cota"));
  });

  it("locks the actions without a municipality, ending needs a plan and zeroing needs a live contract", () => {
    const disabled = (html: string, label: string) => new RegExp(`<button[^>]*disabled=""[^>]*>\\s*${label}`).test(html);
    const none = form({}, "");
    for (const label of ["Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(disabled(none, label), label).toBe(true);
    const ready = form();
    for (const label of ["Salvar cota", "Encerrar contrato", "Zerar cota do mês"]) expect(disabled(ready, label), label).toBe(false);
    const empty = form({ settings: { plan: "", contractStart: "", contractEnd: "" }, live: null });
    expect(disabled(empty, "Salvar cota")).toBe(false); expect(disabled(empty, "Encerrar contrato")).toBe(true); expect(disabled(empty, "Zerar cota do mês")).toBe(true);
  });

  it("keeps the form unavailable until the quota loads and offers a retry on failure", () => {
    const loading = form({ ready: false, live: undefined });
    const failed = form({ ready: false, loadFailed: true, live: undefined });
    expect(loading).toContain("Carregando contrato e cota...");
    expect(failed).toContain("Carregar novamente");
    for (const html of [loading, failed]) {
      expect(html).not.toContain("Salvar cota");
      expect(html).not.toContain("Encerrar contrato");
      expect(html).not.toContain("Zerar cota do mês");
    }
  });

  it("offers the switch of the service for SMS and e-mail only, once the municipality has a contract", () => {
    const withSwitch = form({}, "municipality-a", true);
    expect(withSwitch).toContain("Serviço ativo para este município");
    expect(withSwitch).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
    expect(withSwitch.indexOf("Contrato e cota")).toBeLessThan(withSwitch.indexOf("Serviço ativo"));
    expect(withSwitch.indexOf("Serviço ativo")).toBeLessThan(withSwitch.indexOf("Limite mensal"));
    expect(form({}, "municipality-a", false)).not.toContain('type="checkbox"');
    expect(form({ live: null }, "municipality-a", true)).not.toContain('type="checkbox"');
    const off = form({ live: { ...live, enabled: false } }, "municipality-a", true);
    expect(off).toContain("Serviço desativado para este município");
    expect(off).toContain('type="checkbox"');
    expect(off).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
  });

  it("shows what was saved, told apart from a failure", () => {
    expect(form({ saveStatus: "Cota salva com sucesso." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Cota do mês zerada." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Contrato encerrado hoje." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Serviço ativado." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Serviço desativado." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Não foi possível alterar o serviço: Cadastre o contrato antes." })).not.toContain("inline-status ok");
    const failure = form({ saveStatus: "Não foi possível salvar: Informe um limite mensal válido." });
    expect(failure).toContain('class="whatsapp-inline-status"'); expect(failure).not.toContain("inline-status ok");
    expect(form()).not.toContain("whatsapp-inline-status ok");
  });
});
