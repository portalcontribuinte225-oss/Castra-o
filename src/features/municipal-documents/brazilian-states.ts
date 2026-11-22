// How the header of a municipal document names the state of the municipality, by its abbreviation.
const STATE_HEADINGS: Readonly<Record<string, string>> = Object.freeze({
  AC: "Estado do Acre",
  AL: "Estado de Alagoas",
  AP: "Estado do Amapá",
  AM: "Estado do Amazonas",
  BA: "Estado da Bahia",
  CE: "Estado do Ceará",
  DF: "Distrito Federal",
  ES: "Estado do Espírito Santo",
  GO: "Estado de Goiás",
  MA: "Estado do Maranhão",
  MT: "Estado de Mato Grosso",
  MS: "Estado de Mato Grosso do Sul",
  MG: "Estado de Minas Gerais",
  PA: "Estado do Pará",
  PB: "Estado da Paraíba",
  PR: "Estado do Paraná",
  PE: "Estado de Pernambuco",
  PI: "Estado do Piauí",
  RJ: "Estado do Rio de Janeiro",
  RN: "Estado do Rio Grande do Norte",
  RS: "Estado do Rio Grande do Sul",
  RO: "Estado de Rondônia",
  RR: "Estado de Roraima",
  SC: "Estado de Santa Catarina",
  SP: "Estado de São Paulo",
  SE: "Estado de Sergipe",
  TO: "Estado do Tocantins",
});

// "SC" → "Estado de Santa Catarina"; an unknown abbreviation names no state.
export function stateHeading(state: unknown): string {
  return STATE_HEADINGS[String(state ?? "").trim().toUpperCase()] || "";
}
