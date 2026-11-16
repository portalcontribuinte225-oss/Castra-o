import React from "react";
import type { MessageQuotaStatus } from "./message-contract-types";

interface Props {
  // Whether the channel is on: the connection of the municipality for WhatsApp, the platform's account for SMS and e-mail.
  active: boolean;
  live: MessageQuotaStatus | null;
}

// The line at the top of a channel's tab: whether it is on, how many messages the month has used and until when the contract goes.
export function MessageContractStatus({ active, live }: Props) {
  const endLabel = live?.contractEnd ? new Date(`${live.contractEnd}T00:00:00`).toLocaleDateString("pt-BR") : null;
  return (
    <div className="whatsapp-statusbar">
      <span className={`whatsapp-dot ${active ? "whatsapp-dot--on" : "whatsapp-dot--off"}`} />
      <span className={`whatsapp-statusbar-state ${active ? "whatsapp-status-ok" : "whatsapp-status-err"}`}>
        {active ? "Ativo" : "Inativo"}
      </span>
      {live?.plan ? (
        <>
          <span className="whatsapp-statusbar-sep">·</span>
          <span className="whatsapp-statusbar-text">
            <strong>{live.used ?? 0}/{live.plan}</strong> mensagens este mês
          </span>
          <span className="whatsapp-statusbar-sep">·</span>
          <span className={`whatsapp-statusbar-text ${live.active ? "" : "whatsapp-status-err"}`}>
            Contrato {live.active ? "vigente" : "encerrado"}
            {endLabel ? ` até ${endLabel}` : ""}
          </span>
        </>
      ) : (
        <>
          <span className="whatsapp-statusbar-sep">·</span>
          <span className="whatsapp-statusbar-text">Cota não configurada</span>
        </>
      )}
    </div>
  );
}
