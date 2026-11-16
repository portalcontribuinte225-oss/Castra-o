import React from "react";
import { Field } from "../../components/ui";
import type { MessageContract } from "./use-message-contract";

// The contract of one channel as the global administration edits it: the monthly limit and the dates, ending it today or starting the month over.
export function MessageContractForm({ municipalityId, contract }: { municipalityId: string; contract: MessageContract }) {
  const { settings, setSettings, saveStatus, live, confirmingEnd, setConfirmingEnd, save, endContractToday, resetUsed } = contract;
  const patch = (changes: Record<string, string>) => setSettings((current) => ({ ...current, ...changes }));
  const saved = saveStatus.includes("sucesso") || saveStatus.includes("zerada") || saveStatus.includes("encerrado");
  return (
    <section className="whatsapp-section">
      <div className="whatsapp-section-header">
        <span className="whatsapp-section-label">Contrato e cota</span>
      </div>
      <div className="whatsapp-fields-row">
        <Field label="Limite mensal" value={settings.plan} placeholder="Ex: 500" onChange={(value) => patch({ plan: value })} />
        <label className="field">
          <span>Início</span>
          <input type="date" value={settings.contractStart} onChange={(event) => patch({ contractStart: event.target.value })} />
        </label>
        <label className="field">
          <span>Fim</span>
          <input type="date" value={settings.contractEnd} onChange={(event) => patch({ contractEnd: event.target.value })} />
        </label>
      </div>
      <div className="whatsapp-save-row">
        <button className="primary-action" type="button" onClick={save} disabled={!municipalityId}>Salvar cota</button>
        {confirmingEnd ? (
          <>
            <span className="whatsapp-inline-status">Encerrar contrato hoje ({new Date().toLocaleDateString("pt-BR")})?</span>
            <button className="primary-action danger-action" type="button" onClick={endContractToday}>Confirmar</button>
            <button className="ghost-button" type="button" onClick={() => setConfirmingEnd(false)}>Cancelar</button>
          </>
        ) : (
          <>
            <button className="ghost-button danger-action" type="button" onClick={() => setConfirmingEnd(true)} disabled={!settings.plan || !municipalityId}>
              Encerrar contrato
            </button>
            <button className="ghost-button" type="button" onClick={resetUsed} disabled={!live?.plan || !municipalityId}>
              Zerar cota do mês
            </button>
          </>
        )}
        {saveStatus && <span className={saved ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}
      </div>
      <p className="whatsapp-note">Encerrar bloqueia novos envios imediatamente. Zerar reinicia a contagem deste mês.</p>
    </section>
  );
}
