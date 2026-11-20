import React from "react";
import { Lock, Settings } from "lucide-react";
import { Button } from "../../components/button";
import { isNotUsedBySystem, lockReason, NOT_USED_BY_SYSTEM_TEXT, templateRowKey, templateStatusLabel, templateStatusTone, variableOrderHint } from "./whatsapp-template-display";
import type { WhatsappTemplateList, WhatsappTemplateRow } from "./whatsapp-integration-types";

interface Props {
  list: WhatsappTemplateList;
  syncing: boolean;
  busy: boolean;
  readOnly: boolean;
  canSync: boolean;
  master: boolean;
  onSync: () => void;
  onToggle: (row: WhatsappTemplateRow) => void;
  onConfigure: (row: WhatsappTemplateRow) => void;
}

export function WhatsappTemplatesTable({ list, syncing, busy, readOnly, canSync, master, onSync, onToggle, onConfigure }: Props) {
  const syncedAt = list.syncedAt ? new Date(list.syncedAt).toLocaleString("pt-BR") : "";
  return (
    <div className="whatsapp-grid-wrap">
      <div className="tw:mb-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button disabled={readOnly || syncing || !canSync} onClick={onSync}>{syncing ? "Sincronizando..." : "Sincronizar"}</Button>
        <span>{syncedAt ? `Última sincronização: ${syncedAt}` : "Ainda não sincronizado"}</span>
      </div>
      {list.templates.length === 0 ? (
        <p className="tw:m-0" role="status">Nenhum template carregado. Salve o token e o ID da conta nas credenciais e clique em Sincronizar.</p>
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
                    {row.label ? <>{row.label}{!row.configured && <small className="whatsapp-muted"> (pelo nome)</small>}</> : (isNotUsedBySystem(row)
                      ? <span className="whatsapp-muted">{NOT_USED_BY_SYSTEM_TEXT}</span>
                      : <span className="whatsapp-outside">Fora do padrão{row.reason ? `: ${row.reason}` : ""}</span>)}
                  </td>
                  <td>
                    <div className="integration-table-actions">
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
                      {master && row.configurable && (
                        <Button variant="outline" className="tw:w-10 tw:px-0" title="Configurar" aria-label={`Configurar ${row.name}`} onClick={() => onConfigure(row)}>
                          <Settings size={15} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
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
