import { X } from "lucide-react";
import type { ActiveFilterPill, RequestFilterDimension } from "./request-filters";
import "./request-filters.css";

interface ActiveFiltersBarProps {
  pills: ActiveFilterPill[];
  onClearDimension: (dimension: RequestFilterDimension) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ pills, onClearDimension, onClearAll }: ActiveFiltersBarProps) {
  if (pills.length === 0) return null;
  return (
    <div className="request-filters-bar" role="group" aria-label="Filtros ativos">
      {pills.map((pill) => (
        <button
          key={pill.dimension}
          type="button"
          className="request-filter-pill"
          aria-label={`Remover filtro ${pill.label}`}
          onClick={() => onClearDimension(pill.dimension)}
        >
          <span>{pill.label}</span>
          <X size={12} />
        </button>
      ))}
      <button type="button" className="request-filters-clear" onClick={onClearAll}>
        Limpar filtros
      </button>
    </div>
  );
}
