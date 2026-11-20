import React from "react";
import { NeighborhoodField } from "../neighborhoods/neighborhood-field";
import { RequestTextField } from "../request-steps/request-text-field";
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
  internal?: boolean;
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
export function TutorStepFields({ data, internal, nameInvalid, nameIssue, cpfInvalid, neighborhoodNames, showErrors, onField, onMaskedField, onCepChange }: TutorStepFieldsProps) {
  return (
    <>
      <div className="form-sub-card">
        <span className="form-sub-card-title">Responsável</span>
        <div className="two-column-fields">
          <RequestTextField internal={internal} label="Nome completo" type="text" maxLength={160} placeholder="Nome do tutor ou responsável" value={data.tutor} onChange={(event) => onField("tutor", event.target.value)} aria-invalid={nameInvalid} error={nameInvalid ? nameIssue : undefined} />
          <RequestTextField internal={internal} label="CPF" type="text" inputMode="numeric" placeholder="000.000.000-00" value={data.cpf} onChange={(event) => onMaskedField("cpf", event.target.value)} aria-invalid={cpfInvalid} error={cpfInvalid ? "Informe um CPF válido." : undefined} />
        </div>
      </div>

      <div className="form-sub-card">
        <span className="form-sub-card-title">Endereço</span>
        <div className="address-lookup-grid">
          <RequestTextField internal={internal} label="CEP" type="text" inputMode="numeric" placeholder="00000-000" value={data.cep} onChange={(event) => onCepChange(event.target.value)} />
          <RequestTextField internal={internal} label="Número" type="text" placeholder="Número" value={data.number} onChange={(event) => onField("number", event.target.value)} />
          <RequestTextField internal={internal} label="UF" type="text" placeholder="UF" value={data.state} maxLength={2} onChange={(event) => onMaskedField("state", event.target.value)} />
        </div>
        <RequestTextField internal={internal} label="Endereço" type="text" placeholder="Rua, complemento" value={data.address} onChange={(event) => onField("address", event.target.value)} />
        <div className="address-city-grid">
          <NeighborhoodField internal={internal} value={data.neighborhood} names={neighborhoodNames} onChange={(value) => onField("neighborhood", value)} />
          <RequestTextField internal={internal} label="Cidade" type="text" placeholder="Cidade" value={data.city} onChange={(event) => onField("city", event.target.value)} />
        </div>
        {data.latitude && data.longitude && <p className="map-selected-place">Localização registrada: {data.latitude}, {data.longitude}.</p>}
      </div>

      <RegistrationContactFields internal={internal} email={data.email} phone={data.phone} onEmailChange={(value) => onField("email", value)} onPhoneChange={(value) => onMaskedField("phone", value)} showErrors={showErrors} />
    </>
  );
}
