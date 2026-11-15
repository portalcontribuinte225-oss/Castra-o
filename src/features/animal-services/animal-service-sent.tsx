import React from "react";

export function AnimalServiceSent({ title, protocol, onBack }: { title: string; protocol?: string; onBack: () => void }) {
  return <section className="panel">
    <h2>{title}</h2>
    {protocol && <p>Protocolo: <strong>{protocol}</strong></p>}
    <button type="button" className="primary-action" onClick={onBack}>Voltar aos meus animais</button>
  </section>;
}
