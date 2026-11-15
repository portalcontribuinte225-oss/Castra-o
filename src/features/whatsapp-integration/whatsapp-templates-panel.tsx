import React from "react";
import { WhatsappTemplatesTable } from "./whatsapp-templates-table";
import { WhatsappVariablesList } from "./whatsapp-variables-list";
import type { useWhatsappTemplates } from "./use-whatsapp-templates";

type Templates = ReturnType<typeof useWhatsappTemplates>;

interface Props {
  municipalityId: string;
  readOnly: boolean;
  canSync: boolean;
  templates: Templates;
}

export function WhatsappTemplatesPanel({ municipalityId, readOnly, canSync, templates }: Props) {
  return (
    <section className="whatsapp-section">
      <div className="whatsapp-section-header">
        <span className="whatsapp-section-label">Templates da Meta</span>
        <WhatsappVariablesList />
      </div>
      {!municipalityId && <p>Selecione um município para ver os templates.</p>}
      {readOnly && <p>Apenas administradores podem ligar ou desligar templates.</p>}
      {templates.loading && <p role="status">Carregando templates...</p>}
      {templates.error && (
        <div role="alert">
          <p className="form-error">{templates.error}</p>
          {!templates.ready && <button type="button" className="ghost-button" onClick={templates.retry}>Carregar novamente</button>}
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
          onSync={templates.sync}
          onToggle={templates.toggle}
        />
      )}
    </section>
  );
}
