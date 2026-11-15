import React from "react";
import { templateKey, templateStatusLabel, templateStatusTone } from "./whatsapp-template-display";
import type { TemplateCatalog } from "./whatsapp-integration-types";

interface Props {
  catalog: TemplateCatalog;
  syncing: boolean;
  readOnly: boolean;
  onSync: () => void;
}

export function WhatsappCatalogGrid({ catalog, syncing, readOnly, onSync }: Props) {
  const syncedAt = catalog.syncedAt ? new Date(catalog.syncedAt).toLocaleString("pt-BR") : "";
  return (
    <div className="whatsapp-grid-wrap">
      <div className="whatsapp-sync-row">
        <button type="button" className="primary-action" disabled={readOnly || syncing} onClick={onSync}>{syncing ? "Sincronizando..." : "Sincronizar com a Meta"}</button>
        <span>{syncedAt ? `Última sincronização: ${syncedAt}` : "Ainda não sincronizado"}</span>
      </div>
      {catalog.templates.length === 0 ? (
        <p role="status">Nenhum template carregado. Informe o token e o ID da conta do WhatsApp Business e sincronize.</p>
      ) : (
        <table className="whatsapp-grid">
          <caption>Templates da conta na Meta (somente leitura). Eles são criados e aprovados no painel da Meta.</caption>
          <thead><tr><th>Template</th><th>Idioma</th><th>Categoria</th><th>Status</th><th>Variáveis</th><th>Formato</th></tr></thead>
          <tbody>
            {catalog.templates.map((template) => (
              <tr key={templateKey(template)}>
                <td><code>{template.name}</code></td>
                <td>{template.language}</td>
                <td>{template.category || "—"}</td>
                <td><span className={`whatsapp-badge whatsapp-badge--${templateStatusTone(template.status)}`}>{templateStatusLabel(template.status)}</span></td>
                <td>{template.supported ? template.variableCount : "—"}</td>
                <td>{template.supported ? "Suportado" : <small>{template.unsupportedReason || "Formato não suportado"}</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
