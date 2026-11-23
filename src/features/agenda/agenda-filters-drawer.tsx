import { useMemo } from "react";
import type { AnyRecord } from "../../types";
import { FilterGroup, FiltersDrawer } from "../request-filters/filters-drawer";
import type { RequestFilterOption } from "../request-filters/request-filters";
import {
  AgendaFilterDimension,
  agendaFilterDimensionLabels,
  agendaStatusOptions,
  buildAgendaFacetCounts,
  isAgendaFiltersEmpty,
} from "./agenda-filters";
import type { AgendaFilters } from "./agenda-filters";

interface AgendaFiltersDrawerProps {
  requests: AnyRecord[];
  filters: AgendaFilters;
  typeOptions: RequestFilterOption[];
  onToggle: (dimension: AgendaFilterDimension, value: string) => void;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function AgendaFiltersDrawer({ requests, filters, typeOptions, onToggle, onClear, onApply, onClose }: AgendaFiltersDrawerProps) {
  const counts = useMemo(() => buildAgendaFacetCounts(requests, filters), [requests, filters]);
  return (
    <FiltersDrawer sectionLabel="Agenda" clearDisabled={isAgendaFiltersEmpty(filters)} onClear={onClear} onApply={onApply} onClose={onClose}>
      <FilterGroup
        title={agendaFilterDimensionLabels[AgendaFilterDimension.TYPES]}
        options={typeOptions}
        selected={filters.types}
        counts={counts.types}
        onToggle={(value) => onToggle(AgendaFilterDimension.TYPES, value)}
      />
      <FilterGroup
        title={agendaFilterDimensionLabels[AgendaFilterDimension.STATUSES]}
        options={agendaStatusOptions}
        selected={filters.statuses}
        counts={counts.statuses}
        onToggle={(value) => onToggle(AgendaFilterDimension.STATUSES, value)}
      />
    </FiltersDrawer>
  );
}
