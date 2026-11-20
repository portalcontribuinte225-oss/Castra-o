import React, { useState } from "react";
import { api } from "../../api";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { animalServiceFieldStyle, animalServiceTextareaStyle } from "./animal-service-form-styles";
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

  return <Card as="form" className="tw:grid tw:gap-4 tw:p-5" onSubmit={submit}>
    <h2 className="tw:m-0">Registrar óbito</h2>
    <p className="svc-step-context">{describeAnimal(animal)}</p>
    <div className="svc-grid-2">
      <label className={animalServiceFieldStyle}><span>Data do óbito</span><Input type="date" value={form.death_date} onChange={(event) => setForm((current) => ({ ...current, death_date: event.target.value }))} /></label>
      <label className={animalServiceFieldStyle}><span>Causa mortis</span><Input value={form.death_cause} maxLength={200} onChange={(event) => setForm((current) => ({ ...current, death_cause: event.target.value }))} placeholder="Causa informada pelo tutor" /></label>
    </div>
    <label className={animalServiceFieldStyle}><span>Observações</span><textarea data-ui-input="" className={animalServiceTextareaStyle} rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Informações adicionais sobre o óbito..." /></label>
    {request.error && <p className="form-error" role="alert">{request.error}</p>}
    <div className="svc-modal-footer">
      <Button variant="outline" onClick={onBack}>Cancelar</Button>
      <Button variant="danger" type="submit" disabled={request.saving}>{request.saving ? "Enviando..." : "Confirmar óbito"}</Button>
    </div>
  </Card>;
}
