import React from "react";
import { CompactChoiceField, ToggleChoiceField, YesNoToggleField } from "../../components/ui";
import type { AnyRecord } from "../../types";
import { NeighborhoodField } from "../neighborhoods/neighborhood-field";

const SEX_OPTIONS = ["Macho", "Fêmea"];
const BREED_TYPE_OPTIONS = ["Indefinida", "Definida"];
const FOOD_OPTIONS = ["Ração", "Diversos"];

interface AnimalFieldsProps {
  animal: AnyRecord;
  speciesNames: string[];
  sizeChoices: AnyRecord[];
  breedOptions: AnyRecord[];
  // The neighborhoods the municipality registered; with none the neighborhood is typed.
  neighborhoodNames?: string[];
  submitAttempted: boolean;
  // Staff also record the microchip of the animal.
  internal?: boolean;
  onChange: (field: string, value: string) => void;
  onSelectSpecies: (value: string) => void;
}

// The data of one animal of the request, and its health: what is the same whoever asks and whatever is asked for it.
export function AnimalFields({ animal, speciesNames, sizeChoices, breedOptions, neighborhoodNames = [], submitAttempted, internal = false, onChange, onSelectSpecies }: AnimalFieldsProps) {
  return (
    <>
      <div className="form-sub-card">
        <span className="form-sub-card-title">Identificação do animal</span>
        <div className="animal-choice-grid three-col">
          <CompactChoiceField label="Espécie" value={animal.species} options={speciesNames} onChange={onSelectSpecies} invalid={submitAttempted && !animal.species} required />
          <CompactChoiceField label="Sexo" value={animal.sex} options={SEX_OPTIONS} onChange={(value) => onChange("sex", value)} invalid={submitAttempted && !animal.sex} required />
          <CompactChoiceField label="Raça" value={animal.breedType} options={BREED_TYPE_OPTIONS} onChange={(value) => onChange("breedType", value)} invalid={submitAttempted && !animal.breedType} required />
        </div>
        {animal.breedType === "Definida" && (breedOptions.length > 0 ? (
          <div className="access-field" data-label="Raça">
            <select aria-label="Raça" value={animal.breedDescription} onChange={(event) => onChange("breedDescription", event.target.value)}>
              <option value="">Selecione a raça</option>
              {breedOptions.map((breed) => (
                <option key={breed.id} value={breed.name}>{breed.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="access-field" data-label="Raça">
            <input type="text" placeholder="Descreva a raça (Ex: Poodle, Siamês)" value={animal.breedDescription} onChange={(event) => onChange("breedDescription", event.target.value)} />
          </div>
        ))}
        <CompactChoiceField label="Porte" value={animal.size} options={sizeChoices} onChange={(value) => onChange("size", value)} invalid={submitAttempted && !animal.size} required />
        <div className="animal-choice-grid name-coat-age-row">
          <div className="access-field" data-label="Nome">
            <input type="text" placeholder="Ex: Bidu" value={animal.name} onChange={(event) => onChange("name", event.target.value)} />
          </div>
          <div className="access-field" data-label="Pelagem">
            <input type="text" placeholder="Cor" value={animal.coat} onChange={(event) => onChange("coat", event.target.value)} />
          </div>
          <div className="access-field" data-label="Idade">
            <input type="text" placeholder="Ex: 2 anos" value={animal.age || ""} onChange={(event) => onChange("age", event.target.value)} />
          </div>
        </div>
        <NeighborhoodField label="Bairro do animal" placeholder="Bairro onde o animal vive" value={animal.neighborhood || ""} names={neighborhoodNames} required invalid={submitAttempted && !animal.neighborhood} onChange={(value) => onChange("neighborhood", value)} />
        {internal && (
          <div className="internal-microchip-row">
            <div className="access-field" data-label="Microchip">
              <input
                type="text"
                placeholder={animal.hasChip === "Sim" ? "Código do microchip" : "Microchip não informado"}
                value={animal.microchip}
                onChange={(event) => onChange("microchip", event.target.value)}
                readOnly={animal.hasChip !== "Sim"}
              />
            </div>
            <label className="doc-accept-check internal-chip-check">
              <input
                type="checkbox"
                checked={animal.hasChip === "Sim"}
                onChange={(event) => {
                  onChange("hasChip", event.target.checked ? "Sim" : "Nao");
                  if (!event.target.checked) onChange("microchip", "");
                }}
              />
              <span className="doc-check-box" />
              <span>Microchipado</span>
            </label>
          </div>
        )}
      </div>
      <div className="form-sub-card">
        <span className="form-sub-card-title">Saúde e cuidados</span>
        <div className="health-grid">
          <YesNoToggleField label="Vermifugado" value={animal.dewormed} onChange={(value) => onChange("dewormed", value)} />
          <YesNoToggleField label="Vacinas em dia" value={animal.vaccinated} onChange={(value) => onChange("vaccinated", value)} />
          <YesNoToggleField label="Histórico de doenças" value={animal.illnessHistory} onChange={(value) => onChange("illnessHistory", value)} />
          <ToggleChoiceField label="Alimentação exclusiva com ração" value={animal.food} options={FOOD_OPTIONS} onChange={(value) => onChange("food", value)} />
        </div>
      </div>
    </>
  );
}
