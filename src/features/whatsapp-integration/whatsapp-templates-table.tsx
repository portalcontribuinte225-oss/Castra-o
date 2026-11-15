import React from "react";
import { Lock } from "lucide-react";
import { lockReason, templateRowKey, templateStatusLabel, templateStatusTone, variableOrderHint } from "./whatsapp-template-display";
import type { WhatsappTemplateList, WhatsappTemplateRow } from "./whatsapp-integration-types";

interface Props {
  list: WhatsappTemplateList;
  syncing: boolean;
  busy: boolean;
  readOnly: boolean;
  canSync: boolean;
  onSync: () => void;
  onToggle: (row: WhatsappTemplateRow) => void;
}

export function WhatsappTemplatesTable({ list, syncing, busy, readOnly, canSync, onSync, onToggle }: Props) {
  const syncedAt = list.syncedAt ? new Date(list.syncedAt).toLocaleString("pt-BR") : "";
  return (
    <div className="whatsapp-grid-wrap">
      <div className="whatsapp-sync-row">
        <button type="button" className="primary-action" disabled={readOnly || syncing || !canSync} onClick={onSync}>{syncing ? "Sincronizando..." : "Sincronizar"}</button>
        <span>{syncedAt ? `Última sincronização: ${syncedAt}` : "Ainda não sincronizado"}</span>
      </div>
      {list.templates.length === 0 ? (
        <p role="status">Nenhum template carregado. Salve o token e o ID da conta nas credenciais e clique em Sincronizar.</p>
      ) : (
        <table className="whatsapp-grid">
          <thead><tr><th>Template</th><th>Status</th><th>Aviso</th><th>Ativo</th></tr></thead>
          <tbody>
            {list.templates.map((row) => {
              const locked = lockReason(row);
              return (
                <tr key={templateRowKey(row)}>
                  <td><code>{row.name}</code> <small>{row.language}</small></td>
                  <td><span className={`whatsapp-badge whatsapp-badge--${templateStatusTone(row.status)}`}>{templateStatusLabel(row.status)}</span></td>
                  <td title={row.variables.length ? variableOrderHint(row) : undefined}>
                    {row.label || <span className="whatsapp-outside">Fora do padrão{row.reason ? `: ${row.reason}` : ""}</span>}
                  </td>
                  <td className="whatsapp-switch-cell">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.active}
                      aria-label={`${row.active ? "Desativar" : "Ativar"} ${row.name}`}
                      className={`whatsapp-switch${row.active ? " whatsapp-switch--on" : ""}`}
                      disabled={readOnly || busy || (!row.active && !row.canActivate)}
                      onClick={() => onToggle(row)}
                    ><span className="whatsapp-switch-knob" /></button>
                    {locked && <span role="img" aria-label={locked} title={locked}><Lock size={14} aria-hidden="true" /></span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
