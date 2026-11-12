import { X } from "lucide-react";
import { formatRequestCount, isRequestFiltersEmpty } from "./request-filters";
import type { ActiveFilterPill, RequestFilterDimension, RequestListFilters } from "./request-filters";
import "./request-filters.css";

interface ActiveFiltersBarProps {
  filters: RequestListFilters;
  resultCount: number;
  pills: ActiveFilterPill[];
  onClearDimension: (dimension: RequestFilterDimension) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ filters, resultCount, pills, onClearDimension, onClearAll }: ActiveFiltersBarProps) {
  return (
    <div className="request-filters-bar" role="group" aria-label="Resultado e filtros ativos">
      <span className="request-filters-count" aria-live="polite">{formatRequestCount(resultCount)}</span>
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
      {!isRequestFiltersEmpty(filters) && (
        <button type="button" className="request-filters-clear" onClick={onClearAll}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
