import React from "react";
import { NeighborhoodField } from "../neighborhoods/neighborhood-field";
import { RegistrationContactFields } from "./registration-contact-fields";

export interface TutorStepData {
  tutor: string;
  cpf: string;
  cep: string;
  number: string;
  state: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude: string;
  longitude: string;
  email: string;
  phone: string;
}

type TutorField = keyof TutorStepData;

export interface TutorStepFieldsProps {
  data: TutorStepData;
  nameInvalid: boolean;
  nameIssue: string;
  cpfInvalid: boolean;
  // The neighborhoods the municipality registered; with none, the field is free text.
  neighborhoodNames: string[];
  showErrors: boolean;
  onField: (field: TutorField, value: string) => void;
  onMaskedField: (field: TutorField, value: string) => void;
  onCepChange: (value: string) => void;
}

// The Tutor step of the request, the same for the public form and for the one the staff fills: who is responsible, where they live and
// how to reach them.
export function TutorStepFields({ data, nameInvalid, nameIssue, cpfInvalid, neighborhoodNames, showErrors, onField, onMaskedField, onCepChange }: TutorStepFieldsProps) {
  return (
    <>
      <div className="form-sub-card">
        <span className="form-sub-card-title">Responsável</span>
        <div className={`access-field${nameInvalid ? " is-invalid" : ""}`} data-label="Nome completo">
          <input type="text" maxLength={160} placeholder="Nome do tutor ou responsável" value={data.tutor} onChange={(event) => onField("tutor", event.target.value)} aria-invalid={nameInvalid} />
          {nameInvalid && <small className="field-error-message">{nameIssue}</small>}
        </div>
        <div className="two-column-fields">
          <div className={`access-field${cpfInvalid ? " is-invalid" : ""}`} data-label="CPF">
            <input type="text" placeholder="000.000.000-00" value={data.cpf} onChange={(event) => onMaskedField("cpf", event.target.value)} aria-invalid={cpfInvalid} />
            {cpfInvalid && <small className="field-error-message">Informe um CPF válido.</small>}
          </div>
        </div>
      </div>

      <div className="form-sub-card">
        <span className="form-sub-card-title">Endereço</span>
        <div className="address-lookup-grid">
          <div className="access-field" data-label="CEP">
            <input type="text" placeholder="00000-000" value={data.cep} onChange={(event) => onCepChange(event.target.value)} />
          </div>
          <div className="access-field" data-label="Número">
            <input type="text" placeholder="Número" value={data.number} onChange={(event) => onField("number", event.target.value)} />
          </div>
          <div className="access-field" data-label="UF">
            <input type="text" placeholder="UF" value={data.state} maxLength={2} onChange={(event) => onMaskedField("state", event.target.value)} />
          </div>
        </div>
        <div className="access-field" data-label="Endereço">
          <input type="text" placeholder="Rua, complemento" value={data.address} onChange={(event) => onField("address", event.target.value)} />
        </div>
        <div className="address-city-grid">
          <NeighborhoodField value={data.neighborhood} names={neighborhoodNames} onChange={(value) => onField("neighborhood", value)} />
          <div className="access-field" data-label="Cidade">
            <input type="text" placeholder="Cidade" value={data.city} onChange={(event) => onField("city", event.target.value)} />
          </div>
        </div>
        {data.latitude && data.longitude && <p className="map-selected-place">Localização registrada: {data.latitude}, {data.longitude}.</p>}
      </div>

      <RegistrationContactFields email={data.email} phone={data.phone} onEmailChange={(value) => onField("email", value)} onPhoneChange={(value) => onMaskedField("phone", value)} showErrors={showErrors} />
    </>
  );
}
