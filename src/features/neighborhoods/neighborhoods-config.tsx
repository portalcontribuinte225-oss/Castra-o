import { useState } from "react";
import type { FormEvent } from "react";
import { Card } from "../../components/card";
import { ConfigRow, ConfigSectionHeader, ConfigStatusFilter, EmptyState } from "../../components/ui";
import { getItemMunicipalityId } from "../../domain";
import type { AnyRecord } from "../../types";
import { NeighborhoodFormModal } from "./neighborhood-form-modal";
import type { NeighborhoodFormValues } from "./neighborhood-form-modal";
import { MAX_NEIGHBORHOOD_LENGTH, hasDuplicateNeighborhoodName, newNeighborhoods, parseNeighborhoodLines } from "./neighborhoods";

interface NeighborhoodsConfigProps {
  items: AnyRecord[];
  onSave: (municipalityId: string, update: (current: AnyRecord[]) => AnyRecord[]) => Promise<void>;
  municipalityScopeId: string;
}

const emptyForm: NeighborhoodFormValues = { name: "", names: "", active: true };

function matchesStatusFilter(item: AnyRecord, filter: string) {
  if (filter === "all") return true;
  return filter === "active" ? item.active !== false : item.active === false;
}

export function NeighborhoodsConfig({ items, onSave, municipalityScopeId }: NeighborhoodsConfigProps) {
  const [statusFilter, setStatusFilter] = useState("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<NeighborhoodFormValues>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const municipalityId = editingItem ? getItemMunicipalityId(editingItem) || municipalityScopeId : municipalityScopeId;
    if (!municipalityId) return setError("Selecione um município no filtro superior para salvar os bairros.");
    const name = form.name.trim();
    const names = parseNeighborhoodLines(form.names);
    if (editingItem) {
      if (!name) return setError("Informe o nome do bairro.");
      if (name.length > MAX_NEIGHBORHOOD_LENGTH) return setError(`O nome deve ter até ${MAX_NEIGHBORHOOD_LENGTH} caracteres.`);
    } else {
      if (!names.length) return setError("Informe ao menos um bairro.");
      if (names.some((value) => value.length > MAX_NEIGHBORHOOD_LENGTH)) return setError(`Cada nome deve ter até ${MAX_NEIGHBORHOOD_LENGTH} caracteres.`);
    }
    setSaving(true);
    setError("");
    try {
      await onSave(municipalityId, (current) => {
        if (editingItem) {
          if (!current.some((item) => item.id === editingItem.id)) throw new Error("Este bairro não está mais disponível.");
          if (hasDuplicateNeighborhoodName(current, name, editingItem.id)) throw new Error("Já existe um bairro com este nome.");
          return current.map((item) => item.id === editingItem.id ? { ...item, name, active: form.active } : item);
        }
        const created = newNeighborhoods(current, names, municipalityId);
        if (!created.length) throw new Error("Todos os bairros informados já estão cadastrados.");
        return [...current, ...created];
      });
      closeModal();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar os bairros.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="config-panel wide">
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
            <ConfigRow key={`${getItemMunicipalityId(item)}:${item.id}`} onClick={() => openModal(item)}>
              <span className="config-list-index">{index + 1}</span>
              <span className="config-list-main">
                <strong>{item.name}</strong>
              </span>
              <small className={item.active === false ? "schedule-status inactive" : "schedule-status active"}>
                {item.active === false ? "Inativo" : "Ativo"}
              </small>
            </ConfigRow>
          ))}
        </div>
      </Card>
      {modalOpen && (
        <NeighborhoodFormModal
          isEditing={editingItem !== null}
          form={form}
          error={error}
          saving={saving}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSubmit={handleSubmit}
          onClose={() => { if (!saving) closeModal(); }}
        />
      )}
    </>
  );
}
