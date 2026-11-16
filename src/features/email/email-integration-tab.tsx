import React from "react";
import { PanelHeader } from "../../components/ui";
import { EmailBrasaoStatus } from "../../../shared/email-contract.js";
import { MultiChannelSwitch } from "../notifications/multi-channel-switch";
import { EmailCredentials } from "./email-credentials";
import { EmailTemplatesTable } from "./email-templates-table";
import { useEmailAccount } from "./use-email-account";
import { useEmailSettings } from "./use-email-settings";

const brasaoText: Record<string, string> = {
  [EmailBrasaoStatus.READY]: "cadastrado",
  [EmailBrasaoStatus.MISSING]: "não cadastrado ⚠",
  [EmailBrasaoStatus.NO_PUBLIC_URL]: "o endereço público do sistema ainda não foi configurado pelo master ⚠",
};

// E-mail tab: the master sets the platform account and the template ids; each municipality only turns its messages on or off.
export function EmailIntegrationTab({ municipalityId, master, canManage }: { municipalityId: string; master: boolean; canManage: boolean }) {
  const email = useEmailSettings(municipalityId, master, canManage);
  const account = useEmailAccount(email.settings?.account ?? null, municipalityId, email.apply);
  if (!canManage) return <p role="status">Configuração de e-mail restrita à administração.</p>;
  if (!municipalityId && !master) return <p>Selecione um município para configurar o e-mail.</p>;
  const { settings } = email;
  const identity = settings?.identity;
  return (
    <div className="config-panel wide">
      <PanelHeader title="E-mail" />
      <div className="whatsapp-integration">
        {master && settings && <EmailCredentials account={settings.account} state={account} />}
        <section className="whatsapp-section">
          <div className="whatsapp-section-header">
            <span className="whatsapp-section-label">Templates</span>
          </div>
          {email.loading && <p role="status">Carregando a integração de e-mail...</p>}
          {email.error && (
            <div role="alert">
              <p className="form-error">{email.error}</p>
              {!email.ready && <button type="button" className="ghost-button" onClick={email.retry}>Carregar novamente</button>}
            </div>
          )}
          {email.notice && <p role="status">{email.notice}</p>}
          {identity && <p>Identificação nos e-mails: <strong>{identity.name}</strong>{identity.departmentName ? ` · ${identity.departmentName}` : ""} · Brasão: {brasaoText[identity.brasao] || identity.brasao}</p>}
          {settings && !municipalityId && <p className="whatsapp-note">Selecione um município para ligar ou desligar as mensagens.</p>}
          {municipalityId && <MultiChannelSwitch municipalityId={municipalityId} />}
          {settings && (
            <EmailTemplatesTable
              rows={settings.uses}
              master={master}
              municipal={settings.municipal}
              drafts={email.drafts}
              busy={email.saving}
              onEditId={email.editId}
              onToggle={email.toggle}
            />
          )}
          {master && settings && <button type="button" className="primary-action" disabled={!email.dirty || email.saving} onClick={email.saveTemplates}>{email.saving ? "Salvando..." : "Salvar templates"}</button>}
        </section>
      </div>
    </div>
  );
}
