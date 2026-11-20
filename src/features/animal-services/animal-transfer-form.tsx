import React, { useState } from "react";
import { api } from "../../api";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { animalServiceFieldStyle, animalServiceTextareaStyle } from "./animal-service-form-styles";
import { formatCep, formatCpf, formatPhone } from "../../utils";
import { lookupCep } from "./cep-lookup";
import { buildTransferPayload, describeAnimal, emptyTransferForm, validateTransferForm } from "./animal-service-forms";
import { AnimalServiceSent } from "./animal-service-sent";
import type { AnimalSummary, AnimalTransferPayload } from "./animal-service-types";
import { useAnimalServiceRequest } from "./use-animal-service-request";

export function AnimalTransferForm({ animal, onBack }: { animal: AnimalSummary; onBack: () => void }) {
  const request = useAnimalServiceRequest(animal.id, api.createAnimalTransferRequest);
  const [form, setForm] = useState(emptyTransferForm);
  if (request.created) return <AnimalServiceSent title="Solicitação de troca enviada para análise." protocol={request.created.protocol} onBack={onBack} />;

  const field = (key: keyof AnimalTransferPayload, format: (value: string) => string = (value) => value) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: format(event.target.value) }));

  async function changeCep(event: React.ChangeEvent<HTMLInputElement>) {
    const cep = formatCep(event.target.value);
    setForm((current) => ({ ...current, target_tutor_cep: cep }));
    const found = await lookupCep(cep);
    if (found) {
      setForm((current) => ({
        ...current,
        target_tutor_address: found.address || current.target_tutor_address,
        target_tutor_neighborhood: found.neighborhood || current.target_tutor_neighborhood,
        target_tutor_city: found.city || current.target_tutor_city,
        target_tutor_state: found.state || current.target_tutor_state,
      }));
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const issue = validateTransferForm(form);
    if (issue) { request.fail(issue); return; }
    void request.send(buildTransferPayload(form));
  }

  return <Card as="form" className="tw:grid tw:gap-4 tw:p-5" onSubmit={submit}>
    <h2 className="tw:m-0">Trocar tutor</h2>
    <p className="svc-step-context">{describeAnimal(animal)}</p>
    <Card tone="page" className="tw:grid tw:gap-3 tw:p-4">
      <h3 className="tw:m-0 tw:text-base tw:font-semibold">Novo tutor</h3>
      <div className="svc-grid-2">
        <label className={animalServiceFieldStyle}><span>Nome</span><Input value={form.target_tutor_name} maxLength={120} onChange={field("target_tutor_name")} /></label>
        <label className={animalServiceFieldStyle}><span>CPF</span><Input value={form.target_tutor_cpf} inputMode="numeric" onChange={field("target_tutor_cpf", formatCpf)} placeholder="000.000.000-00" /></label>
      </div>
      <div className="svc-grid-2">
        <label className={animalServiceFieldStyle}><span>E-mail</span><Input type="email" value={form.target_tutor_email} maxLength={254} onChange={field("target_tutor_email")} /></label>
        <label className={animalServiceFieldStyle}><span>Telefone</span><Input type="tel" value={form.target_tutor_phone} onChange={field("target_tutor_phone", formatPhone)} placeholder="(00) 00000-0000" /></label>
      </div>
    </Card>
    <Card tone="page" className="tw:grid tw:gap-3 tw:p-4">
      <h3 className="tw:m-0 tw:text-base tw:font-semibold">Endereço</h3>
      <div className="svc-grid-3">
        <label className={animalServiceFieldStyle}><span>CEP</span><Input value={form.target_tutor_cep} inputMode="numeric" onChange={changeCep} placeholder="00000-000" /></label>
        <label className={animalServiceFieldStyle}><span>Bairro</span><Input value={form.target_tutor_neighborhood} maxLength={120} onChange={field("target_tutor_neighborhood")} /></label>
        <label className={animalServiceFieldStyle}><span>UF</span><Input value={form.target_tutor_state} maxLength={2} onChange={field("target_tutor_state", (value) => value.toUpperCase())} placeholder="UF" /></label>
      </div>
      <div className="svc-grid-2">
        <label className={animalServiceFieldStyle}><span>Endereço</span><Input value={form.target_tutor_address} maxLength={200} onChange={field("target_tutor_address")} placeholder="Rua, número, complemento" /></label>
        <label className={animalServiceFieldStyle}><span>Cidade</span><Input value={form.target_tutor_city} maxLength={120} onChange={field("target_tutor_city")} /></label>
      </div>
    </Card>
    <label className={animalServiceFieldStyle}><span>Motivo</span><textarea data-ui-input="" className={animalServiceTextareaStyle} rows={3} maxLength={1000} value={form.notes} onChange={field("notes")} placeholder="Descreva o motivo da transferência..." /></label>
    {request.error && <p className="form-error" role="alert">{request.error}</p>}
    <div className="svc-modal-footer">
      <Button variant="outline" onClick={onBack}>Cancelar</Button>
      <Button type="submit" disabled={request.saving}>{request.saving ? "Enviando..." : "Solicitar troca"}</Button>
    </div>
  </Card>;
}
