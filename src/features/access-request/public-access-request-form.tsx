import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Building2, CheckCircle2, HeartHandshake, Shield } from "lucide-react";
import { accessRequestAddressIssues } from "../../../shared/access-request-address-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { accessRequesterTypes } from "../../domain";
import type { AnyRecord } from "../../types";
import { formatCep, formatCpfOrCnpj, formatPhone, isValidCpfOrCnpj, isValidPhone } from "../../utils";
import { AddressFields } from "../address/address-fields";
import { lookupCep } from "../animal-services/cep-lookup";
import { neighborhoodNames } from "../neighborhoods/neighborhoods";
import { RequestTextField } from "../request-steps/request-text-field";

const EMPTY_FORM = {
  requesterType: accessRequesterTypes[0].id,
  organizationName: "",
  responsibleName: "",
  document: "",
  email: "",
  phone: "",
  cep: "",
  number: "",
  state: "",
  address: "",
  neighborhood: "",
  city: "",
};
type AccessRequestForm = typeof EMPTY_FORM;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMERIC_DOCUMENT = /^[0-9.\-/\s]*$/;

// What is wrong with each field: the responsible and the e-mail are required; everything else must be valid when given.
export function accessRequestIssues(form: AccessRequestForm) {
  const email = form.email.trim();
  return {
    responsibleName: form.responsibleName.trim() ? "" : "Informe o nome do responsável.",
    email: !email ? "Informe o e-mail para contato." : email.length > 254 || !EMAIL_PATTERN.test(email) ? "Informe um e-mail válido." : "",
    phone: form.phone.trim() && !isValidPhone(form.phone) ? "Informe um telefone válido." : "",
    document: form.document.trim() && NUMERIC_DOCUMENT.test(form.document) && !isValidCpfOrCnpj(form.document) ? "Informe um CPF ou CNPJ válido." : "",
    ...accessRequestAddressIssues(form),
  };
}

interface PublicAccessRequestFormProps {
  municipalityId: string;
  // The neighborhoods of every municipality the public page knows; the address offers those of the selected one.
  neighborhoods: AnyRecord[];
  onSubmit: (payload: AnyRecord) => Promise<unknown>;
}

// The credentialing request of an ONG or an animal protector: who is responsible, where they are and how to reach them.
export function PublicAccessRequestForm({ municipalityId, neighborhoods, onSubmit }: PublicAccessRequestFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  const selectedType = accessRequesterTypes.find((type) => type.id === form.requesterType) || accessRequesterTypes[0];
  const issues = accessRequestIssues(form);
  const shown = (field: keyof typeof issues) => (showErrors && issues[field]) || undefined;

  function patch(field: keyof AccessRequestForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function changeCep(value: string) {
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setShowErrors(true);
    if (Object.values(issues).some(Boolean)) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        requester_type: form.requesterType,
        organization_name: form.organizationName,
        responsible_name: form.responsibleName,
        email: form.email,
        phone: form.phone,
        document: form.document,
        cep: form.cep,
        address: form.address,
        address_number: form.number,
        neighborhood: form.neighborhood,
        city: form.city,
        state: form.state,
        assigned_sector: selectedType.sector,
        municipality_id: municipalityId,
      });
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : "Não foi possível enviar a solicitação.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <Card className="tw:p-4 tw:sm:p-6">
        <div className="tw:grid tw:min-h-48 tw:content-center tw:justify-items-center tw:gap-2 tw:text-center" role="status">
          <CheckCircle2 size={38} strokeWidth={1.5} className="tw:text-ui-accent" aria-hidden="true" />
          <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Solicitação enviada!</h3>
          <p className="tw:m-0 tw:text-ui-text">Um usuário interno vai analisar o pedido e liberar o acesso se estiver tudo certo.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="tw:p-4 tw:sm:p-6">
      <form className="tw:grid tw:gap-4" aria-label="Solicitar credenciamento" aria-busy={saving} noValidate onSubmit={submit}>
        <div className="tw:flex tw:items-center tw:gap-3">
          <span className="tw:inline-flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[10px] tw:bg-ui-accent-soft tw:text-ui-accent"><Shield size={18} aria-hidden="true" /></span>
          <div>
            <h3 className="tw:m-0 tw:text-base tw:font-semibold">Solicitar credenciamento</h3>
            <p className="tw:m-0 tw:text-sm tw:text-ui-text">Acesso ao sistema para ONGs e protetores independentes.</p>
          </div>
        </div>

        <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2" role="group" aria-label="Tipo de solicitante">
          {accessRequesterTypes.map((type) => (
            <Card
              as="button"
              key={type.id}
              aria-pressed={form.requesterType === type.id}
              className="tw:flex tw:enabled:cursor-pointer tw:flex-col tw:items-start tw:gap-1 tw:px-3.5 tw:py-3 tw:text-left tw:enabled:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent"
              disabled={saving}
              onClick={() => patch("requesterType", type.id)}
            >
              <span className="tw:inline-flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg tw:bg-ui-accent-soft tw:text-ui-accent">
                {type.id === "ONG" ? <Building2 size={17} aria-hidden="true" /> : <HeartHandshake size={17} aria-hidden="true" />}
              </span>
              <span className="tw:text-sm tw:font-semibold tw:text-ui-ink">{type.label}</span>
              <span className="tw:text-xs tw:text-ui-text">{type.sector}</span>
            </Card>
          ))}
        </div>

        <Card className="form-sub-card">
          <span className="form-sub-card-title">Responsável</span>
          <div className="two-column-fields">
            <RequestTextField label="Organização" type="text" placeholder="Nome da ONG ou grupo (opcional para protetor)" value={form.organizationName} onChange={(event) => patch("organizationName", event.target.value)} autoComplete="organization" disabled={saving} />
            <RequestTextField label="Responsável" required type="text" placeholder="Nome completo do responsável" value={form.responsibleName} error={shown("responsibleName")} onChange={(event) => patch("responsibleName", event.target.value)} autoComplete="name" disabled={saving} />
            <RequestTextField label="CPF / CNPJ" type="text" placeholder="CPF, CNPJ ou matrícula" value={form.document} error={shown("document")} onChange={(event) => patch("document", NUMERIC_DOCUMENT.test(event.target.value) ? formatCpfOrCnpj(event.target.value) : event.target.value)} disabled={saving} />
          </div>
        </Card>

        <Card className="form-sub-card">
          <span className="form-sub-card-title">Endereço</span>
          <AddressFields
            values={form}
            neighborhoodNames={neighborhoodNames(neighborhoods, municipalityId)}
            issues={showErrors ? issues : {}}
            onField={patch}
            onCepChange={(value) => void changeCep(value)}
            onStateChange={(value) => patch("state", value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())}
          />
        </Card>

        <Card className="form-sub-card">
          <span className="form-sub-card-title">Contato</span>
          <div className="two-column-fields">
            <RequestTextField label="E-mail" required type="email" placeholder="E-mail para contato" value={form.email} error={shown("email")} onChange={(event) => patch("email", event.target.value)} autoComplete="email" disabled={saving} />
            <RequestTextField label="Telefone" type="tel" placeholder="(00) 00000-0000" value={form.phone} error={shown("phone")} onChange={(event) => patch("phone", formatPhone(event.target.value))} autoComplete="tel" disabled={saving} />
          </div>
        </Card>

        {error && <p className="form-error" role="alert">{error}</p>}

        <Button className="tw:justify-self-end tw:max-sm:w-full" type="submit" disabled={saving}>
          <Shield size={14} aria-hidden="true" />
          {saving ? "Enviando solicitação..." : "Enviar solicitação"}
        </Button>
      </form>
    </Card>
  );
}
