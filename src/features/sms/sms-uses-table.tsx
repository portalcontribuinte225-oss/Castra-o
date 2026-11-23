import { Lock } from "lucide-react";
import { smsTextPreview } from "../../../shared/sms-messages-contract.js";
import type { SmsUseRow } from "./sms-types";

interface Props {
  rows: SmsUseRow[];
  municipalityName: string;
  // A message only goes out while SMS is integrated, so the switches stay locked until then.
  integrated: boolean;
  busy: boolean;
  onToggle: (key: string, active: boolean) => void;
}

const NOT_INTEGRATED_REASON = "O SMS precisa estar integrado para ligar as mensagens.";

export function SmsUsesTable({ rows, municipalityName, integrated, busy, onToggle }: Props) {
  return (
    <div className="whatsapp-grid-wrap">
      <table className="whatsapp-grid">
        <thead>
          <tr>
            <th>Mensagem</th>
            <th>Texto</th>
            <th>Ativo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const on = row.active && integrated;
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{smsTextPreview(row.key, municipalityName || undefined)}</td>
                <td>
                  <div className="integration-table-actions">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${on ? "Desativar" : "Ativar"} ${row.label}`}
                      className={`whatsapp-switch${on ? " whatsapp-switch--on" : ""}`}
                      disabled={busy || !integrated}
                      onClick={() => onToggle(row.key, !on)}
                    ><span className="whatsapp-switch-knob" /></button>
                    {!integrated && <span role="img" aria-label={NOT_INTEGRATED_REASON} title={NOT_INTEGRATED_REASON}><Lock size={14} aria-hidden="true" /></span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
