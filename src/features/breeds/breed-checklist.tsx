import { ScrollChecklist } from "../../components/scroll-checklist";
import { filterByMunicipalityScope } from "../../domain";
import type { AnyRecord } from "../../types";
import { groupBreedsBySpecies } from "./breeds";

interface BreedChecklistProps {
  breeds: AnyRecord[];
  species: AnyRecord[];
  municipalityId: string;
  selectedIds: string[];
  onChange: (breedIds: string[]) => void;
}

// The breeds a request type links, grouped by species, in a list with its own scroll and a search field.
export function BreedChecklist({ breeds, species, municipalityId, selectedIds, onChange }: BreedChecklistProps) {
  const groups = groupBreedsBySpecies(
    filterByMunicipalityScope(breeds, municipalityId),
    filterByMunicipalityScope(species, municipalityId),
  ).map((group) => ({
    id: group.species.id,
    label: group.species.name,
    items: group.breeds.map((breed) => ({ id: breed.id, label: breed.name })),
  }));
  return (
    <ScrollChecklist
      legend="Raças vinculadas"
      groups={groups}
      selectedIds={selectedIds}
      onChange={onChange}
      emptyText="Nenhuma raça cadastrada. Cadastre em Configurar Ambiente > Raças."
    />
  );
}
