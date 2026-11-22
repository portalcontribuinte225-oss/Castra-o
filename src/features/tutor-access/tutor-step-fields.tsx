import { Card } from "../../components/card";
import { AddressFields } from "../address/address-fields";
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
  // The tutor is identified (name and CPF are required): always for a tutor, and when the answer about the tutor asks for one.
  identityRequired: boolean;
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
export function TutorStepFields({ data, identityRequired, nameInvalid, nameIssue, cpfInvalid, neighborhoodNames, showErrors, onField, onMaskedField, onCepChange }: TutorStepFieldsProps) {
  return (
    <>
      <Card className="form-sub-card">
        <span className="form-sub-card-title">Responsável</span>
        <div className="two-column-fields">
          <RequestTextField label="Nome completo" required={identityRequired} type="text" maxLength={160} placeholder="Nome do tutor ou responsável" value={data.tutor} onChange={(event) => onField("tutor", event.target.value)} aria-invalid={nameInvalid} error={nameInvalid ? nameIssue : undefined} />
          <RequestTextField label="CPF" required={identityRequired} type="text" inputMode="numeric" placeholder="000.000.000-00" value={data.cpf} onChange={(event) => onMaskedField("cpf", event.target.value)} aria-invalid={cpfInvalid} error={cpfInvalid ? "Informe um CPF válido." : undefined} />
        </div>
      </Card>

      <Card className="form-sub-card">
        <span className="form-sub-card-title">Endereço</span>
        <AddressFields values={data} neighborhoodNames={neighborhoodNames} onField={onField} onCepChange={onCepChange} onStateChange={(value) => onMaskedField("state", value)} />
        {data.latitude && data.longitude && <p className="map-selected-place">Localização registrada: {data.latitude}, {data.longitude}.</p>}
      </Card>

      <RegistrationContactFields email={data.email} phone={data.phone} onEmailChange={(value) => onField("email", value)} onPhoneChange={(value) => onMaskedField("phone", value)} showErrors={showErrors} />
    </>
  );
}
