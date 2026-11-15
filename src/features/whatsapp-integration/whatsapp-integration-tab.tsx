import React from "react";
import { PanelHeader } from "../../components/ui";
import { useWhatsappCredentials } from "./use-whatsapp-credentials";
import { useWhatsappQuota } from "./use-whatsapp-quota";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { WhatsappCredentials } from "./whatsapp-credentials";
import { WhatsappQuota } from "./whatsapp-quota";
import { WhatsappStatusBar } from "./whatsapp-status-bar";
import { WhatsappTemplatesPanel } from "./whatsapp-templates-panel";

// WhatsApp tab of the integrations area: status, credentials with the connection test, templates, then contract and quota.
export function WhatsappIntegrationTab({ municipalityId, readOnly }: { municipalityId: string; readOnly: boolean }) {
  const credentials = useWhatsappCredentials(municipalityId);
  const quota = useWhatsappQuota(municipalityId);
  const templates = useWhatsappTemplates(municipalityId, credentials.canSync);
  return (
    <div className="config-panel wide">
      <PanelHeader title="Canais de notificação por município" />
      {municipalityId && <WhatsappStatusBar isActive={credentials.isActive} live={quota.live} contractEnd={quota.settings.contractEnd} />}
      <div className="whatsapp-integration">
        <WhatsappCredentials municipalityId={municipalityId} credentials={credentials} />
        <WhatsappTemplatesPanel municipalityId={municipalityId} readOnly={readOnly} canSync={credentials.canSync} templates={templates} />
        <WhatsappQuota municipalityId={municipalityId} quota={quota} />
      </div>
    </div>
  );
}
