import { activeNeighborhoods, normalizeNeighborhoodName } from "./neighborhood-defaults.js";

const MAX_NEIGHBORHOOD_LENGTH = 120;

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

// Every new animal of a request says in which neighborhood it lives. When the municipality has registered its neighborhoods the
// answer must be one of them, and it is stored with the name as registered; otherwise it is free text. Animals that already
// exist (they carry an id) keep the neighborhood of their own record. Returns the animals with the neighborhood normalized.
export function prepareAnimalNeighborhoods({ animals, municipalityId, settings }) {
  const list = Array.isArray(animals) ? animals : [];
  const options = activeNeighborhoods(settings?.neighborhoods, municipalityId);
  return list.map((animal, index) => {
    if (!animal || typeof animal !== "object" || Array.isArray(animal) || animal.id) return animal;
    const label = list.length > 1 ? ` do animal ${index + 1}` : " do animal";
    const sent = typeof animal.neighborhood === "string" ? animal.neighborhood.trim() : "";
    if (!sent) invalid(`Informe o bairro${label}.`);
    if (!options.length) {
      if (sent.length > MAX_NEIGHBORHOOD_LENGTH) invalid(`Bairro${label} muito longo.`);
      return { ...animal, neighborhood: sent };
    }
    const match = options.find((item) => normalizeNeighborhoodName(item.name) === normalizeNeighborhoodName(sent));
    if (!match) invalid(`Escolha um bairro da lista${label}.`);
    return { ...animal, neighborhood: match.name.trim() };
  });
}
