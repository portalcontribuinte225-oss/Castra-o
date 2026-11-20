import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "../../components/button";
import { CloseButton } from "../../components/close-button";
import { Input } from "../../components/input";
import { useModalFocus } from "../../components/modal-focus";
import { normalizeText } from "../../utils";
import {
  RequestFilterDimension,
  formatRequestCount,
  isRequestFiltersEmpty,
  requestFilterDimensionLabels,
} from "./request-filters";
import type { RequestFacetCounts, RequestFilterOption, RequestListFilters } from "./request-filters";
import { requestStageOptions } from "./request-stage";
import type { RequestStage } from "./request-stage";

const SEARCH_MIN_OPTIONS = 7;

interface FilterGroupProps<T extends string> {
  title: string;
  options: { value: T; label: string }[];
  selected: T[];
  counts: Partial<Record<T, number>>;
  onToggle: (value: T) => void;
  searchPlaceholder?: string;
}

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  counts,
  onToggle,
  searchPlaceholder,
}: FilterGroupProps<T>) {
  const [query, setQuery] = useState("");
  const searchable = searchPlaceholder !== undefined && options.length >= SEARCH_MIN_OPTIONS;
  const normalizedQuery = normalizeText(query);
  const visibleOptions = searchable && normalizedQuery
    ? options.filter((option) => normalizeText(option.label).includes(normalizedQuery))
    : options;

  return (
    <section className="tw:grid tw:gap-2" aria-label={title}>
      <h4 className="tw:m-0 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-ui-muted">{title}</h4>
      {searchable && (
        <div className="tw:relative">
          <Search size={14} aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:left-3 tw:top-1/2 tw:-translate-y-1/2 tw:text-ui-muted" />
          <Input
            type="text"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="tw:pl-9"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}
      <div className="tw:grid tw:max-h-[264px] tw:gap-0.5 tw:overflow-y-auto">
        {visibleOptions.length === 0 && <p className="tw:m-0 tw:px-2.5 tw:py-1.5 tw:text-sm tw:text-ui-muted" role="status">Nenhuma opção encontrada</p>}
        {visibleOptions.map((option) => {
          const checked = selected.includes(option.value);
          const count = counts[option.value] ?? 0;
          return (
            <label
              key={option.value}
              className={`tw:flex tw:min-h-9 tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:py-1.5 tw:text-sm tw:text-ui-text tw:hover:bg-card-page${count === 0 && !checked ? " tw:opacity-60" : ""}`}
            >
              <input type="checkbox" className="tw:size-4 tw:shrink-0 tw:accent-[#0f766e]" checked={checked} onChange={() => onToggle(option.value)} />
              <span className="tw:min-w-0 tw:flex-1 tw:wrap-anywhere">{option.label}</span>
              <small className="tw:text-xs tw:font-semibold tw:text-ui-muted tw:tabular-nums">{count}</small>
            </label>
          );
        })}
      </div>
    </section>
  );
}

interface RequestFiltersDrawerProps {
  filters: RequestListFilters;
  counts: RequestFacetCounts;
  typeOptions: RequestFilterOption[];
  assigneeOptions: RequestFilterOption[];
  resultCount: number;
  onToggleStage: (stage: RequestStage) => void;
  onToggleType: (value: string) => void;
  onToggleAssignee: (value: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function RequestFiltersDrawer({
  filters,
  counts,
  typeOptions,
  assigneeOptions,
  resultCount,
  onToggleStage,
  onToggleType,
  onToggleAssignee,
  onClearAll,
  onClose,
}: RequestFiltersDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useModalFocus(drawerRef);

  return (
    <div className="tw:contents" data-managed-dialog="" ref={drawerRef}>
      <div aria-hidden="true" className="tw:fixed tw:inset-0 tw:z-[210] tw:bg-slate-900/30 tw:backdrop-blur-[3px]" onClick={onClose} />
      <aside
        className="tw:fixed tw:inset-y-0 tw:right-0 tw:z-[211] tw:flex tw:w-full tw:max-w-[420px] tw:flex-col tw:border-l tw:border-solid tw:border-card-border tw:bg-card-surface tw:shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-filters-title"
      >
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:border-b tw:border-solid tw:border-card-border tw:px-5 tw:pb-4 tw:pt-5">
          <div className="tw:grid tw:gap-1">
            <span className="tw:text-xs tw:font-semibold tw:text-ui-muted">Solicitações</span>
            <h3 className="tw:m-0 tw:text-lg tw:font-semibold tw:text-ui-ink" id="request-filters-title">Filtros</h3>
          </div>
          <CloseButton aria-label="Fechar filtros" onClick={onClose} />
        </div>
        <div className="tw:grid tw:min-h-0 tw:flex-1 tw:content-start tw:gap-5 tw:overflow-y-auto tw:px-5 tw:pb-6 tw:pt-4">
          <FilterGroup
            title={requestFilterDimensionLabels[RequestFilterDimension.STAGES]}
            options={requestStageOptions}
            selected={filters.stages}
            counts={counts.stages}
            onToggle={onToggleStage}
          />
          <FilterGroup
            title={requestFilterDimensionLabels[RequestFilterDimension.TYPES]}
            options={typeOptions}
            selected={filters.types}
            counts={counts.types}
            onToggle={onToggleType}
          />
          <FilterGroup
            title={requestFilterDimensionLabels[RequestFilterDimension.ASSIGNEES]}
            options={assigneeOptions}
            selected={filters.assignees}
            counts={counts.assignees}
            onToggle={onToggleAssignee}
            searchPlaceholder="Buscar responsável..."
          />
        </div>
        <div className="tw:flex tw:shrink-0 tw:gap-2.5 tw:border-t tw:border-solid tw:border-card-border tw:px-5 tw:pb-[max(0.875rem,env(safe-area-inset-bottom))] tw:pt-3.5">
          <Button variant="outline" disabled={isRequestFiltersEmpty(filters)} onClick={onClearAll}>
            Limpar
          </Button>
          <Button
            variant="custom"
            className="tw:flex-1 tw:border-transparent tw:bg-[#0f766e] tw:font-semibold tw:text-white tw:enabled:hover:bg-[#115e59]"
            onClick={onClose}
          >
            Ver {formatRequestCount(resultCount)}
          </Button>
        </div>
      </aside>
    </div>
  );
}
