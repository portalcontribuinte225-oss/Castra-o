import React from "react";
import { Card } from "../../components/card";
import { OptionCardGroup } from "../../components/option-card-group";
import type { OptionCardChoice } from "../../components/option-card-group";
import type { AnyRecord } from "../../types";
import { NeighborhoodField } from "../neighborhoods/neighborhood-field";
import { RequestTextField } from "../request-steps/request-text-field";

const SEX_OPTIONS = ["Macho", "Fêmea"];
// The words the tutor reads; the values stored stay the ones the rest of the system knows.
const BREED_TYPE_OPTIONS = [{ value: "Definida", label: "Sim" }, { value: "Indefinida", label: "Não" }];
const YES_NO_OPTIONS = ["Sim", "Não"];
// "Come só ração?" is answered yes or no, and stored as the kind of food.
const FOOD_OPTIONS = [{ value: "Ração", label: "Sim" }, { value: "Diversos", label: "Não" }];

interface AnimalFieldsProps {
  procedures?: React.ReactNode;
  animal: AnyRecord;
  speciesNames: string[];
  sizeChoices: OptionCardChoice[];
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
export function AnimalFields({ procedures, animal, speciesNames, sizeChoices, breedOptions, neighborhoodNames = [], submitAttempted, internal = false, onChange, onSelectSpecies }: AnimalFieldsProps) {
  return (
    <div className="animal-form-sections">
      {procedures && <Card className="form-sub-card animal-procedures-card">{procedures}</Card>}
      <Card className="form-sub-card animal-profile-card">
        <span className="form-sub-card-title">Como ele é?</span>
        <div className="option-card-grid">
          <OptionCardGroup label="Espécie" value={animal.species} options={speciesNames} onChange={onSelectSpecies} invalid={submitAttempted && !animal.species} required stacked />
          <OptionCardGroup label="Sexo" value={animal.sex} options={SEX_OPTIONS} onChange={(value) => onChange("sex", value)} invalid={submitAttempted && !animal.sex} required stacked />
          <OptionCardGroup label="Tem raça definida?" value={animal.breedType} options={BREED_TYPE_OPTIONS} onChange={(value) => onChange("breedType", value)} invalid={submitAttempted && !animal.breedType} required stacked />
          <OptionCardGroup label="Qual o porte?" value={animal.size} options={sizeChoices} onChange={(value) => onChange("size", value)} invalid={submitAttempted && !animal.size} required />
        </div>
        <div className="text-field-row">
          {animal.breedType === "Definida" && (
            breedOptions.length > 0 ? (
              <div className="access-field animal-breed-field" data-label="Raça">
                <select aria-label="Raça" value={animal.breedDescription} onChange={(event) => onChange("breedDescription", event.target.value)}>
                  <option value="">Selecione</option>
                  {breedOptions.map((breed) => (
                    <option key={breed.id} value={breed.name}>{breed.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <RequestTextField className="animal-breed-field" label="Raça" type="text" placeholder="Ex.: Poodle" value={animal.breedDescription} onChange={(event) => onChange("breedDescription", event.target.value)} />
            )
          )}
          <RequestTextField label="Como ele se chama?" type="text" placeholder="Ex.: Bidu" value={animal.name} onChange={(event) => onChange("name", event.target.value)} />
          <RequestTextField label="Cor da pelagem" type="text" placeholder="Ex.: caramelo" value={animal.coat} onChange={(event) => onChange("coat", event.target.value)} />
          <RequestTextField label="Idade aproximada" type="text" placeholder="Ex.: 2 anos" value={animal.age || ""} onChange={(event) => onChange("age", event.target.value)} />
        </div>
        <div className="animal-location-row">
          <div className="animal-neighborhood">
            <NeighborhoodField label="Em que bairro ele vive?" placeholder="Ex.: Centro" value={animal.neighborhood || ""} names={neighborhoodNames} required invalid={submitAttempted && !animal.neighborhood} onChange={(value) => onChange("neighborhood", value)} />
            <small className="form-hint">Ajuda a organizar os atendimentos.</small>
          </div>
          {internal && (
            <div className="internal-microchip-row">
              <RequestTextField
                label="Microchip"
                type="text"
                placeholder={animal.hasChip === "Sim" ? "Código" : "Não informado"}
                value={animal.microchip}
                onChange={(event) => onChange("microchip", event.target.value)}
                readOnly={animal.hasChip !== "Sim"}
              />
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
      </Card>
      <Card className="form-sub-card animal-health-card">
        <div className="form-sub-card-heading">
          <span className="form-sub-card-title">Saúde e cuidados</span>
          <small className="form-hint">Responda só o que souber.</small>
        </div>
        <div className="option-card-grid">
          <OptionCardGroup label="Já tomou vermífugo?" value={animal.dewormed} options={YES_NO_OPTIONS} onChange={(value) => onChange("dewormed", value)} />
          <OptionCardGroup label="As vacinas estão em dia?" value={animal.vaccinated} options={YES_NO_OPTIONS} onChange={(value) => onChange("vaccinated", value)} />
          <OptionCardGroup label="Já teve alguma doença?" value={animal.illnessHistory} options={YES_NO_OPTIONS} onChange={(value) => onChange("illnessHistory", value)} />
          <OptionCardGroup label="Come só ração?" value={animal.food} options={FOOD_OPTIONS} onChange={(value) => onChange("food", value)} />
        </div>
      </Card>
    </div>
  );
}
