import { NotificationChannel } from "../../../shared/notification-contract.js";
import { IntegrationStatusBadge } from "../../components/integration-card";
import { PanelHeader } from "../../components/ui";
import { MessageContractCard } from "../message-contract/message-contract-card";
import { useMessageContract } from "../message-contract/use-message-contract";
import { useWhatsappCredentials } from "./use-whatsapp-credentials";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { WhatsappCredentials } from "./whatsapp-credentials";
import { WhatsappTemplatesPanel } from "./whatsapp-templates-panel";

// WhatsApp tab of the integrations area: whether the municipality's key is in the server, the credentials with the send test (the
// master's), the contract (its switch is the master's) and the templates (whoever has the permission switches the message types).
export function WhatsappIntegrationTab({ municipalityId, master, readOnly }: { municipalityId: string; master: boolean; readOnly: boolean }) {
  const credentials = useWhatsappCredentials(municipalityId, master);
  const contract = useMessageContract(NotificationChannel.WHATSAPP, municipalityId);
  const canSync = master && credentials.canSync;
  const templates = useWhatsappTemplates(municipalityId, canSync);
  return (
    <div className="config-panel wide">
      <PanelHeader title="WhatsApp" aside={credentials.ready && <IntegrationStatusBadge integrated={credentials.integrated} />} />
      <div className="tw:grid tw:gap-3">
        {master
          ? <WhatsappCredentials municipalityId={municipalityId} credentials={credentials} />
          : <p className="whatsapp-note">A conexão com o WhatsApp (credenciais e teste de envio) é configurada pela administração da plataforma.</p>}
        {municipalityId && <MessageContractCard contract={contract} master={master} />}
        <WhatsappTemplatesPanel municipalityId={municipalityId} master={master} readOnly={readOnly} canSync={canSync} templates={templates} />
      </div>
    </div>
  );
}
