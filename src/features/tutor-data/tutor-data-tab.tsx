import { useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { ConfigField, configFieldStyle } from "../../components/ui";
import { formatCep, formatCpf, formatPhone } from "../../utils";
import { neighborhoodChoices } from "../neighborhoods/neighborhoods";
import { hasTutorChanges, tutorFormIssues } from "./tutor-data";
import type { TutorData } from "./tutor-data";
import { useTutorData } from "./use-tutor-data";

interface TutorDataTabProps {
  requestId: string;
  municipalityId: string;
  // The neighborhoods the municipality registered; with none the neighborhood is typed.
  neighborhoodNames: string[];
  readOnly: boolean;
  onSaved?: (tutor: TutorData) => void;
  // Where the save button goes: the fixed footer of the process.
  actionsSlot: HTMLElement | null;
}

// The "Dados do tutor" tab of the attendance: the staff corrects the tutor's data and may set a new password for the account.
export function TutorDataTab({ requestId, municipalityId, neighborhoodNames, readOnly, onSaved, actionsSlot }: TutorDataTabProps) {
  const formId = useId();
  const { tutor, form, loading, error, saving, saveError, notice, change, save, retry } = useTutorData(requestId, municipalityId, onSaved);
  if (loading && !tutor) return <p className="prm-muted-note" role="status">Carregando os dados do tutor...</p>;
  if (error) return <div className="prm-section"><p className="form-error" role="alert">{error}</p><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>;
  if (!tutor || !form) return <p className="prm-muted-note">Esta solicitação não tem um tutor com acesso cadastrado.</p>;
  const contactOnly = tutor.contactOnly === true;
  const issues = tutorFormIssues(form, contactOnly);
  const invalid = Object.keys(issues).length > 0;
  const locked = readOnly || saving;
  return (
    <form id={formId} className="prm-section prm-tutor-data" onSubmit={(event) => { event.preventDefault(); if (!invalid && !readOnly) void save(); }}>
      {contactOnly && <p className="prm-section-block prm-muted-note">O tutor ainda não se identificou nesta solicitação.</p>}
      <div className="prm-section-block">
        <p className="prm-section-title">Tutor</p>
        <div className="two-column-fields">
          <ConfigField label="Nome" value={form.name} maxLength={160} invalid={Boolean(issues.name)} readOnly={locked} onChange={(value) => change({ name: value })} />
          <ConfigField label="CPF" value={form.cpf} inputMode="numeric" invalid={Boolean(issues.cpf)} readOnly={locked || !contactOnly} onChange={(value) => change({ cpf: formatCpf(value) })} />
        </div>
        {(issues.name || issues.cpf) && <small className="field-error-message">{issues.name || issues.cpf}</small>}
        <div className="two-column-fields">
          <ConfigField label="E-mail" type="email" value={form.email} invalid={Boolean(issues.email)} readOnly={locked} onChange={(value) => change({ email: value })} />
          <ConfigField label="Telefone" value={form.phone} invalid={Boolean(issues.phone)} readOnly={locked} onChange={(value) => change({ phone: formatPhone(value) })} />
        </div>
        {(issues.email || issues.phone) && <small className="field-error-message">{issues.email || issues.phone}</small>}
      </div>
      <div className="prm-section-block">
        <p className="prm-section-title">Endereço</p>
        <div className="two-column-fields">
          <ConfigField label="CEP" value={form.cep} invalid={Boolean(issues.cep)} readOnly={locked} onChange={(value) => change({ cep: formatCep(value) })} />
          <ConfigField label="UF" value={form.state} maxLength={2} invalid={Boolean(issues.state)} readOnly={locked} onChange={(value) => change({ state: value.toUpperCase() })} />
        </div>
        {(issues.cep || issues.state) && <small className="field-error-message">{issues.cep || issues.state}</small>}
        <ConfigField label="Endereço" value={form.address} maxLength={200} readOnly={locked} onChange={(value) => change({ address: value })} />
        <div className="two-column-fields">
          {neighborhoodNames.length > 0 && !readOnly ? (
            <label className="field">
              <span>Bairro</span>
              <select value={form.neighborhood} disabled={saving} onChange={(event) => change({ neighborhood: event.target.value })}>
                <option value="">Selecione o bairro</option>
                {neighborhoodChoices(neighborhoodNames, form.neighborhood).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          ) : (
            <ConfigField label="Bairro" value={form.neighborhood} maxLength={120} readOnly={locked} onChange={(value) => change({ neighborhood: value })} />
          )}
          <ConfigField label="Cidade" value={form.city} maxLength={120} readOnly={locked} onChange={(value) => change({ city: value })} />
        </div>
      </div>
      {!readOnly && !contactOnly && !tutor.hasAccess && <p className="prm-muted-note">Este tutor ainda não tem acesso ao sistema.</p>}
      {!readOnly && tutor.hasAccess && (
        <div className="prm-section-block">
          <p className="prm-section-title">Acesso</p>
          <label className={configFieldStyle}>
            <span>Nova senha</span>
            <Input type="password" autoComplete="new-password" value={form.password} disabled={saving} aria-invalid={issues.password ? true : undefined} aria-describedby={`${formId}-password-hint`} placeholder="Deixe em branco para manter a senha atual" onChange={(event) => change({ password: event.target.value })} />
            <small id={`${formId}-password-hint`}>O tutor passa a entrar com esta senha, sem precisar trocá-la.</small>
          </label>
          {issues.password && <small className="field-error-message">{issues.password}</small>}
        </div>
      )}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      {notice && <p className="prm-muted-note" role="status">{notice}</p>}
      {!readOnly && actionsSlot && createPortal(
        <Button type="submit" form={formId} disabled={saving || invalid || !hasTutorChanges(tutor, form)}>{saving ? "Salvando..." : "Salvar dados do tutor"}</Button>,
        actionsSlot,
      )}
    </form>
  );
}
