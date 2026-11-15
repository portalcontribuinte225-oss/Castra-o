import React, { useState } from "react";
import { WHATSAPP_APPROVED_STATUS, whatsappEventLabels } from "../../../shared/whatsapp-binding-contract.js";
import { AuthDeliverySettings } from "../tutor-access/auth-delivery-settings";
import { useWhatsappTemplates } from "./use-whatsapp-templates";
import { WhatsappBindingEditor } from "./whatsapp-binding-editor";
import { WhatsappBindingsGrid } from "./whatsapp-bindings-grid";
import { WhatsappCatalogGrid } from "./whatsapp-catalog-grid";

export function WhatsappTemplatesPanel({ municipalityId, readOnly = false }: { municipalityId: string; readOnly?: boolean }) {
  const state = useWhatsappTemplates(municipalityId);
  const [editing, setEditing] = useState("");
  const accessTemplates = state.catalog.templates.filter((template) => template.status === WHATSAPP_APPROVED_STATUS);

  async function save(binding: Parameters<typeof state.saveBinding>[1]) {
    const message = await state.saveBinding(editing, binding);
    if (!message) setEditing("");
    return message;
  }

  return (
    <div className="whatsapp-templates">
    <section className="notification-settings">
      <h3>Templates e vínculos do WhatsApp</h3>
      <p>Os templates são criados e aprovados na Meta. Aqui você sincroniza a lista e escolhe qual template cada aviso do sistema usa.</p>
      {!municipalityId && <p>Selecione um município para configurar os templates.</p>}
      {readOnly && <p>Apenas administradores podem alterar os templates.</p>}
      {state.loading && <p role="status">Carregando templates...</p>}
      {state.error && <div role="alert"><p className="form-error">{state.error}</p>{!state.ready && <button type="button" className="ghost-button" onClick={state.retry}>Carregar novamente</button>}</div>}
      {state.notice && <p role="status">{state.notice}</p>}
      {state.ready && <>
        <h4>Vínculos por aviso</h4>
        <WhatsappBindingsGrid bindings={state.bindings} catalog={state.catalog} readOnly={readOnly} busy={state.saving} onEdit={setEditing} onRemove={state.removeBinding} />
        {editing && <WhatsappBindingEditor key={editing} eventLabel={(whatsappEventLabels as Record<string, string>)[editing]} current={state.bindings[editing] || null} catalog={state.catalog} saving={state.saving} onSave={save} onCancel={() => setEditing("")} />}
        <h4>Catálogo de templates da Meta</h4>
        <WhatsappCatalogGrid catalog={state.catalog} syncing={state.syncing} readOnly={readOnly} onSync={state.sync} />
      </>}
    </section>
    <AuthDeliverySettings municipalityId={municipalityId} channel="whatsappTemplates" readOnly={readOnly} catalogTemplates={state.ready ? accessTemplates : undefined} />
    </div>
  );
}
