import React from "react";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { PanelHeader } from "../../components/ui";
import { MessageContractForm } from "../message-contract/message-contract-form";
import { MessageContractStatus } from "../message-contract/message-contract-status";
import { useMessageContract } from "../message-contract/use-message-contract";
import { useWhatsappCredentials } from "./use-whatsapp-credentials";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { WhatsappCredentials } from "./whatsapp-credentials";
import { WhatsappTemplatesPanel } from "./whatsapp-templates-panel";

// WhatsApp tab of the integrations area: status, credentials with the connection test (the master's), the templates (whoever has the permission
// switches the message types), then the contract and quota, which only the master edits.
export function WhatsappIntegrationTab({ municipalityId, master, readOnly, canEditContract }: { municipalityId: string; master: boolean; readOnly: boolean; canEditContract: boolean }) {
  const credentials = useWhatsappCredentials(municipalityId);
  const contract = useMessageContract(NotificationChannel.WHATSAPP, municipalityId);
  const canSync = master && credentials.canSync;
  const templates = useWhatsappTemplates(municipalityId, canSync);
  return (
    <div className="config-panel wide">
      <PanelHeader title="Canais de notificação por município" />
      {municipalityId && <MessageContractStatus active={credentials.ready ? credentials.isActive : null} live={contract.live} />}
      <div className="tw:grid tw:gap-3">
        {master
          ? <WhatsappCredentials municipalityId={municipalityId} credentials={credentials} />
          : <p className="whatsapp-note">A conexão com o WhatsApp (credenciais e teste de envio) é configurada pela administração da plataforma.</p>}
        <WhatsappTemplatesPanel municipalityId={municipalityId} master={master} readOnly={readOnly} canSync={canSync} templates={templates} />
        {canEditContract && <MessageContractForm municipalityId={municipalityId} contract={contract} serviceSwitch={false} />}
      </div>
    </div>
  );
}
