import React from "react";
import { PanelHeader } from "../../components/ui";
import { SmsCredentials } from "./sms-credentials";
import { SmsUsesTable } from "./sms-uses-table";
import { useSmsSettings } from "./use-sms-settings";

// SMS tab: the municipality's account and, below it, which messages it sends by SMS.
export function SmsSettings({ municipalityId, canManage }: { municipalityId: string; canManage: boolean }) {
  const state = useSmsSettings(municipalityId, canManage);
  if (!canManage) return <p role="status">Configuração de SMS restrita à administração.</p>;
  if (!municipalityId) return <p>Selecione um município para configurar o SMS.</p>;
  const busy = state.loading || state.saving || state.testing || state.sendingTest;
  return (
    <div className="config-panel wide">
      <PanelHeader title="SMS" />
      {state.loading && <p role="status">Carregando configuração de SMS...</p>}
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
      {!state.ready && !state.loading && <button type="button" className="ghost-button" onClick={state.retry}>Carregar novamente</button>}
      {state.ready && (
        <div className="whatsapp-integration">
          <SmsCredentials state={state} />
          <section className="whatsapp-section">
            <div className="whatsapp-section-header">
              <span className="whatsapp-section-label">Mensagens</span>
            </div>
            <SmsUsesTable
              rows={state.config.uses}
              municipalityName={state.config.municipalityName}
              channelActive={state.config.active}
              busy={busy}
              onToggle={state.setUseActive}
            />
          </section>
        </div>
      )}
    </div>
  );
}
