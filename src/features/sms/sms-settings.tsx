import { NotificationChannel } from "../../../shared/notification-contract.js";
import { Button } from "../../components/button";
import { IntegrationCard, IntegrationStatusBadge } from "../../components/integration-card";
import { PanelHeader } from "../../components/ui";
import { MessageContractCard } from "../message-contract/message-contract-card";
import { useMessageContract } from "../message-contract/use-message-contract";
import { SmsTestMessage } from "./sms-test-message";
import { SmsUsesTable } from "./sms-uses-table";
import { useSmsSettings } from "./use-sms-settings";

// SMS tab: whether the platform's token is integrated (it lives in the server's variables), the master's send test, the municipality's
// contract (its switch is the master's) and the messages, which whoever has the SMS permission turns on or off.
export function SmsSettings({ municipalityId, master, canManage }: { municipalityId: string; master: boolean; canManage: boolean }) {
  const state = useSmsSettings(municipalityId, master, canManage);
  const contract = useMessageContract(NotificationChannel.SMS, canManage ? municipalityId : "");
  if (!canManage) return <p role="status">Configuração de SMS restrita à administração.</p>;
  if (!municipalityId && !master) return <p>Selecione um município para configurar o SMS.</p>;
  const busy = state.loading || state.saving || state.sendingTest;
  return (
    <div className="config-panel wide">
      <PanelHeader title="SMS" aside={state.ready && <IntegrationStatusBadge integrated={state.config.integrated} />} />
      {state.loading && <p role="status">Carregando configuração de SMS...</p>}
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      {!state.ready && !state.loading && <Button variant="outline" onClick={state.retry}>Carregar novamente</Button>}
      {state.ready && (
        <div className="tw:grid tw:gap-3">
          {master && <SmsTestMessage state={state} />}
          {municipalityId && <MessageContractCard contract={contract} master={master} />}
          <IntegrationCard title="Mensagens">
            {!municipalityId && <p className="whatsapp-note">Selecione um município para ligar ou desligar as mensagens.</p>}
            <SmsUsesTable
              rows={state.config.uses}
              municipalityName={state.config.municipalityName}
              integrated={state.config.integrated}
              busy={busy || !municipalityId}
              onToggle={state.setUseActive}
            />
          </IntegrationCard>
        </div>
      )}
    </div>
  );
}
