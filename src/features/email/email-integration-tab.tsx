import React from "react";
import { Button } from "../../components/button";
import { IntegrationCard } from "../../components/integration-card";
import { PanelHeader } from "../../components/ui";
import { EmailImageStatus } from "../../../shared/email-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { MessageContractForm } from "../message-contract/message-contract-form";
import { MessageContractStatus } from "../message-contract/message-contract-status";
import { useMessageContract } from "../message-contract/use-message-contract";
import { EmailCredentials } from "./email-credentials";
import { EmailTemplatesTable } from "./email-templates-table";
import { useEmailAccount } from "./use-email-account";
import { useEmailSettings } from "./use-email-settings";

// How the identity line names the state of each image; a missing public address is said once, below the line.
const imageText: Record<string, string> = {
  [EmailImageStatus.READY]: "cadastrado",
  [EmailImageStatus.MISSING]: "não cadastrado ⚠",
  [EmailImageStatus.NO_PUBLIC_URL]: "cadastrado",
};

// E-mail tab: the master sets the platform account, the template ids, the municipality's contract and whether its service is on; whoever has the
// e-mail permission turns the municipality's messages on or off.
export function EmailIntegrationTab({ municipalityId, master, canManage, canEditContract }: { municipalityId: string; master: boolean; canManage: boolean; canEditContract: boolean }) {
  const email = useEmailSettings(municipalityId, master, canManage);
  const account = useEmailAccount(email.settings?.account ?? null, municipalityId, email.apply);
  const contract = useMessageContract(NotificationChannel.EMAIL, canManage ? municipalityId : "");
  if (!canManage) return <p role="status">Configuração de e-mail restrita à administração.</p>;
  if (!municipalityId && !master) return <p>Selecione um município para configurar o e-mail.</p>;
  const { settings } = email;
  const identity = settings?.identity;
  const serviceOn = contract.live?.enabled !== false;
  return (
    <div className="config-panel wide">
      <PanelHeader title="E-mail" />
      {municipalityId && settings && <MessageContractStatus active={settings.configured && serviceOn} live={contract.live} />}
      <div className="tw:grid tw:gap-3">
        {master && settings && <EmailCredentials account={settings.account} state={account} />}
        <IntegrationCard title="Templates">
          {email.loading && <p role="status">Carregando a integração de e-mail...</p>}
          {email.error && (
            <div role="alert">
              <p className="form-error">{email.error}</p>
              {!email.ready && <Button variant="outline" onClick={email.retry}>Carregar novamente</Button>}
            </div>
          )}
          {email.notice && <p role="status">{email.notice}</p>}
          {identity && (
            <p>
              Identificação nos e-mails: <strong>{identity.name}</strong>{identity.departmentName ? ` · ${identity.departmentName}` : ""}
              {` · Brasão: ${imageText[identity.brasao] || identity.brasao} · Logo do órgão: ${imageText[identity.departmentLogo] || identity.departmentLogo}`}
            </p>
          )}
          {identity && [identity.brasao, identity.departmentLogo].includes(EmailImageStatus.NO_PUBLIC_URL) && (
            <p className="whatsapp-note">As imagens ficam fora dos e-mails até o master configurar o endereço público do sistema ⚠</p>
          )}
          {settings && !municipalityId && <p className="whatsapp-note">Selecione um município para ligar ou desligar as mensagens.</p>}
          {settings && (
            <EmailTemplatesTable
              rows={settings.uses}
              master={master}
              municipal={settings.municipal}
              serviceOn={serviceOn}
              drafts={email.drafts}
              busy={email.saving}
              onEditId={email.editId}
              onToggle={email.toggle}
            />
          )}
          {master && settings && <Button className="tw:justify-self-start" disabled={!email.dirty || email.saving} onClick={email.saveTemplates}>{email.saving ? "Salvando..." : "Salvar templates"}</Button>}
        </IntegrationCard>
        {canEditContract && settings && <MessageContractForm municipalityId={municipalityId} contract={contract} serviceSwitch />}
      </div>
    </div>
  );
}
