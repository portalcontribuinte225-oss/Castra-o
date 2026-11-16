import React from "react";
import { Lock } from "lucide-react";
import type { EmailUseRow } from "./email-integration-types";

interface Props {
  rows: EmailUseRow[];
  // The master edits the ids (global); everyone else only sees whether each message has one.
  master: boolean;
  // The switches belong to a municipality, so they show only when one is selected.
  municipal: boolean;
  drafts: Record<string, string>;
  busy: boolean;
  onEditId: (key: string, value: string) => void;
  onToggle: (row: EmailUseRow) => void;
}

const LOCK_REASON = "Liga quando o master configurar o template.";

export function EmailTemplatesTable({ rows, master, municipal, drafts, busy, onEditId, onToggle }: Props) {
  return (
    <div className="whatsapp-grid-wrap">
      <table className="whatsapp-grid">
        <thead>
          <tr>
            <th>Mensagem</th>
            <th>{master ? "ID do template" : "Template"}</th>
            {master && <th>Variáveis</th>}
            {municipal && <th>Ativo</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const on = row.active && row.configured;
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  {master ? (
                    <label className="field">
                      <input
                        aria-label={`ID do template: ${row.label}`}
                        maxLength={200}
                        autoComplete="off"
                        placeholder="Cole o ID aqui"
                        value={drafts[row.key] ?? row.templateId ?? ""}
                        onChange={(event) => onEditId(row.key, event.target.value)}
                      />
                    </label>
                  ) : (row.configured ? "Configurado" : "Sem template")}
                </td>
                {master && (
                  <td>
                    <details>
                      <summary>ver</summary>
                      {(row.variables || []).map((name) => <code key={name}>{`{{${name}}}`} </code>)}
                    </details>
                  </td>
                )}
                {municipal && (
                  <td className="whatsapp-switch-cell">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${on ? "Desativar" : "Ativar"} ${row.label}`}
                      className={`whatsapp-switch${on ? " whatsapp-switch--on" : ""}`}
                      disabled={busy || (!on && !row.configured)}
                      onClick={() => onToggle(row)}
                    ><span className="whatsapp-switch-knob" /></button>
                    {!row.configured && <span role="img" aria-label={LOCK_REASON} title={LOCK_REASON}><Lock size={14} aria-hidden="true" /></span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
