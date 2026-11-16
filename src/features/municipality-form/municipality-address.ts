import { formatCep, formatPhone, isValidPhone, onlyDigits } from "../../utils";
import type { AnyRecord } from "../../types";
import type { CepAddress } from "../animal-services/cep-lookup";

// The municipality form: the contact and the address are separate fields; the street is the `address` column.
export interface MunicipalityForm {
  name: string;
  state: string;
  active: boolean;
  brasao: string;
  contact: string;
  email: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  cep: string;
  departmentName: string;
}

export const emptyMunicipalityForm: MunicipalityForm = {
  name: "", state: "", active: true, brasao: "", contact: "", email: "", address: "", addressNumber: "", addressComplement: "",
  neighborhood: "", cep: "", departmentName: "",
};

// The form of a saved municipality. A contact written as free text before it became a phone has no digits and shows empty.
export function formFromMunicipality(municipality: AnyRecord = {}): MunicipalityForm {
  return {
    name: municipality.name || "",
    state: municipality.state || "",
    active: municipality.active !== false,
    brasao: municipality.brasao || "",
    contact: formatPhone(municipality.contact || ""),
    email: municipality.email || "",
    address: municipality.address || "",
    addressNumber: municipality.address_number || municipality.addressNumber || "",
    addressComplement: municipality.address_complement || municipality.addressComplement || "",
    neighborhood: municipality.neighborhood || "",
    cep: formatCep(municipality.cep || ""),
    departmentName: municipality.department_name || municipality.departmentName || "",
  };
}

// "Rua das Flores, 100, Sala 2 - Centro". A municipality saved before the address was split has only the street column, which
// holds the whole text, and shows it as it is.
export function formatMunicipalityAddress(municipality: AnyRecord = {}): string {
  const street = [municipality.address, municipality.address_number || municipality.addressNumber, municipality.address_complement || municipality.addressComplement]
    .map((part) => String(part || "").trim()).filter(Boolean).join(", ");
  const neighborhood = String(municipality.neighborhood || "").trim();
  return [street, neighborhood].filter(Boolean).join(" - ");
}

// The problem that stops the form from being saved, or "" when there is none. Both fields may stay empty.
export function municipalityContactIssue(form: Pick<MunicipalityForm, "contact" | "cep">): string {
  if (onlyDigits(form.contact) && !isValidPhone(form.contact)) return "Informe um telefone de contato válido, com DDD.";
  const cep = onlyDigits(form.cep);
  if (cep && cep.length !== 8) return "Informe um CEP com 8 dígitos.";
  return "";
}

// What a found CEP puts in the form: the street and the neighborhood, and the city and the state when this user may set them
// (only the support does). What the CEP does not tell (a city with one CEP has no street) leaves the field as it was.
export function withCepAddress(form: MunicipalityForm, found: CepAddress, canSetCity: boolean): MunicipalityForm {
  return {
    ...form,
    address: found.address || form.address,
    neighborhood: found.neighborhood || form.neighborhood,
    ...(canSetCity ? { name: found.city || form.name, state: found.state || form.state } : {}),
  };
}
