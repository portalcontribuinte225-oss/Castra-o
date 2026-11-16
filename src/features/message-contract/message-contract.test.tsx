import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageContractForm } from "./message-contract-form";
import { MessageContractStatus } from "./message-contract-status";
import type { MessageQuotaStatus } from "./message-contract-types";
import type { MessageContract } from "./use-message-contract";

const noop = vi.fn();
const live: MessageQuotaStatus = { plan: 500, used: 12, remaining: 488, contractStart: null, contractEnd: "2026-12-31", active: true };
const contractState = (extra: Partial<MessageContract> = {}): MessageContract => ({
  settings: { plan: "500", contractStart: "", contractEnd: "2026-12-31" }, setSettings: noop, saveStatus: "", live,
  confirmingEnd: false, setConfirmingEnd: noop, save: noop, endContractToday: noop, resetUsed: noop, ...extra,
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
});

describe("contract form", () => {
  const form = (extra: Partial<MessageContract> = {}, municipalityId = "municipality-a") => renderToStaticMarkup(<MessageContractForm municipalityId={municipalityId} contract={contractState(extra)} />);

  it("puts the contract actions beside the save button, without an actions legend, using the standard buttons", () => {
    const html = form();
    expect(html).toContain("Contrato e cota"); expect(html).toContain("Limite mensal");
    expect(html).not.toContain("Ações");
    expect(html).not.toContain("whatsapp-section-heading");
    const row = html.slice(html.indexOf("whatsapp-save-row"), html.indexOf("whatsapp-note"));
    expect(row.indexOf("Salvar cota")).toBeGreaterThan(-1);
    expect(row.indexOf("Encerrar contrato")).toBeGreaterThan(row.indexOf("Salvar cota"));
    expect(row.indexOf("Zerar cota do mês")).toBeGreaterThan(row.indexOf("Encerrar contrato"));
    expect(row).toContain('class="ghost-button danger-action"');
    expect(row).toContain('class="ghost-button"');
    expect(html).not.toMatch(/whatsapp-btn|whatsapp-confirm|whatsapp-actions-row/);
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

  it("shows what was saved, told apart from a failure", () => {
    expect(form({ saveStatus: "Cota salva com sucesso." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Cota do mês zerada." })).toContain('class="whatsapp-inline-status ok"');
    expect(form({ saveStatus: "Contrato encerrado hoje." })).toContain('class="whatsapp-inline-status ok"');
    const failure = form({ saveStatus: "Não foi possível salvar: Informe um limite mensal válido." });
    expect(failure).toContain('class="whatsapp-inline-status"'); expect(failure).not.toContain("inline-status ok");
    expect(form()).not.toContain("whatsapp-inline-status ok");
  });
});
