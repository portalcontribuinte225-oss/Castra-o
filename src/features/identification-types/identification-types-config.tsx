import { useState } from "react";
import type { FormEvent } from "react";
import {
  ConfigActiveToggle,
  ConfigSectionHeader,
  ConfigStatusFilter,
  EmptyState,
  Field,
  ModalHeader,
} from "../../components/ui";
import { filterByMunicipalityScope, getItemMunicipalityId } from "../../domain";
import type { AnyRecord } from "../../types";
import { summarizeVisibleSteps } from "../request-steps/request-steps";
import type { StepToggles } from "../request-steps/request-steps";
import { hasDuplicateIdentificationTypeName } from "./identification-types";

interface IdentificationTypesConfigProps {
  items: AnyRecord[];
  setItems: (updater: (current: AnyRecord[]) => AnyRecord[]) => void;
  municipalityScopeId: string;
}

type IdentificationTypeForm = Required<StepToggles> & { name: string; active: boolean };

const emptyForm: IdentificationTypeForm = {
  name: "",
  active: true,
  stepTutor: true,
  stepAgenda: true,
  stepDocuments: true,
};

const stepToggleOptions: Array<{ key: keyof StepToggles; label: string }> = [
  { key: "stepTutor", label: "Dados do tutor" },
  { key: "stepAgenda", label: "Agenda" },
  { key: "stepDocuments", label: "Documentos e termo" },
];

function isSameItem(left: AnyRecord, right: AnyRecord) {
  return left.id === right.id && getItemMunicipalityId(left) === getItemMunicipalityId(right);
}

function matchesStatusFilter(item: AnyRecord, filter: string) {
  if (filter === "all") return true;
  return filter === "active" ? item.active !== false : item.active === false;
}

export function IdentificationTypesConfig({ items, setItems, municipalityScopeId }: IdentificationTypesConfigProps) {
  const [statusFilter, setStatusFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<IdentificationTypeForm>(emptyForm);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const trimmedName = form.name.trim();
  const formMunicipalityId = editingItem ? getItemMunicipalityId(editingItem) : municipalityScopeId;
  const nameError = !trimmedName
    ? "Informe o nome do tipo."
    : hasDuplicateIdentificationTypeName(filterByMunicipalityScope(items, formMunicipalityId), trimmedName, editingItem?.id)
      ? "Já existe um tipo com este nome."
      : "";
  const visibleItems = items.filter((item) => matchesStatusFilter(item, statusFilter));

  function openModal(item: AnyRecord | null = null) {
    setEditingItem(item);
    setForm(
      item
        ? {
            name: item.name || "",
            active: item.active !== false,
            stepTutor: item.stepTutor !== false,
            stepAgenda: item.stepAgenda !== false,
            stepDocuments: item.stepDocuments !== false,
          }
        : emptyForm,
    );
    setSubmitAttempted(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
    setSubmitAttempted(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (nameError) {
      setSubmitAttempted(true);
      return;
    }
    const values = {
      name: trimmedName,
      active: form.active,
      stepTutor: form.stepTutor,
      stepAgenda: form.stepAgenda,
      stepDocuments: form.stepDocuments,
    };
    if (editingItem) {
      setItems((current) => current.map((item) => (isSameItem(item, editingItem) ? { ...item, ...values } : item)));
    } else {
      setItems((current) => [...current, { id: `identification_${Date.now()}`, municipalityId: municipalityScopeId, ...values }]);
    }
    closeModal();
  }

  return (
    <>
      <div className="config-panel wide">
        <ConfigSectionHeader title="Tipos de identificação" createLabel="Criar tipo" onCreate={() => openModal()}>
          <ConfigStatusFilter
            value={statusFilter}
            onChange={setStatusFilter}
            activeCount={items.filter((item) => item.active !== false).length}
            inactiveCount={items.filter((item) => item.active === false).length}
          />
        </ConfigSectionHeader>
        <div className="config-editor-grid">
          {visibleItems.length === 0 && (
            <EmptyState
              title="Nenhum tipo configurado"
              text="Crie os tipos de identificação que o tutor poderá escolher. Cada tipo define quais etapas aparecem no cadastro."
            />
          )}
          {visibleItems.map((item, index) => (
            <article
              className="config-list-row"
              key={`${getItemMunicipalityId(item)}:${item.id}`}
              onClick={() => openModal(item)}
              role="button"
              tabIndex={0}
            >
              <span className="config-list-index">{index + 1}</span>
              <div className="config-list-main">
                <strong>{item.name}</strong>
                <span>Etapas: {summarizeVisibleSteps([item])}</span>
              </div>
              <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
                {item.active === false ? "Inativo" : "Ativo"}
              </small>
            </article>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <form className="config-modal compact config-environment-modal" onSubmit={handleSubmit}>
            <ModalHeader
              title={editingItem ? "Editar tipo de identificação" : "Criar tipo de identificação"}
              onClose={closeModal}
            />
            <div className="config-modal-options">
              <ConfigActiveToggle checked={form.active} onChange={(checked) => setForm((current) => ({ ...current, active: checked }))} />
            </div>
            <div className="request-type-steps-section">
              <span className="request-type-steps-label">Etapas do cadastro</span>
              <div className="request-type-steps-toggles">
                {stepToggleOptions.map((option) => (
                  <label className="toggle-switch config-active-toggle request-type-step-toggle" key={option.key}>
                    <input
                      type="checkbox"
                      checked={form[option.key]}
                      onChange={(event) => setForm((current) => ({ ...current, [option.key]: event.target.checked }))}
                    />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="request-type-step-toggle-text">
                      <span>{option.label}</span>
                      <small>Esta etapa só aparece se o tipo de solicitação também permitir.</small>
                    </span>
                  </label>
                ))}
              </div>
              <span className="request-type-step-toggle-text">
                <small>Etapas desta solicitação: {summarizeVisibleSteps([form])}</small>
              </span>
            </div>
            <Field
              label="Nome"
              value={form.name}
              placeholder="Ex: Animal comunitário"
              invalid={submitAttempted && Boolean(nameError)}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            {submitAttempted && nameError && <small className="field-error-message">{nameError}</small>}
            <div className="form-actions">
              <button className="primary-action" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
