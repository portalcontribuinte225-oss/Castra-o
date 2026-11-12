import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
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
import "./request-filters.css";

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
    <section className="request-filters-group" aria-label={title}>
      <h4 className="request-filters-group-title">{title}</h4>
      {searchable && (
        <label className="request-filters-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}
      <div className="request-filters-list">
        {visibleOptions.length === 0 && <p className="request-filters-empty">Nenhuma opção encontrada</p>}
        {visibleOptions.map((option) => {
          const checked = selected.includes(option.value);
          const count = counts[option.value] ?? 0;
          return (
            <label
              key={option.value}
              className={`request-filters-option${count === 0 && !checked ? " is-empty" : ""}`}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(option.value)} />
              <span>{option.label}</span>
              <small>{count}</small>
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <>
      <div className="ag-drawer-overlay request-filters-overlay" onClick={onClose} />
      <aside className="ag-drawer request-filters-drawer" role="dialog" aria-modal="true" aria-labelledby="request-filters-title">
        <div className="ag-drawer-head">
          <div className="ag-drawer-head-info">
            <span className="ag-drawer-kicker">Solicitações</span>
            <h3 className="ag-drawer-date" id="request-filters-title">Filtros</h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="ag-drawer-close"
            aria-label="Fechar filtros"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>
        <div className="request-filters-body">
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
        <div className="request-filters-footer">
          <button
            type="button"
            className="request-filters-clear-all"
            disabled={isRequestFiltersEmpty(filters)}
            onClick={onClearAll}
          >
            Limpar
          </button>
          <button type="button" className="request-filters-apply" onClick={onClose}>
            Ver {formatRequestCount(resultCount)}
          </button>
        </div>
      </aside>
    </>
  );
}
