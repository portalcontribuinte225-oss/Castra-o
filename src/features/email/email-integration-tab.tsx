import { Button } from "../../components/button";
import { IntegrationCard, IntegrationStatusBadge } from "../../components/integration-card";
import { PanelHeader } from "../../components/ui";
import { EmailImageStatus } from "../../../shared/email-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { MessageContractCard } from "../message-contract/message-contract-card";
import { useMessageContract } from "../message-contract/use-message-contract";
import { EmailTemplatesTable } from "./email-templates-table";
import { useEmailSettings } from "./use-email-settings";

// How the identity line names the state of each image; a missing public address is said once, below the line.
const imageText: Record<string, string> = {
  [EmailImageStatus.READY]: "cadastrado",
  [EmailImageStatus.MISSING]: "não cadastrado ⚠",
  [EmailImageStatus.NO_PUBLIC_URL]: "cadastrado",
};

// E-mail tab: whether the platform account is integrated (it lives in the server's variables), the municipality's contract (its switch
// is the master's), and the templates: the master sets their ids, whoever has the e-mail permission turns the messages on or off.
export function EmailIntegrationTab({ municipalityId, master, canManage }: { municipalityId: string; master: boolean; canManage: boolean }) {
  const email = useEmailSettings(municipalityId, master, canManage);
  const contract = useMessageContract(NotificationChannel.EMAIL, canManage ? municipalityId : "");
  if (!canManage) return <p role="status">Configuração de e-mail restrita à administração.</p>;
  if (!municipalityId && !master) return <p>Selecione um município para configurar o e-mail.</p>;
  const { settings } = email;
  const identity = settings?.identity;
  return (
    <div className="config-panel wide">
      <PanelHeader title="E-mail" aside={settings && <IntegrationStatusBadge integrated={settings.integrated} />} />
      <div className="tw:grid tw:gap-3">
        {municipalityId && <MessageContractCard contract={contract} master={master} />}
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
            <p className="tw:m-0">
              Identificação nos e-mails: <strong>{identity.name}</strong>{identity.departmentName ? ` · ${identity.departmentName}` : ""}
              {` · Brasão: ${imageText[identity.brasao] || identity.brasao} · Logo do órgão: ${imageText[identity.departmentLogo] || identity.departmentLogo}`}
            </p>
          )}
          {identity && [identity.brasao, identity.departmentLogo].includes(EmailImageStatus.NO_PUBLIC_URL) && (
            <p className="whatsapp-note">As imagens ficam fora dos e-mails até o endereço público (APP_PUBLIC_URL) ser cadastrado nas variáveis do servidor ⚠</p>
          )}
          {settings && !municipalityId && <p className="whatsapp-note">Selecione um município para ligar ou desligar as mensagens.</p>}
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
          {master && settings && <Button className="tw:justify-self-start" disabled={!email.dirty || email.saving} onClick={email.saveTemplates}>{email.saving ? "Salvando..." : "Salvar templates"}</Button>}
        </IntegrationCard>
      </div>
    </div>
  );
}
