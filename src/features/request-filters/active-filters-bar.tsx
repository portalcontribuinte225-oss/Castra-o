import { X } from "lucide-react";
import { Button } from "../../components/button";
import { formatRequestCount } from "./request-filters";
import type { ActiveFilterPill, RequestFilterDimension } from "./request-filters";

interface ActiveFiltersBarProps<Dimension extends string> {
  resultCount: number;
  pills: ActiveFilterPill<Dimension>[];
  canClear: boolean;
  onClearDimension: (dimension: Dimension) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar<Dimension extends string = RequestFilterDimension>({
  resultCount, pills, canClear, onClearDimension, onClearAll,
}: ActiveFiltersBarProps<Dimension>) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2" role="group" aria-label="Resultado e filtros ativos">
      <span className="tw:mr-1 tw:text-sm tw:font-semibold tw:text-ui-muted" aria-live="polite">{formatRequestCount(resultCount)}</span>
      {pills.map((pill) => (
        <Button
          key={pill.dimension}
          variant="outline"
          className="tw:min-w-0 tw:max-w-full tw:whitespace-normal tw:text-left"
          aria-label={`Remover filtro ${pill.label}`}
          onClick={() => onClearDimension(pill.dimension)}
        >
          <span className="tw:min-w-0 tw:wrap-anywhere">{pill.label}</span>
          <X size={12} aria-hidden="true" className="tw:shrink-0" />
        </Button>
      ))}
      {canClear && (
        <Button variant="outline" className="tw:text-ui-muted" onClick={onClearAll}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
