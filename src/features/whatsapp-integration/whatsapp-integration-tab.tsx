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

// WhatsApp tab of the integrations area: status, credentials with the connection test, templates, then the contract and quota, which only the global administration edits.
export function WhatsappIntegrationTab({ municipalityId, readOnly, canEditContract }: { municipalityId: string; readOnly: boolean; canEditContract: boolean }) {
  const credentials = useWhatsappCredentials(municipalityId);
  const contract = useMessageContract(NotificationChannel.WHATSAPP, municipalityId);
  const templates = useWhatsappTemplates(municipalityId, credentials.canSync);
  return (
    <div className="config-panel wide">
      <PanelHeader title="Canais de notificação por município" />
      {municipalityId && <MessageContractStatus active={credentials.isActive} live={contract.live} />}
      <div className="whatsapp-integration">
        <WhatsappCredentials municipalityId={municipalityId} credentials={credentials} />
        <WhatsappTemplatesPanel municipalityId={municipalityId} readOnly={readOnly} canSync={credentials.canSync} templates={templates} />
        {canEditContract && <MessageContractForm municipalityId={municipalityId} contract={contract} />}
      </div>
    </div>
  );
}
