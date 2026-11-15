import React, { useState } from "react";
import { NotificationEvent } from "../../../shared/notification-contract.js";
import { whatsappEventLabels, whatsappFieldLabels } from "../../../shared/whatsapp-binding-contract.js";
import { describeBinding } from "./whatsapp-template-display";
import type { EventBinding, EventBindings, MappingItem, TemplateCatalog } from "./whatsapp-integration-types";

function mappingSummary(mapping: MappingItem[]) {
  if (!mapping.length) return "Sem variáveis";
  return mapping.map((item, index) => `{{${index + 1}}} ${item.kind === "text" ? `“${item.value}”` : (whatsappFieldLabels as Record<string, string>)[item.value] || item.value}`).join(" · ");
}

interface Props {
  bindings: EventBindings;
  catalog: TemplateCatalog;
  readOnly: boolean;
  busy: boolean;
  onEdit: (event: string) => void;
  onRemove: (event: string) => Promise<string>;
}

export function WhatsappBindingsGrid({ bindings, catalog, readOnly, busy, onEdit, onRemove }: Props) {
  const [pendingRemoval, setPendingRemoval] = useState("");
  const [removalError, setRemovalError] = useState("");

  async function confirmRemoval(event: string) {
    const message = await onRemove(event);
    setRemovalError(message);
    if (!message) setPendingRemoval("");
  }

  return (
    <div className="whatsapp-grid-wrap">
      <table className="whatsapp-grid">
        <caption>Cada aviso do sistema usa um template aprovado na Meta. Sem vínculo, o aviso segue por e-mail.</caption>
        <thead><tr><th>Aviso</th><th>Template</th><th>Variáveis</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>
          {Object.values(NotificationEvent).map((event: string) => {
            const binding: EventBinding | null = bindings[event] || null;
            const situation = describeBinding(binding, catalog);
            return (
              <tr key={event}>
                <td>{(whatsappEventLabels as Record<string, string>)[event]}</td>
                <td>{binding ? <><code>{binding.templateName}</code> <small>{binding.languageCode}</small></> : "—"}</td>
                <td><small>{binding ? mappingSummary(binding.mapping) : "—"}</small></td>
                <td><span className={`whatsapp-badge whatsapp-badge--${situation.tone}`}>{situation.label}</span></td>
                <td className="whatsapp-grid-actions">
                  {pendingRemoval === event ? (
                    <>
                      <span>Remover vínculo?</span>
                      <button type="button" className="whatsapp-btn-danger" disabled={busy} onClick={() => confirmRemoval(event)}>Confirmar</button>
                      <button type="button" className="btn-secondary" onClick={() => { setPendingRemoval(""); setRemovalError(""); }}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-secondary" disabled={readOnly || busy} onClick={() => onEdit(event)}>{binding ? "Editar" : "Vincular"}</button>
                      {binding && <button type="button" className="whatsapp-btn-danger" disabled={readOnly || busy} onClick={() => setPendingRemoval(event)}>Remover</button>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {removalError && <p role="alert" className="form-error">{removalError}</p>}
    </div>
  );
}
