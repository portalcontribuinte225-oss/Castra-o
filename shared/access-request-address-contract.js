// The address of a credentialing request (ONG or animal protector). Every field is optional, as the tutor's is, and each must be valid
// when given: the screen marks the field and the server refuses the request with the same words.
export const ACCESS_REQUEST_ADDRESS_LIMITS = Object.freeze({ address: 200, number: 20, neighborhood: 120, city: 120 });

const digits = (value) => String(value ?? "").replace(/\D/g, "");

export function accessRequestAddressIssues({ cep = "", number = "", state = "", address = "", neighborhood = "", city = "" } = {}) {
  const tooLong = (value, field) => String(value ?? "").trim().length > ACCESS_REQUEST_ADDRESS_LIMITS[field];
  return {
    cep: String(cep).trim() && digits(cep).length !== 8 ? "Informe um CEP com 8 dígitos." : "",
    state: String(state).trim() && !/^[A-Za-z]{2}$/.test(String(state).trim()) ? "Informe a UF com 2 letras." : "",
    address: tooLong(address, "address") ? "Endereço muito longo." : "",
    number: tooLong(number, "number") ? "Número muito longo." : "",
    neighborhood: tooLong(neighborhood, "neighborhood") ? "Bairro muito longo." : "",
    city: tooLong(city, "city") ? "Cidade muito longa." : "",
  };
}

// The address as it is stored: trimmed, the CEP as 00000-000 and the UF in capitals.
export function normalizeAccessRequestAddress({ cep = "", number = "", state = "", address = "", neighborhood = "", city = "" } = {}) {
  const cepDigits = digits(cep);
  return {
    cep: cepDigits ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5, 8)}` : "",
    number: String(number ?? "").trim(),
    state: String(state ?? "").trim().toUpperCase(),
    address: String(address ?? "").trim(),
    neighborhood: String(neighborhood ?? "").trim(),
    city: String(city ?? "").trim(),
  };
}
