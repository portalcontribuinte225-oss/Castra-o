import { filterByMunicipalityScope } from "../../domain";
import type { AnyRecord } from "../../types";
import { groupBreedsBySpecies } from "./breeds";

interface BreedPickerProps {
  breeds: AnyRecord[];
  species: AnyRecord[];
  municipalityId: string;
  selectedIds: string[];
  onChange: (breedIds: string[]) => void;
}

// Multi-select of the registered breeds, grouped by species, used in the request type modal.
export function BreedPicker({ breeds, species, municipalityId, selectedIds, onChange }: BreedPickerProps) {
  const groups = groupBreedsBySpecies(
    filterByMunicipalityScope(breeds, municipalityId),
    filterByMunicipalityScope(species, municipalityId),
  );

  function toggle(breedId: string) {
    onChange(selectedIds.includes(breedId) ? selectedIds.filter((id) => id !== breedId) : [...selectedIds, breedId]);
  }

  if (groups.length === 0) {
    return (
      <div className="document-button-field">
        <span>Raças vinculadas</span>
        <div className="request-type-step-toggle-text">
          <small>Nenhuma raça cadastrada. Cadastre em Configurar Ambiente &gt; Raças.</small>
        </div>
      </div>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div className="document-button-field" key={group.species.id}>
          <span>Raças vinculadas · {group.species.name}</span>
          <div className="document-button-grid">
            {group.breeds.map((breed) => (
              <button
                className={selectedIds.includes(breed.id) ? "document-pill selected" : "document-pill"}
                key={breed.id}
                type="button"
                onClick={() => toggle(breed.id)}
              >
                {breed.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
