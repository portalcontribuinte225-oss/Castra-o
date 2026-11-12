import { CalendarDays, SlidersHorizontal } from "lucide-react";
import type { RequestFacetCounts, RequestListFilters } from "./request-filters";
import { isSameStageSet, requestStageChips } from "./request-stage";
import type { RequestStage } from "./request-stage";

interface RequestFiltersToolbarProps {
  filters: RequestListFilters;
  counts: RequestFacetCounts;
  activePillCount: number;
  drawerOpen: boolean;
  onSelectChip: (stages: RequestStage[]) => void;
  onToggleToday: () => void;
  onOpenDrawer: () => void;
}

export function RequestFiltersToolbar({
  filters,
  counts,
  activePillCount,
  drawerOpen,
  onSelectChip,
  onToggleToday,
  onOpenDrawer,
}: RequestFiltersToolbarProps) {
  return (
    <nav className="request-nav" aria-label="Filtros de solicitações">
      <div className="request-filter-tabs">
        {requestStageChips.map((chip) => {
          const selected = !filters.todayOnly && isSameStageSet(chip.stages, filters.stages);
          return (
            <button
              key={chip.id}
              type="button"
              className={selected ? "selected" : ""}
              aria-pressed={selected}
              onClick={() => onSelectChip(chip.stages)}
            >
              {chip.label}
              <span>{counts.chips[chip.id]}</span>
            </button>
          );
        })}
      </div>
      <div className="request-today-segment">
        <button
          type="button"
          className={filters.todayOnly ? "selected" : ""}
          aria-pressed={filters.todayOnly}
          onClick={onToggleToday}
        >
          <CalendarDays size={14} />
          Hoje
          <span>{counts.today}</span>
        </button>
        <button
          type="button"
          className={activePillCount > 0 ? "selected" : ""}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activePillCount > 0 && <span>{activePillCount}</span>}
        </button>
      </div>
    </nav>
  );
}
