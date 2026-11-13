import React from "react";

export function ProcedureEntry({ onFirst, onRegistered, disabled = false }: { onFirst: () => void; onRegistered: () => void; disabled?: boolean }) {
  return <section className="procedure-entry" aria-label="Como deseja solicitar?">
    <h2>Como deseja solicitar?</h2>
    <p>Escolha a opção que corresponde ao seu animal.</p>
    <div className="procedure-entry-options">
      <button type="button" className="procedure-entry-card" onClick={onFirst} disabled={disabled}><strong>Primeira solicitação</strong><span>Vou informar os dados do animal e do responsável para fazer o primeiro pedido.</span></button>
      <button type="button" className="procedure-entry-card" onClick={onRegistered} disabled={disabled}><strong>Animal já cadastrado</strong><span>Tenho acesso de tutor. Vou entrar para escolher um dos meus animais e fazer outro pedido.</span></button>
    </div>
    {disabled && <p role="status">Selecione o município para continuar.</p>}
  </section>;
}
