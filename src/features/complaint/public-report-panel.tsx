import { useId, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, FormEvent } from "react";
import { COMPLAINT_PHOTO_IDS } from "../../../shared/complaint-photo-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { formatCep, formatCpf, formatPhone, isValidCpf, isValidPhone } from "../../utils";
import { lookupCep } from "../animal-services/cep-lookup";
import { ComplaintPhotoPicker } from "./complaint-photo-picker";
import type { ComplaintPhoto } from "./complaint-photo";

const EMPTY_COMPLAINT = {
  name: "", cpf: "", contact: "", email: "", description: "", confidential: false,
  cep: "", number: "", address: "", neighborhood: "", city: "", state: "",
};
type ComplaintForm = typeof EMPTY_COMPLAINT;
const fieldLabel = "tw:grid tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-ink";
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

function complaintError(form: ComplaintForm) {
  if (!form.name.trim()) return "Informe o nome do denunciante.";
  if (!isValidCpf(form.cpf)) return "Informe um CPF válido do denunciante.";
  if (!isValidPhone(form.contact)) return "Informe um telefone válido.";
  if (!form.description.trim()) return "Descreva a situação observada.";
  return "";
}

type ReportFieldProps = Omit<ComponentPropsWithoutRef<"input">, "onChange"> & {
  label: string;
  onChange: (value: string) => void;
};

function ReportField({ label, onChange, type = "text", ...props }: ReportFieldProps) {
  return <label className={fieldLabel}>
    <span>{label}</span>
    <Input {...props} type={type} onChange={(event) => onChange(event.target.value)} />
  </label>;
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
    <form className="public-report-inline tw:grid tw:gap-4" aria-label="Denunciar" aria-busy={saving || preparing} onSubmit={submitReport}>
      <Card as="section" className={sectionCard} aria-labelledby={reporterHeading}>
        <h3 id={reporterHeading} className="tw:m-0 tw:text-base tw:font-semibold">Denunciante</h3>
        <div className="two-column-fields">
          <ReportField label="Nome" value={form.name} onChange={(value) => patch("name", value)} placeholder="Nome completo" autoComplete="name" />
          <ReportField label="CPF" value={form.cpf} onChange={(value) => patch("cpf", formatCpf(value))} placeholder="000.000.000-00" inputMode="numeric" />
          <ReportField label="Telefone" type="tel" value={form.contact} onChange={(value) => patch("contact", formatPhone(value))} placeholder="(00) 00000-0000" autoComplete="tel" />
          <ReportField label="E-mail (opcional)" type="email" value={form.email} onChange={(value) => patch("email", value)} autoComplete="email" />
        </div>
        <label className="tw:inline-flex tw:min-h-11 tw:w-fit tw:cursor-pointer tw:items-center tw:gap-2 tw:text-sm tw:font-medium">
          <input data-ui-input="" className="tw:accent-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" type="checkbox" checked={form.confidential} onChange={(event) => patch("confidential", event.target.checked)} />
          Manter meus dados em sigilo
        </label>
      </Card>
      <Card as="section" className={sectionCard} aria-labelledby={locationHeading}>
        <h3 id={locationHeading} className="tw:m-0 tw:text-base tw:font-semibold">Local da ocorrência</h3>
        <div className="address-lookup-grid">
          <ReportField label="CEP" value={form.cep} onChange={fillLocation} placeholder={`00000-000 (${municipalityName})`} inputMode="numeric" />
          <ReportField label="Número" value={form.number} onChange={(value) => patch("number", value)} />
          <ReportField label="UF" value={form.state} maxLength={2} onChange={(value) => patch("state", value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())} />
        </div>
        <ReportField label="Endereço" value={form.address} onChange={(value) => patch("address", value)} placeholder="Rua, complemento ou referência" />
        <div className="address-city-grid">
          <ReportField label="Bairro" value={form.neighborhood} onChange={(value) => patch("neighborhood", value)} />
          <ReportField label="Cidade" value={form.city} onChange={(value) => patch("city", value)} />
        </div>
      </Card>
      <label className={fieldLabel}>
        <span>Descrição</span>
        <textarea
          data-ui-input=""
          className="tw:w-full tw:resize-y tw:rounded-[var(--ui-radius-md)] tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-[13px] tw:py-2.5 tw:text-sm tw:focus:border-ui-accent tw:focus:outline-hidden"
          value={form.description}
          onChange={(event) => patch("description", event.target.value)}
          placeholder="Descreva a situação observada"
          rows={6}
        />
      </label>
      <ComplaintPhotoPicker photos={photos} onChange={setPhotos} preparing={preparing} onPreparingChange={setPreparing} disabled={saving} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="tw:min-w-[190px] tw:justify-self-start tw:max-sm:w-full" type="submit" disabled={saving || preparing}>{saving ? "Enviando..." : "Enviar denúncia"}</Button>
    </form>
  );
}
