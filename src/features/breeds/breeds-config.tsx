import { useState } from "react";
import type { FormEvent } from "react";
import { ConfigSectionHeader, ConfigStatusFilter, EmptyState } from "../../components/ui";
import { filterByMunicipalityScope, getItemMunicipalityId } from "../../domain";
import type { AnyRecord } from "../../types";
import { BreedFormModal } from "./breed-form-modal";
import type { BreedFormErrors, BreedFormValues } from "./breed-form-modal";
import { hasDuplicateBreedName } from "./breeds";

interface BreedsConfigProps {
  items: AnyRecord[];
  setItems: (updater: (current: AnyRecord[]) => AnyRecord[]) => void;
  municipalityScopeId: string;
  speciesOptions: AnyRecord[];
}

const emptyForm: BreedFormValues = { name: "", speciesId: "", active: true };
const noErrors: BreedFormErrors = { name: "", speciesId: "" };

function isSameItem(left: AnyRecord, right: AnyRecord) {
  return left.id === right.id && getItemMunicipalityId(left) === getItemMunicipalityId(right);
}

function matchesStatusFilter(item: AnyRecord, filter: string) {
  if (filter === "all") return true;
  return filter === "active" ? item.active !== false : item.active === false;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", { sensitivity: "base" });
}

export function BreedsConfig({ items, setItems, municipalityScopeId, speciesOptions }: BreedsConfigProps) {
  const [statusFilter, setStatusFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<BreedFormValues>(emptyForm);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const formMunicipalityId = editingItem ? getItemMunicipalityId(editingItem) : municipalityScopeId;
  const formSpecies = filterByMunicipalityScope(speciesOptions, formMunicipalityId).filter((item) => item.active !== false && item.name);

  const trimmedName = form.name.trim();
  const errors: BreedFormErrors = {
    name: !trimmedName
      ? "Informe o nome da raça."
      : hasDuplicateBreedName(filterByMunicipalityScope(items, formMunicipalityId), trimmedName, form.speciesId, editingItem?.id)
        ? "Já existe uma raça com este nome para esta espécie."
        : "",
    speciesId: form.speciesId ? "" : "Selecione a espécie.",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function getSpeciesName(item: AnyRecord) {
    const municipalityId = getItemMunicipalityId(item);
    return speciesOptions.find((species) => species.id === item.speciesId && getItemMunicipalityId(species) === municipalityId)?.name || "";
  }

  const visibleItems = items
    .filter((item) => matchesStatusFilter(item, statusFilter))
    .map((item) => ({ item, speciesName: getSpeciesName(item) }))
    .sort((left, right) => compareText(left.speciesName, right.speciesName) || compareText(left.item.name || "", right.item.name || ""));

  function openModal(item: AnyRecord | null = null) {
    setEditingItem(item);
    setForm(item ? { name: item.name || "", speciesId: item.speciesId || "", active: item.active !== false } : emptyForm);
    setSubmitAttempted(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setSubmitAttempted(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasErrors) {
      setSubmitAttempted(true);
      return;
    }
    const values = { name: trimmedName, speciesId: form.speciesId, active: form.active };
    if (editingItem) {
      setItems((current) => current.map((item) => (isSameItem(item, editingItem) ? { ...item, ...values } : item)));
    } else {
      const created = { id: `breed_${Date.now()}`, ...values, municipalityId: municipalityScopeId };
      setItems((current) => [...current, created]);
    }
    closeModal();
  }

  return (
    <>
      <div className="config-panel wide">
        <ConfigSectionHeader title="Raças" createLabel="Criar raça" onCreate={() => openModal()}>
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
              title="Nenhuma raça cadastrada"
              text="Cadastre as raças que o tutor poderá escolher e depois vincule-as aos tipos de solicitação, em Tipo de Solicitação. Sem raças vinculadas ao tipo e à espécie escolhidos, o formulário mantém o campo de texto."
            />
          )}
          {visibleItems.map(({ item, speciesName }, index) => (
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
                <span>{speciesName || "Espécie não encontrada"}</span>
              </div>
              <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
                {item.active === false ? "Inativo" : "Ativo"}
              </small>
            </article>
          ))}
        </div>
      </div>

      {modalOpen && (
        <BreedFormModal
          isEditing={editingItem !== null}
          form={form}
          errors={submitAttempted ? errors : noErrors}
          species={formSpecies}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </>
  );
}
