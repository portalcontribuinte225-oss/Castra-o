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
}

// The "Dados do tutor" tab of the attendance: the staff corrects the tutor's data and may set a new password for the account.
export function TutorDataTab({ requestId, municipalityId, neighborhoodNames, readOnly, onSaved }: TutorDataTabProps) {
  const { tutor, form, loading, error, saving, saveError, notice, change, save, retry } = useTutorData(requestId, municipalityId, onSaved);
  if (loading && !tutor) return <p className="prm-muted-note" role="status">Carregando os dados do tutor...</p>;
  if (error) return <div className="prm-section"><p className="form-error" role="alert">{error}</p><button type="button" className="ghost-button" onClick={retry}>Tentar novamente</button></div>;
  if (!tutor || !form) return <p className="prm-muted-note">Esta solicitação não tem um tutor com acesso cadastrado.</p>;
  const issues = tutorFormIssues(form);
  const invalid = Object.keys(issues).length > 0;
  const locked = readOnly || saving;
  return (
    <form className="prm-section prm-tutor-data" onSubmit={(event) => { event.preventDefault(); if (!invalid && !readOnly) void save(); }}>
      <div className="prm-section-block">
        <p className="prm-section-title">Tutor</p>
        <div className="two-column-fields">
          <label className={`field${issues.name ? " invalid" : ""}`}><span>Nome</span><input value={form.name} maxLength={160} readOnly={locked} onChange={(event) => change({ name: event.target.value })} /></label>
          <label className="field"><span>CPF</span><input value={formatCpf(tutor.cpf)} readOnly aria-readonly="true" /></label>
        </div>
        <div className="two-column-fields">
          <label className={`field${issues.email ? " invalid" : ""}`}><span>E-mail</span><input type="email" value={form.email} readOnly={locked} onChange={(event) => change({ email: event.target.value })} /></label>
          <label className={`field${issues.phone ? " invalid" : ""}`}><span>Telefone</span><input value={form.phone} readOnly={locked} onChange={(event) => change({ phone: formatPhone(event.target.value) })} /></label>
        </div>
        {(issues.email || issues.phone) && <small className="field-error-message">{issues.email || issues.phone}</small>}
      </div>
      <div className="prm-section-block">
        <p className="prm-section-title">Endereço</p>
        <div className="two-column-fields">
          <label className={`field${issues.cep ? " invalid" : ""}`}><span>CEP</span><input value={form.cep} readOnly={locked} onChange={(event) => change({ cep: formatCep(event.target.value) })} /></label>
          <label className={`field${issues.state ? " invalid" : ""}`}><span>UF</span><input value={form.state} maxLength={2} readOnly={locked} onChange={(event) => change({ state: event.target.value.toUpperCase() })} /></label>
        </div>
        {(issues.cep || issues.state) && <small className="field-error-message">{issues.cep || issues.state}</small>}
        <label className="field"><span>Endereço</span><input value={form.address} maxLength={200} readOnly={locked} onChange={(event) => change({ address: event.target.value })} /></label>
        <div className="two-column-fields">
          <label className="field">
            <span>Bairro</span>
            {neighborhoodNames.length > 0 && !readOnly ? (
              <select value={form.neighborhood} disabled={saving} onChange={(event) => change({ neighborhood: event.target.value })}>
                <option value="">Selecione o bairro</option>
                {neighborhoodChoices(neighborhoodNames, form.neighborhood).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            ) : (
              <input value={form.neighborhood} maxLength={120} readOnly={locked} onChange={(event) => change({ neighborhood: event.target.value })} />
            )}
          </label>
          <label className="field"><span>Cidade</span><input value={form.city} maxLength={120} readOnly={locked} onChange={(event) => change({ city: event.target.value })} /></label>
        </div>
      </div>
      {!readOnly && !tutor.hasAccess && <p className="prm-muted-note">Este tutor ainda não tem acesso ao sistema: as alterações valem para esta solicitação e não há senha para definir.</p>}
      {!readOnly && tutor.hasAccess && (
        <div className="prm-section-block">
          <p className="prm-section-title">Acesso</p>
          <label className={`field${issues.password ? " invalid" : ""}`}>
            <span>Nova senha</span>
            <input type="password" autoComplete="new-password" value={form.password} disabled={saving} placeholder="Deixe em branco para manter a senha atual" onChange={(event) => change({ password: event.target.value })} />
            <small>O tutor passa a entrar com esta senha, sem precisar trocá-la.</small>
          </label>
          {issues.password && <small className="field-error-message">{issues.password}</small>}
        </div>
      )}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      {notice && <p className="prm-muted-note" role="status">{notice}</p>}
      {!readOnly && (
        <div className="prm-inline-actions">
          <button type="submit" className="primary-action" disabled={saving || invalid || !hasTutorChanges(tutor, form)}>{saving ? "Salvando..." : "Salvar dados do tutor"}</button>
        </div>
      )}
    </form>
  );
}
