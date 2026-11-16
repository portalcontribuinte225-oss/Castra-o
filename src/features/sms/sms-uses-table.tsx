import React from "react";
import { Lock } from "lucide-react";
import { DocumentsOutcome } from "../../../shared/notification-contract.js";
import { smsTexts } from "../../../shared/sms-messages-contract.js";
import type { SmsUseRow } from "./sms-types";

interface Props {
  rows: SmsUseRow[];
  municipalityName: string;
  // A message only goes out while the platform's channel is active, so the switches stay locked until it is.
  channelActive: boolean;
  busy: boolean;
  onToggle: (key: string, active: boolean) => void;
}

const LOCK_REASON = "O SMS precisa estar ativo na plataforma para ligar as mensagens.";
// The documents message has one text for each result of the analysis; only one of them is sent.
const OUTCOME_LABELS: Record<string, string> = { [DocumentsOutcome.APPROVED]: "Documentos aprovados", [DocumentsOutcome.REJECTED]: "Documentos não aprovados" };

export function SmsUsesTable({ rows, municipalityName, channelActive, busy, onToggle }: Props) {
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
            const on = row.active && channelActive;
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  {smsTexts(row.key, municipalityName || undefined).map(({ outcome, text }) => (
                    <p key={text}>{outcome && <><strong>{OUTCOME_LABELS[outcome]}</strong><br /></>}{text}</p>
                  ))}
                </td>
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
