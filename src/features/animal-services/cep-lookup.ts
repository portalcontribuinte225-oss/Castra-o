import { onlyDigits } from "../../utils";

export interface CepAddress {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

// A failed lookup never blocks manual entry, so every failure resolves to null.
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();
    if (data.erro) return null;
    return { address: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" };
  } catch {
    return null;
  }
}
