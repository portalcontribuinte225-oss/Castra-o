import { Lock } from "lucide-react";
import { Input } from "../../components/input";
import type { EmailUseRow } from "./email-integration-types";

interface Props {
  rows: EmailUseRow[];
  // The master edits the ids (global); everyone else only sees whether each message has one.
  master: boolean;
  // The switches belong to a municipality, so they show only when one is selected.
  municipal: boolean;
  // They stay locked while the platform's administrator has the service switched off for the municipality.
  serviceOn: boolean;
  drafts: Record<string, string>;
  busy: boolean;
  onEditId: (key: string, value: string) => void;
  onToggle: (row: EmailUseRow) => void;
}

const LOCK_REASON = "Liga quando o master configurar o template.";
const SERVICE_OFF_REASON = "O serviço de e-mail está desativado para este município.";

export function EmailTemplatesTable({ rows, master, municipal, serviceOn, drafts, busy, onEditId, onToggle }: Props) {
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
            const on = row.active && row.configured && serviceOn;
            const lockReason = !serviceOn ? SERVICE_OFF_REASON : row.configured ? "" : LOCK_REASON;
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  {master ? (
                    <Input
                      aria-label={`ID do template: ${row.label}`}
                      maxLength={200}
                      autoComplete="off"
                      placeholder="Cole o ID aqui"
                      value={drafts[row.key] ?? row.templateId ?? ""}
                      onChange={(event) => onEditId(row.key, event.target.value)}
                    />
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
                  <td>
                    <div className="integration-table-actions">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${on ? "Desativar" : "Ativar"} ${row.label}`}
                        className={`whatsapp-switch${on ? " whatsapp-switch--on" : ""}`}
                        disabled={busy || !serviceOn || (!on && !row.configured)}
                        onClick={() => onToggle(row)}
                      ><span className="whatsapp-switch-knob" /></button>
                      {lockReason && <span role="img" aria-label={lockReason} title={lockReason}><Lock size={14} aria-hidden="true" /></span>}
                    </div>
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
