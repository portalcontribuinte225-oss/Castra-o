import React from "react";
import type { AnyRecord } from "../../types";

interface Props {
  isActive: boolean;
  live: AnyRecord | null;
  contractEnd: string;
}

export function WhatsappStatusBar({ isActive, live, contractEnd }: Props) {
  const end = live?.contractEnd || contractEnd;
  const endLabel = end ? new Date(end + "T00:00:00").toLocaleDateString("pt-BR") : null;
  return (
    <div className="whatsapp-statusbar">
      <span className={`whatsapp-dot ${isActive ? "whatsapp-dot--on" : "whatsapp-dot--off"}`} />
      <span className={`whatsapp-statusbar-state ${isActive ? "whatsapp-status-ok" : "whatsapp-status-err"}`}>
        {isActive ? "Ativo" : "Inativo"}
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
