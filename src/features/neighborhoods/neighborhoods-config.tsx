import { useState } from "react";
import type { FormEvent } from "react";
import { ConfigSectionHeader, ConfigStatusFilter, EmptyState } from "../../components/ui";
import { filterByMunicipalityScope, getItemMunicipalityId } from "../../domain";
import type { AnyRecord } from "../../types";
import { NeighborhoodFormModal } from "./neighborhood-form-modal";
import type { NeighborhoodFormValues } from "./neighborhood-form-modal";
import { MAX_NEIGHBORHOOD_LENGTH, hasDuplicateNeighborhoodName, newNeighborhoods, parseNeighborhoodLines } from "./neighborhoods";

interface NeighborhoodsConfigProps {
  items: AnyRecord[];
  setItems: (updater: (current: AnyRecord[]) => AnyRecord[]) => void;
  municipalityScopeId: string;
}

const emptyForm: NeighborhoodFormValues = { name: "", names: "", active: true };

function matchesStatusFilter(item: AnyRecord, filter: string) {
  if (filter === "all") return true;
  return filter === "active" ? item.active !== false : item.active === false;
}

export function NeighborhoodsConfig({ items, setItems, municipalityScopeId }: NeighborhoodsConfigProps) {
  const [statusFilter, setStatusFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<NeighborhoodFormValues>(emptyForm);
  const [error, setError] = useState("");

  const visibleItems = items
    .filter((item) => matchesStatusFilter(item, statusFilter))
    .sort((left, right) => (left.name || "").localeCompare(right.name || "", "pt-BR", { sensitivity: "base" }));

  function openModal(item: AnyRecord | null = null) {
    setEditingItem(item);
    setForm(item ? { ...emptyForm, name: item.name || "", active: item.active !== false } : emptyForm);
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setError("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const scopeItems = filterByMunicipalityScope(items, editingItem ? getItemMunicipalityId(editingItem) : municipalityScopeId);
    if (editingItem) {
      const name = form.name.trim();
      if (!name) return setError("Informe o nome do bairro.");
      if (name.length > MAX_NEIGHBORHOOD_LENGTH) return setError(`O nome deve ter até ${MAX_NEIGHBORHOOD_LENGTH} caracteres.`);
      if (hasDuplicateNeighborhoodName(scopeItems, name, editingItem.id)) return setError("Já existe um bairro com este nome.");
      setItems((current) => current.map((item) => (item.id === editingItem.id && getItemMunicipalityId(item) === getItemMunicipalityId(editingItem) ? { ...item, name, active: form.active } : item)));
      return closeModal();
    }
    const names = parseNeighborhoodLines(form.names);
    if (!names.length) return setError("Informe ao menos um bairro.");
    if (names.some((name) => name.length > MAX_NEIGHBORHOOD_LENGTH)) return setError(`Cada nome deve ter até ${MAX_NEIGHBORHOOD_LENGTH} caracteres.`);
    const created = newNeighborhoods(scopeItems, names, municipalityScopeId);
    if (!created.length) return setError("Todos os bairros informados já estão cadastrados.");
    setItems((current) => [...current, ...created]);
    closeModal();
  }

  return (
    <>
      <div className="config-panel wide">
        <ConfigSectionHeader title="Bairros" createLabel="Criar bairros" onCreate={() => openModal()}>
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
              title="Nenhum bairro cadastrado"
              text="Cadastre os bairros do município. Eles aparecem como lista no endereço do tutor e no bairro de cada animal, e viram filtros nos relatórios. Enquanto não houver bairros, o campo aceita texto livre."
            />
          )}
          {visibleItems.map((item, index) => (
            <article className="config-list-row" key={`${getItemMunicipalityId(item)}:${item.id}`} onClick={() => openModal(item)} role="button" tabIndex={0}>
              <span className="config-list-index">{index + 1}</span>
              <div className="config-list-main">
                <strong>{item.name}</strong>
              </div>
              <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
                {item.active === false ? "Inativo" : "Ativo"}
              </small>
            </article>
          ))}
        </div>
      </div>
      {modalOpen && (
        <NeighborhoodFormModal isEditing={editingItem !== null} form={form} error={error} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} onSubmit={handleSubmit} onClose={closeModal} />
      )}
    </>
  );
}
