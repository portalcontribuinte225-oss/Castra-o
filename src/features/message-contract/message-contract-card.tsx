import { ContractState } from "../../../shared/message-quota-contract.js";
import { Button } from "../../components/button";
import { IntegrationCard, integrationActionFieldStyle, integrationFieldsStyle } from "../../components/integration-card";
import { ConfigActiveToggle, ConfigField } from "../../components/ui";
import type { MessageContract } from "./use-message-contract";

const STATE_LABELS: Record<string, string> = {
  [ContractState.IN_FORCE]: "Vigente",
  [ContractState.OFF]: "Desativado",
  [ContractState.OUT_OF_PERIOD]: "Fora do período",
};

// Where the contract stands and the month's usage, the only line whoever sees the tab gets.
function ContractSummary({ live }: { live: MessageContract["live"] }) {
  if (!live) return <span role="status" className="tw:text-sm tw:font-semibold tw:text-ui-muted">Sem contrato</span>;
  const inForce = live.state === ContractState.IN_FORCE;
  return (
    <span role="status" className="tw:inline-flex tw:items-center tw:gap-3 tw:text-sm tw:font-semibold">
      <span className={inForce ? "tw:text-ui-accent" : "tw:text-ui-danger"}>{STATE_LABELS[live.state]}</span>
      <span className="tw:text-ui-ink">{live.used}/{live.plan}</span>
    </span>
  );
}

// The contract of one channel for one municipality. The master also gets the limit, the dates and the switch, the only on/off the
// channel has: the fields stay locked while the contract is on.
export function MessageContractCard({ contract, master }: { contract: MessageContract; master: boolean }) {
  const { settings, setSettings, ready, loadFailed, retry, saving, saveStatus, saveOk, live, contractOn, canTurnOn, setActive } = contract;
  if (!ready) {
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
  const locked = saving || contractOn;
  const patch = (changes: Record<string, string>) => setSettings((current) => ({ ...current, ...changes }));
  return (
    <IntegrationCard title="Contrato e cota" actions={<ContractSummary live={live} />}>
      {master && (
        <>
          <div className={integrationActionFieldStyle}>
            <div className={integrationFieldsStyle}>
              <ConfigField label="Limite mensal" value={settings.plan} placeholder="Ex: 500" onChange={(value) => patch({ plan: value })} disabled={locked} />
              <ConfigField label="Início" type="date" value={settings.contractStart} onChange={(value) => patch({ contractStart: value })} disabled={locked} />
              <ConfigField label="Fim" type="date" value={settings.contractEnd} onChange={(value) => patch({ contractEnd: value })} disabled={locked} />
            </div>
            <ConfigActiveToggle checked={contractOn} onChange={setActive} onText="Ativo" offText="Desativado" disabled={saving || (!contractOn && !canTurnOn)} />
          </div>
          {saveStatus && <span role="status" className={saveOk ? "whatsapp-inline-status ok" : "whatsapp-inline-status"}>{saveStatus}</span>}
        </>
      )}
    </IntegrationCard>
  );
}
