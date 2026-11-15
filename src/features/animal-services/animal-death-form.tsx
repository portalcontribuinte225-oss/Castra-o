import React, { useState } from "react";
import { api } from "../../api";
import { buildDeathPayload, describeAnimal, emptyDeathForm, validateDeathForm } from "./animal-service-forms";
import { AnimalServiceSent } from "./animal-service-sent";
import type { AnimalSummary } from "./animal-service-types";
import { useAnimalServiceRequest } from "./use-animal-service-request";

export function AnimalDeathForm({ animal, onBack }: { animal: AnimalSummary; onBack: () => void }) {
  const request = useAnimalServiceRequest(animal.id, api.createAnimalDeathRequest);
  const [form, setForm] = useState(emptyDeathForm);
  if (request.created) return <AnimalServiceSent title="Registro de óbito enviado para análise." protocol={request.created.protocol} onBack={onBack} />;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = validateDeathForm(form);
    if (issue) { request.fail(issue); return; }
    void request.send(buildDeathPayload(form));
  }

  return <form className="panel animal-service-form" onSubmit={submit}>
    <h2>Registrar óbito</h2>
    <p className="svc-step-context">{describeAnimal(animal)}</p>
    <div className="svc-grid-2">
      <label className="field svc-field"><span>Data do óbito</span><input type="date" value={form.death_date} onChange={(event) => setForm((current) => ({ ...current, death_date: event.target.value }))} /></label>
      <label className="field svc-field"><span>Causa mortis</span><input value={form.death_cause} maxLength={200} onChange={(event) => setForm((current) => ({ ...current, death_cause: event.target.value }))} placeholder="Causa informada pelo tutor" /></label>
    </div>
    <label className="field svc-field"><span>Observações</span><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Informações adicionais sobre o óbito..." /></label>
    {request.error && <p className="form-error" role="alert">{request.error}</p>}
    <div className="svc-modal-footer">
      <button type="button" className="ghost-button" onClick={onBack}>Cancelar</button>
      <button type="submit" className="primary-action danger-action" disabled={request.saving}>{request.saving ? "Enviando..." : "Confirmar óbito"}</button>
    </div>
  </form>;
}
