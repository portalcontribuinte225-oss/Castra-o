import React from "react";
import { Button } from "../../components/button";
import { IntegrationCard, integrationFieldsStyle } from "../../components/integration-card";
import { ConfigField } from "../../components/ui";
import type { MessageContract } from "./use-message-contract";

export function MessageContractForm({ municipalityId, contract }: { municipalityId: string; contract: MessageContract }) {
  const { settings, setSettings, ready, loadFailed, retry, saving, saveStatus, live, confirmingEnd, setConfirmingEnd, save, endContractToday, resetUsed } = contract;
  if (municipalityId && !ready) {
    return (
      <IntegrationCard title="Contrato e cota">
        {loadFailed ? (
          <div role="alert">
            <p className="form-error">Não foi possível carregar o contrato e a cota de mensagens.</p>
            <Button variant="outline" onClick={retry}>Carregar novamente</Button>
          </div>
        ) : <p role="status">Carregando contrato e cota...</p>}
      </IntegrationCard>
    );
  }
  const locked = !municipalityId || saving;
  const patch = (changes: Record<string, string>) => setSettings((current) => ({ ...current, ...changes }));
  const saved = saveStatus.includes("sucesso") || saveStatus.includes("zerada") || saveStatus.includes("encerrado");
  return (
    <IntegrationCard title="Contrato e cota">
      <div className={integrationFieldsStyle}>
        <ConfigField label="Limite mensal" value={settings.plan} placeholder="Ex: 500" onChange={(value) => patch({ plan: value })} disabled={locked} />
        <ConfigField label="Início" type="date" value={settings.contractStart} onChange={(value) => patch({ contractStart: value })} disabled={locked} />
        <ConfigField label="Fim" type="date" value={settings.contractEnd} onChange={(value) => patch({ contractEnd: value })} disabled={locked} />
      </div>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button onClick={save} disabled={locked}>Salvar cota</Button>
        {confirmingEnd ? (
          <>
            <span className="whatsapp-inline-status">Encerrar contrato hoje ({new Date().toLocaleDateString("pt-BR")})?</span>
            <Button variant="danger" onClick={endContractToday} disabled={locked}>Confirmar</Button>
            <Button variant="outline" onClick={() => setConfirmingEnd(false)} disabled={locked}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirmingEnd(true)} disabled={!settings.plan || locked}>
              Encerrar contrato
            </Button>
            <Button variant="outline" onClick={resetUsed} disabled={!live?.plan || locked}>
              Zerar cota do mês
            </Button>
          </>
        )}
        {saveStatus && <span className={saved ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}
      </div>
      <p className="whatsapp-note">Encerrar bloqueia novos envios imediatamente. Zerar reinicia a contagem deste mês.</p>
    </IntegrationCard>
  );
}
