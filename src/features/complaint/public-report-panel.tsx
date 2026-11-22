import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { COMPLAINT_PHOTO_IDS } from "../../../shared/complaint-photo-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { configTextareaStyle } from "../../components/ui";
import { formatCep, formatCpf, formatPhone, isValidCpf, isValidPhone } from "../../utils";
import { lookupCep } from "../animal-services/cep-lookup";
import { RequestTextField } from "../request-steps/request-text-field";
import { ComplaintPhotoPicker } from "./complaint-photo-picker";
import type { ComplaintPhoto } from "./complaint-photo";

const EMPTY_COMPLAINT = {
  name: "", cpf: "", contact: "", email: "", description: "", confidential: false,
  cep: "", number: "", address: "", neighborhood: "", city: "", state: "",
};
type ComplaintForm = typeof EMPTY_COMPLAINT;
const sectionCard = "tw:grid tw:gap-3 tw:p-4 tw:sm:p-6";

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

// The name, the CPF, the phone and the description are required; each field that is missing turns red once the visitor tries to send.
export function complaintIssues(form: ComplaintForm) {
  return {
    name: form.name.trim() ? "" : "Informe o nome do denunciante.",
    cpf: isValidCpf(form.cpf) ? "" : "Informe um CPF válido do denunciante.",
    contact: isValidPhone(form.contact) ? "" : "Informe um telefone válido.",
    description: form.description.trim() ? "" : "Descreva a situação observada.",
  };
}

export function PublicReportPanel({ municipalityName = "Sistema municipal", onSubmit }: PublicReportPanelProps) {
  const reporterHeading = useId();
  const locationHeading = useId();
  const [form, setForm] = useState(EMPTY_COMPLAINT);
  const [photos, setPhotos] = useState<ComplaintPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const descriptionError = useId();
  const issues = complaintIssues(form);
  const shown = (field: keyof typeof issues) => (showErrors && issues[field]) || undefined;
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
    setShowErrors(true);
    setError("");
    if (Object.values(issues).some(Boolean)) return;
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
    <form className="public-report-inline tw:grid tw:gap-4" aria-label="Denunciar" aria-busy={saving || preparing} noValidate onSubmit={submitReport}>
      <Card as="section" className={sectionCard} aria-labelledby={reporterHeading}>
        <h3 id={reporterHeading} className="tw:m-0 tw:text-base tw:font-semibold">Denunciante</h3>
        <div className="two-column-fields">
          <RequestTextField label="Nome" required value={form.name} error={shown("name")} onChange={(event) => patch("name", event.target.value)} placeholder="Nome completo" autoComplete="name" />
          <RequestTextField label="CPF" required value={form.cpf} error={shown("cpf")} onChange={(event) => patch("cpf", formatCpf(event.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
          <RequestTextField label="Telefone" required type="tel" value={form.contact} error={shown("contact")} onChange={(event) => patch("contact", formatPhone(event.target.value))} placeholder="(00) 00000-0000" autoComplete="tel" />
          <RequestTextField label="E-mail (opcional)" type="email" value={form.email} onChange={(event) => patch("email", event.target.value)} autoComplete="email" />
        </div>
        <label className="tw:inline-flex tw:min-h-11 tw:w-fit tw:cursor-pointer tw:items-center tw:gap-2 tw:text-sm tw:font-medium">
          <input data-ui-input="" className="tw:accent-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" type="checkbox" checked={form.confidential} onChange={(event) => patch("confidential", event.target.checked)} />
          Manter meus dados em sigilo
        </label>
      </Card>
      <Card as="section" className={sectionCard} aria-labelledby={locationHeading}>
        <h3 id={locationHeading} className="tw:m-0 tw:text-base tw:font-semibold">Local da ocorrência</h3>
        <div className="address-lookup-grid">
          <RequestTextField label="CEP" value={form.cep} onChange={(event) => void fillLocation(event.target.value)} placeholder={`00000-000 (${municipalityName})`} inputMode="numeric" />
          <RequestTextField label="Número" value={form.number} onChange={(event) => patch("number", event.target.value)} />
          <RequestTextField label="UF" value={form.state} maxLength={2} onChange={(event) => patch("state", event.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())} />
        </div>
        <RequestTextField label="Endereço" value={form.address} onChange={(event) => patch("address", event.target.value)} placeholder="Rua, complemento ou referência" />
        <div className="address-city-grid">
          <RequestTextField label="Bairro" value={form.neighborhood} onChange={(event) => patch("neighborhood", event.target.value)} />
          <RequestTextField label="Cidade" value={form.city} onChange={(event) => patch("city", event.target.value)} />
        </div>
      </Card>
      <label className="tw:grid tw:min-w-0 tw:content-start tw:gap-1">
        <span className="tw:text-[0.8125rem] tw:font-medium tw:text-ui-text">Descrição<span className="required-asterisk">*</span></span>
        <textarea
          data-ui-input=""
          className={`${configTextareaStyle} tw:resize-y`}
          value={form.description}
          onChange={(event) => patch("description", event.target.value)}
          placeholder="Descreva a situação observada"
          rows={6}
          required
          aria-invalid={Boolean(shown("description"))}
          aria-describedby={shown("description") ? descriptionError : undefined}
        />
        {shown("description") && <small id={descriptionError} className="tw:text-xs tw:text-ui-danger">{shown("description")}</small>}
      </label>
      <ComplaintPhotoPicker photos={photos} onChange={setPhotos} preparing={preparing} onPreparingChange={setPreparing} disabled={saving} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="tw:min-w-[190px] tw:justify-self-end tw:max-sm:w-full" type="submit" disabled={saving || preparing}>{saving ? "Enviando..." : "Enviar denúncia"}</Button>
    </form>
  );
}
