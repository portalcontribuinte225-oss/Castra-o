import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { SidePanel } from "../../components/side-panel";
import { normalizeText } from "../../utils";

const SEARCH_MIN_OPTIONS = 7;

interface FilterGroupProps<T extends string> {
  title: string;
  options: { value: T; label: string }[];
  selected: T[];
  counts: Partial<Record<T, number>>;
  onToggle: (value: T) => void;
  searchPlaceholder?: string;
}

export function FilterGroup<T extends string>({
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

interface FiltersDrawerProps {
  sectionLabel: string;
  clearDisabled: boolean;
  applyDisabled?: boolean;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
  children: ReactNode;
}

// The panel edits a draft: "Ativar" applies it and closes the panel, closing without it discards the draft.
export function FiltersDrawer({
  sectionLabel,
  clearDisabled,
  applyDisabled = false,
  onClear,
  onApply,
  onClose,
  children,
}: FiltersDrawerProps) {
  return (
    <SidePanel
      label={sectionLabel}
      title="Filtros"
      closeLabel="Fechar filtros"
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" disabled={clearDisabled} onClick={onClear}>
            Limpar
          </Button>
          <Button
            variant="custom"
            className="tw:flex-1 tw:border-transparent tw:bg-[#0f766e] tw:font-semibold tw:text-white tw:enabled:hover:bg-[#115e59]"
            onClick={onApply}
            disabled={applyDisabled}
          >
            Ativar
          </Button>
        </>
      )}
    >
      {children}
    </SidePanel>
  );
}
