import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { COMPLAINT_PHOTO_IDS } from "../../../shared/complaint-photo-contract.js";
import { Field } from "../../components/ui";
import { formatCep, formatCpf, formatPhone, isValidCpf, isValidPhone } from "../../utils";
import { lookupCep } from "../animal-services/cep-lookup";
import { ComplaintPhotoPicker } from "./complaint-photo-picker";
import type { ComplaintPhoto } from "./complaint-photo";

const EMPTY_COMPLAINT = {
  name: "", cpf: "", contact: "", email: "", description: "", confidential: false,
  cep: "", number: "", address: "", neighborhood: "", city: "", state: "",
};
type ComplaintForm = typeof EMPTY_COMPLAINT;

interface ComplaintPayload {
  tutor_name: string;
  tutor_email: string;
  cpf: string;
  phone: string;
  cep: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
  is_confidential: boolean;
  documents: ComplaintPhoto[];
}

interface PublicReportPanelProps {
  municipalityName?: string;
  onSubmit: (payload: ComplaintPayload) => Promise<unknown>;
}

function complaintError(form: ComplaintForm) {
  if (!form.name.trim()) return "Informe o nome do denunciante.";
  if (!isValidCpf(form.cpf)) return "Informe um CPF válido do denunciante.";
  if (!isValidPhone(form.contact)) return "Informe um telefone válido.";
  if (!form.description.trim()) return "Descreva a situação observada.";
  return "";
}

export function PublicReportPanel({ municipalityName = "Sistema municipal", onSubmit }: PublicReportPanelProps) {
  const reporterHeading = useId();
  const locationHeading = useId();
  const [form, setForm] = useState(EMPTY_COMPLAINT);
  const [photos, setPhotos] = useState<ComplaintPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  function patch<K extends keyof ComplaintForm>(field: K, value: ComplaintForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function fillLocation(value: string) {
    const cep = formatCep(value);
    patch("cep", cep);
    const location = await lookupCep(cep);
    if (!location) return;
    setForm((current) => current.cep !== cep ? current : {
      ...current,
      address: location.address || current.address,
      neighborhood: location.neighborhood || current.neighborhood,
      city: location.city || current.city,
      state: location.state || current.state,
    });
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || preparing) return;
    const validationError = complaintError(form);
    setError(validationError);
    if (validationError) return;
    submitting.current = true;
    setSaving(true);
    try {
      await onSubmit({
        tutor_name: form.name.trim(),
        tutor_email: form.email.trim(),
        cpf: form.cpf.trim(),
        phone: form.contact.trim(),
        cep: form.cep.trim(),
        address: [form.address.trim(), form.number.trim()].filter(Boolean).join(", "),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        notes: form.description.trim(),
        is_confidential: form.confidential,
        documents: photos.map((photo, index) => ({ ...photo, documentId: COMPLAINT_PHOTO_IDS[index] })),
      });
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : "Não foi possível registrar a denúncia.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="single-request-form clean-form public-report-inline" onSubmit={submitReport}>
      <section className="form-sub-card" aria-labelledby={reporterHeading}>
        <h3 id={reporterHeading} className="form-sub-card-title">Denunciante</h3>
        <div className="two-column-fields">
          <Field label="Nome" value={form.name} onChange={(value: string) => patch("name", value)} placeholder="Nome completo" autoComplete="name" />
          <Field label="CPF" value={form.cpf} onChange={(value: string) => patch("cpf", formatCpf(value))} placeholder="000.000.000-00" inputMode="numeric" />
          <Field label="Telefone" type="tel" value={form.contact} onChange={(value: string) => patch("contact", formatPhone(value))} placeholder="(00) 00000-0000" autoComplete="tel" />
          <Field label="E-mail (opcional)" type="email" value={form.email} onChange={(value: string) => patch("email", value)} autoComplete="email" />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.confidential} onChange={(event) => patch("confidential", event.target.checked)} />
          Manter meus dados em sigilo
        </label>
      </section>
      <section className="form-sub-card" aria-labelledby={locationHeading}>
        <h3 id={locationHeading} className="form-sub-card-title">Local da ocorrência</h3>
        <div className="address-lookup-grid">
          <Field label="CEP" value={form.cep} onChange={fillLocation} placeholder={`00000-000 (${municipalityName})`} inputMode="numeric" />
          <Field label="Número" value={form.number} onChange={(value: string) => patch("number", value)} />
          <Field label="UF" value={form.state} maxLength={2} onChange={(value: string) => patch("state", value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())} />
        </div>
        <Field label="Endereço" value={form.address} onChange={(value: string) => patch("address", value)} placeholder="Rua, complemento ou referência" />
        <div className="address-city-grid">
          <Field label="Bairro" value={form.neighborhood} onChange={(value: string) => patch("neighborhood", value)} />
          <Field label="Cidade" value={form.city} onChange={(value: string) => patch("city", value)} />
        </div>
      </section>
      <label className="field">
        <span>Descrição</span>
        <textarea value={form.description} onChange={(event) => patch("description", event.target.value)} placeholder="Descreva a situação observada" rows={6} />
      </label>
      <ComplaintPhotoPicker photos={photos} onChange={setPhotos} preparing={preparing} onPreparingChange={setPreparing} disabled={saving} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="public-inline-actions">
        <button className="primary-action" type="submit" disabled={saving || preparing}>{saving ? "Enviando..." : "Enviar denúncia"}</button>
      </div>
    </form>
  );
}
