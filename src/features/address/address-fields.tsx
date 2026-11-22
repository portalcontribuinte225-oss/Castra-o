import { NeighborhoodField } from "../neighborhoods/neighborhood-field";
import { RequestTextField } from "../request-steps/request-text-field";

export interface AddressValues {
  cep: string;
  number: string;
  state: string;
  address: string;
  neighborhood: string;
  city: string;
}

type AddressTextField = "number" | "address" | "neighborhood" | "city";

interface AddressFieldsProps {
  values: AddressValues;
  // The neighborhoods the municipality registered; with none, the field is free text.
  neighborhoodNames: string[];
  onField: (field: AddressTextField, value: string) => void;
  // The CEP fills the rest of the address; the caller owns that lookup and the masks.
  onCepChange: (value: string) => void;
  onStateChange: (value: string) => void;
  // What is wrong with each field, shown under it once the form was submitted.
  issues?: Partial<Record<keyof AddressValues, string>>;
}

// The address fields of the public forms (the tutor's and the credentialing's): the same fields, in the same places.
export function AddressFields({ values, neighborhoodNames, onField, onCepChange, onStateChange, issues = {} }: AddressFieldsProps) {
  return (
    <>
      <div className="address-lookup-grid">
        <RequestTextField label="CEP" type="text" inputMode="numeric" placeholder="00000-000" value={values.cep} error={issues.cep || undefined} onChange={(event) => onCepChange(event.target.value)} />
        <RequestTextField label="Número" type="text" placeholder="Número" value={values.number} error={issues.number || undefined} onChange={(event) => onField("number", event.target.value)} />
        <RequestTextField label="UF" type="text" placeholder="UF" value={values.state} maxLength={2} error={issues.state || undefined} onChange={(event) => onStateChange(event.target.value)} />
      </div>
      <RequestTextField label="Endereço" type="text" placeholder="Rua, complemento" value={values.address} error={issues.address || undefined} onChange={(event) => onField("address", event.target.value)} />
      <div className="address-city-grid">
        <NeighborhoodField value={values.neighborhood} names={neighborhoodNames} invalid={Boolean(issues.neighborhood)} onChange={(value) => onField("neighborhood", value)} />
        <RequestTextField label="Cidade" type="text" placeholder="Cidade" value={values.city} error={issues.city || undefined} onChange={(event) => onField("city", event.target.value)} />
      </div>
    </>
  );
}
