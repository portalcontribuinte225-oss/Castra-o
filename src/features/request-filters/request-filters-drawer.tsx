import type { ReactNode } from "react";
import { FilterGroup, FiltersDrawer } from "./filters-drawer";
import { RequestFilterDimension, isRequestFiltersEmpty, requestFilterDimensionLabels } from "./request-filters";
import type { RequestFacetCounts, RequestFilterOption, RequestListFilters } from "./request-filters";
import { requestStageOptions } from "./request-stage";
import type { RequestStage } from "./request-stage";

interface RequestFiltersDrawerProps {
  sectionLabel?: string;
  additionalFilters?: ReactNode;
  hasAdditionalFilters?: boolean;
  filters: RequestListFilters;
  counts: RequestFacetCounts;
  typeOptions: RequestFilterOption[];
  assigneeOptions: RequestFilterOption[];
  onToggleStage: (stage: RequestStage) => void;
  onToggleType: (value: string) => void;
  onToggleAssignee: (value: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
}

export function RequestFiltersDrawer({
  sectionLabel = "Solicitações",
  additionalFilters,
  hasAdditionalFilters = false,
  filters,
  counts,
  typeOptions,
  assigneeOptions,
  onToggleStage,
  onToggleType,
  onToggleAssignee,
  onClearAll,
  onClose,
  onApply,
  applyDisabled = false,
}: RequestFiltersDrawerProps) {
  return (
    <FiltersDrawer
      sectionLabel={sectionLabel}
      clearDisabled={isRequestFiltersEmpty(filters) && !hasAdditionalFilters}
      applyDisabled={applyDisabled}
      onClear={onClearAll}
      onApply={onApply}
      onClose={onClose}
    >
      {additionalFilters}
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
    </FiltersDrawer>
  );
}
