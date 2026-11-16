import React from "react";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { PanelHeader } from "../../components/ui";
import { MessageContractForm } from "../message-contract/message-contract-form";
import { MessageContractStatus } from "../message-contract/message-contract-status";
import { useMessageContract } from "../message-contract/use-message-contract";
import { SmsCredentials } from "./sms-credentials";
import { SmsUsesTable } from "./sms-uses-table";
import { useSmsSettings } from "./use-sms-settings";

// SMS tab: the master sets the platform's account, the municipality's contract and whether its service is on; whoever has the SMS permission
// turns the municipality's messages on or off.
export function SmsSettings({ municipalityId, master, canManage, canEditContract }: { municipalityId: string; master: boolean; canManage: boolean; canEditContract: boolean }) {
  const state = useSmsSettings(municipalityId, master, canManage);
  const contract = useMessageContract(NotificationChannel.SMS, canManage ? municipalityId : "");
  if (!canManage) return <p role="status">Configuração de SMS restrita à administração.</p>;
  if (!municipalityId && !master) return <p>Selecione um município para configurar o SMS.</p>;
  const busy = state.loading || state.saving || state.testing || state.sendingTest;
  const serviceOn = contract.live?.enabled !== false;
  return (
    <div className="config-panel wide">
      <PanelHeader title="SMS" />
      {state.ready && municipalityId && <MessageContractStatus active={state.config.active && serviceOn} live={contract.live} />}
      {state.loading && <p role="status">Carregando configuração de SMS...</p>}
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
      {!state.ready && !state.loading && <button type="button" className="ghost-button" onClick={state.retry}>Carregar novamente</button>}
      {state.ready && (
        <div className="whatsapp-integration">
          {master && <SmsCredentials state={state} />}
          <section className="whatsapp-section">
            <div className="whatsapp-section-header">
              <span className="whatsapp-section-label">Mensagens</span>
            </div>
            {!municipalityId && <p className="whatsapp-note">Selecione um município para ligar ou desligar as mensagens.</p>}
            <SmsUsesTable
              rows={state.config.uses}
              municipalityName={state.config.municipalityName}
              channelActive={state.config.active}
              serviceOn={serviceOn}
              busy={busy || !municipalityId}
              onToggle={state.setUseActive}
            />
          </section>
          {canEditContract && <MessageContractForm municipalityId={municipalityId} contract={contract} serviceSwitch />}
        </div>
      )}
    </div>
  );
}
