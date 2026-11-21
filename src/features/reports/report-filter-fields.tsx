import { ConfigField } from "../../components/ui";
import { NO_NEIGHBORHOOD_FILTER, NO_NEIGHBORHOOD_LABEL } from "../neighborhoods/neighborhood-report";
import { RequestSelectField } from "../request-steps/request-select-field";
import { hasInvalidReportPeriod, reportAgendaOptions, reportFeeOptions, type ReportFilters } from "./report-filters";

interface ReportFilterFieldsProps {
  filters: ReportFilters;
  tutorNeighborhoods: string[];
  animalNeighborhoods: string[];
  onChange: (field: keyof ReportFilters, value: string) => void;
}

function neighborhoodOptions(names: string[]) {
  return [
    { value: NO_NEIGHBORHOOD_FILTER, label: NO_NEIGHBORHOOD_LABEL },
    ...names.map((name) => ({ value: name, label: name })),
  ];
}

export function ReportFilterFields({ filters, tutorNeighborhoods, animalNeighborhoods, onChange }: ReportFilterFieldsProps) {
  const invalidPeriod = hasInvalidReportPeriod(filters);
  const selects = [
    { field: "fee", label: "Taxas", options: reportFeeOptions },
    { field: "agendaKind", label: "Agenda", options: reportAgendaOptions },
    { field: "tutorNeighborhood", label: "Bairro do tutor", options: neighborhoodOptions(tutorNeighborhoods) },
    { field: "animalNeighborhood", label: "Bairro do animal", options: neighborhoodOptions(animalNeighborhoods) },
  ] as const;

  return (
    <section className="tw:grid tw:min-w-0 tw:gap-2" aria-label="Filtros do relatório">
      <div className="tw:grid tw:grid-cols-2 tw:gap-2">
        <ConfigField label="Início" type="date" value={filters.start} max={filters.end || undefined} invalid={invalidPeriod} onChange={(value) => onChange("start", value)} />
        <ConfigField label="Fim" type="date" value={filters.end} min={filters.start || undefined} invalid={invalidPeriod} onChange={(value) => onChange("end", value)} />
      </div>
      {invalidPeriod && <p className="tw:m-0 tw:text-xs tw:text-ui-danger" role="alert">A data inicial precisa ser anterior ou igual à data final.</p>}
      {selects.map(({ field, label, options }) => (
        <RequestSelectField key={field} label={label} value={filters[field]} onChange={(event) => onChange(field, event.target.value)}>
          <option value="">Todos</option>
          {options.map(({ value, label: name }) => <option key={value} value={value}>{name}</option>)}
        </RequestSelectField>
      ))}
    </section>
  );
}
