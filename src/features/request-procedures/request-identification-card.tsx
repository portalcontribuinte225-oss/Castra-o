import React from "react";
import { CompactChoiceField } from "../../components/ui";
import type { AnyRecord } from "../../types";

interface RequestIdentificationCardProps {
  types: AnyRecord[];
  selectedId?: string;
  onChange: (id: string) => void;
}

// What is global to the request: whether the animal has a tutor, as the municipality's identification types describe it.
// With a single active type there is no choice to make, so nothing is shown.
export function RequestIdentificationCard({ types, selectedId, onChange }: RequestIdentificationCardProps) {
  if (types.length < 2) return null;
  return (
    <div className="form-sub-card">
      <span className="form-sub-card-title">Solicitação</span>
      <div className="animal-choice-grid species-row">
        <CompactChoiceField label="Tipo de identificação" value={selectedId} options={types.map((type) => ({ value: type.id, label: type.name }))} onChange={onChange} />
      </div>
    </div>
  );
}
