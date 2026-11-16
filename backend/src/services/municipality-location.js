import { isValidPhone } from "../utils.js";

// The columns of a municipality that say how to reach it and where it is; the street is the existing `address` column.
const TEXT_LIMITS = { address: 200, address_number: 20, address_complement: 80, neighborhood: 120 };
const CAMEL_NAMES = { address_number: "addressNumber", address_complement: "addressComplement" };
export const MUNICIPALITY_LOCATION_FIELDS = ["contact", "cep", ...Object.keys(TEXT_LIMITS)];

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

const digitsOf = (value) => String(value ?? "").replace(/\D/g, "");

// "(48) 99999-9999", or "(48) 9999-9999" for a landline.
export function formatContactPhone(digits) {
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  return `(${area}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

// The contact and address fields the body carries (in snake or camel case), validated and normalized: the contact is a phone with
// DDD in its masked form and the CEP is 8 digits. Fields the body does not carry are not in the answer, so a PATCH touches only
// what was sent. Throws a 400 for what cannot be saved.
export function readMunicipalityLocation(body = {}) {
  const sent = (field) => (body[field] !== undefined ? body[field] : body[CAMEL_NAMES[field]]);
  const fields = {};
  if (body.contact !== undefined) {
    const digits = digitsOf(body.contact);
    if (digits && !isValidPhone(digits)) invalid("Informe um telefone de contato válido, com DDD.");
    fields.contact = digits ? formatContactPhone(digits) : "";
  }
  if (body.cep !== undefined) {
    const digits = digitsOf(body.cep);
    if (digits && digits.length !== 8) invalid("Informe um CEP com 8 dígitos.");
    fields.cep = digits;
  }
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const value = sent(field);
    if (value === undefined) continue;
    const text = String(value ?? "").trim();
    if (text.length > limit) invalid(`O campo ${field.replace(/_/g, " ")} deve ter no máximo ${limit} caracteres.`);
    fields[field] = text;
  }
  return fields;
}
