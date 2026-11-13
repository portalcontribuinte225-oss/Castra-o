import { useState } from "react";
import type { FormEvent } from "react";
import { ConfigSectionHeader, ConfigStatusFilter, EmptyState } from "../../components/ui";
import { filterByMunicipalityScope, getItemMunicipalityId } from "../../domain";
import type { AnyRecord } from "../../types";
import { BreedFormModal } from "./breed-form-modal";
import type { BreedFormErrors, BreedFormValues } from "./breed-form-modal";
import { getDuplicateBreedNames, parseBreedNames } from "./breeds";

interface BreedsConfigProps {
  items: AnyRecord[];
  setItems: (updater: (current: AnyRecord[]) => AnyRecord[]) => void;
  municipalityScopeId: string;
  speciesOptions: AnyRecord[];
  requestTypes: AnyRecord[];
}

const noErrors: BreedFormErrors = { names: "", speciesId: "", requestTypeIds: "" };

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

export function BreedsConfig({ items, setItems, municipalityScopeId, speciesOptions, requestTypes }: BreedsConfigProps) {
  const [statusFilter, setStatusFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<BreedFormValues>({ names: "", speciesId: "", requestTypeIds: [], active: true });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isEditing = editingItem !== null;
  const formMunicipalityId = editingItem ? getItemMunicipalityId(editingItem) : municipalityScopeId;
  const formSpecies = filterByMunicipalityScope(speciesOptions, formMunicipalityId).filter((item) => item.active !== false && item.name);
  const formRequestTypes = filterByMunicipalityScope(requestTypes, formMunicipalityId).filter((item) => item.active !== false && item.name);

  const parsedNames = isEditing ? [form.names.trim()].filter(Boolean) : parseBreedNames(form.names);
  const duplicateNames = getDuplicateBreedNames(filterByMunicipalityScope(items, formMunicipalityId), parsedNames, form.speciesId, editingItem?.id);
  const errors: BreedFormErrors = {
    names: parsedNames.length === 0
      ? (isEditing ? "Informe o nome da raça." : "Informe ao menos uma raça.")
      : duplicateNames.length > 0 ? `Já cadastrada(s) para esta espécie: ${duplicateNames.join(", ")}.` : "",
    speciesId: form.speciesId ? "" : "Selecione a espécie.",
    requestTypeIds: form.requestTypeIds.length > 0 ? "" : "Selecione ao menos um tipo de solicitação.",
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
    const municipalityId = item ? getItemMunicipalityId(item) : municipalityScopeId;
    setEditingItem(item);
    setForm(
      item
        ? {
            names: item.name || "",
            speciesId: item.speciesId || "",
            requestTypeIds: Array.isArray(item.requestTypeIds) ? item.requestTypeIds : [],
            active: item.active !== false,
          }
        : {
            names: "",
            speciesId: "",
            requestTypeIds: filterByMunicipalityScope(requestTypes, municipalityId)
              .filter((type) => type.active !== false && type.name)
              .map((type) => type.id),
            active: true,
          },
    );
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
    if (editingItem) {
      const values = { name: parsedNames[0], speciesId: form.speciesId, requestTypeIds: form.requestTypeIds, active: form.active };
      setItems((current) => current.map((item) => (isSameItem(item, editingItem) ? { ...item, ...values } : item)));
    } else {
      const createdAt = Date.now();
      const created = parsedNames.map((name, index) => ({
        id: `breed_${createdAt}_${index}`,
        name,
        speciesId: form.speciesId,
        requestTypeIds: [...form.requestTypeIds],
        active: form.active,
        municipalityId: municipalityScopeId,
      }));
      setItems((current) => [...current, ...created]);
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
              text="Cadastre as raças que o tutor poderá escolher. Cada raça é ligada a uma espécie e a um ou mais tipos de solicitação. Sem raças para o tipo e a espécie escolhidos, o formulário mantém o campo de texto."
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
                <span>{speciesName || "Espécie não encontrada"} · {Array.isArray(item.requestTypeIds) ? item.requestTypeIds.length : 0} tipo(s) de solicitação</span>
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
          isEditing={isEditing}
          form={form}
          errors={submitAttempted ? errors : noErrors}
          species={formSpecies}
          requestTypes={formRequestTypes}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </>
  );
}
