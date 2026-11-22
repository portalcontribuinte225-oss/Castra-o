import { Lock } from "lucide-react";
import { smsTextPreview } from "../../../shared/sms-messages-contract.js";
import type { SmsUseRow } from "./sms-types";

interface Props {
  rows: SmsUseRow[];
  municipalityName: string;
  // A message only goes out while the platform's channel is active and the municipality's service is on, so the switches stay locked until then.
  channelActive: boolean;
  serviceOn: boolean;
  busy: boolean;
  onToggle: (key: string, active: boolean) => void;
}

const PLATFORM_OFF_REASON = "O SMS precisa estar ativo na plataforma para ligar as mensagens.";
const SERVICE_OFF_REASON = "O serviço de SMS está desativado para este município.";

export function SmsUsesTable({ rows, municipalityName, channelActive, serviceOn, busy, onToggle }: Props) {
  const open = channelActive && serviceOn;
  const lockReason = channelActive ? SERVICE_OFF_REASON : PLATFORM_OFF_REASON;
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
            const on = row.active && open;
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
                      disabled={busy || !open}
                      onClick={() => onToggle(row.key, !on)}
                    ><span className="whatsapp-switch-knob" /></button>
                    {!open && <span role="img" aria-label={lockReason} title={lockReason}><Lock size={14} aria-hidden="true" /></span>}
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
