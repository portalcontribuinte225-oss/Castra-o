import { useState } from "react";
import { Button } from "../../components/button";
import { IntegrationCard } from "../../components/integration-card";
import { WhatsappTemplateLinkModal } from "./whatsapp-template-link-modal";
import { WhatsappTemplatesTable } from "./whatsapp-templates-table";
import type { useWhatsappTemplates } from "./use-whatsapp-templates";
import type { WhatsappTemplateRow } from "./whatsapp-integration-types";

type Templates = ReturnType<typeof useWhatsappTemplates>;

interface Props {
  municipalityId: string;
  // Only the master links a template to a notice and chooses its variables.
  master: boolean;
  readOnly: boolean;
  canSync: boolean;
  templates: Templates;
}

export function WhatsappTemplatesPanel({ municipalityId, master, readOnly, canSync, templates }: Props) {
  const [configuring, setConfiguring] = useState<WhatsappTemplateRow | null>(null);
  return (
    <IntegrationCard title="Templates da Meta">
      {!municipalityId && <p>Selecione um município para ver os templates.</p>}
      {readOnly && <p>Você não tem permissão para ligar ou desligar templates.</p>}
      {templates.loading && <p role="status">Carregando templates...</p>}
      {templates.error && (
        <div role="alert">
          <p className="form-error">{templates.error}</p>
          {!templates.ready && <Button variant="outline" onClick={templates.retry}>Carregar novamente</Button>}
        </div>
      )}
      {templates.notice && <p role="status">{templates.notice}</p>}
      {templates.ready && (
        <WhatsappTemplatesTable
          list={templates.list}
          syncing={templates.syncing}
          busy={templates.saving}
          readOnly={readOnly}
          canSync={canSync}
          master={master}
          onSync={templates.sync}
          onToggle={templates.toggle}
          onConfigure={setConfiguring}
        />
      )}
      {configuring && (
        <WhatsappTemplateLinkModal
          row={configuring}
          samples={templates.list.fieldSamples}
          onSave={(use, fields) => templates.saveLink(configuring, use, fields)}
          onClose={() => setConfiguring(null)}
        />
      )}
    </IntegrationCard>
  );
}
