import React from "react";
import { Lock } from "lucide-react";
import { smsExamples } from "../../../shared/sms-messages-contract.js";
import type { SmsUseRow } from "./sms-types";

interface Props {
  rows: SmsUseRow[];
  municipalityName: string;
  // A message only goes out while the channel is active, so the switches stay locked until it is.
  channelActive: boolean;
  busy: boolean;
  onToggle: (key: string, active: boolean) => void;
}

const LOCK_REASON = "Ative o SMS para ligar as mensagens.";

export function SmsUsesTable({ rows, municipalityName, channelActive, busy, onToggle }: Props) {
  return (
    <div className="whatsapp-grid-wrap">
      <table className="whatsapp-grid">
        <thead>
          <tr>
            <th>Mensagem</th>
            <th>Exemplo do texto</th>
            <th>Ativo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const on = row.active && channelActive;
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{smsExamples(row.key, municipalityName || undefined).map((text) => <p key={text}>{text}</p>)}</td>
                <td className="whatsapp-switch-cell">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? "Desativar" : "Ativar"} ${row.label}`}
                    className={`whatsapp-switch${on ? " whatsapp-switch--on" : ""}`}
                    disabled={busy || !channelActive}
                    onClick={() => onToggle(row.key, !on)}
                  ><span className="whatsapp-switch-knob" /></button>
                  {!channelActive && <span role="img" aria-label={LOCK_REASON} title={LOCK_REASON}><Lock size={14} aria-hidden="true" /></span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
