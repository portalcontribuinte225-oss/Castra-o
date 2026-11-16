export const BREEDS_CONFIG_KEY = "castragestao:breeds";
export const REQUEST_TYPES_CONFIG_KEY = "castragestao:request-types";
export const SPECIES_CONFIG_KEY = "castragestao:species";

// The species every municipality starts with (see municipalityDefaults); the default breeds point to these ids.
export const DEFAULT_DOG_SPECIES_ID = "canino";
export const DEFAULT_CAT_SPECIES_ID = "felino";

const DOG_BREEDS = ["Shih Tzu", "Pastor Alemão", "Golden Retriever", "Labrador Retriever", "Poodle"];
const CAT_BREEDS = ["Siamês", "Persa", "Maine Coon", "Ragdoll", "Angorá"];

const slug = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const breedsOf = (speciesId, names) => names.map((name) => ({ id: `${speciesId}_${slug(name)}`, name, speciesId, active: true }));

// The most common dog and cat breeds, active, so a new municipality does not start with an empty breed list.
export function buildDefaultBreeds() {
  return [...breedsOf(DEFAULT_DOG_SPECIES_ID, DOG_BREEDS), ...breedsOf(DEFAULT_CAT_SPECIES_ID, CAT_BREEDS)];
}

const hasItems = (value) => Array.isArray(value) && value.length > 0;

// What to write for a municipality that already exists. It never touches a municipality that has breeds of its own, and it
// only fills the breeds of request types that link none (the form shows only the breeds a request type links).
// Returns `{ skip: reason }` or the new `breeds` and `requestTypes` values.
export function planBreedSeed({ species, breeds, requestTypes }) {
  if (hasItems(breeds)) return { skip: "já tem raças cadastradas" };
  const ids = new Set((Array.isArray(species) ? species : []).map((item) => item?.id));
  if (!ids.has(DEFAULT_DOG_SPECIES_ID) || !ids.has(DEFAULT_CAT_SPECIES_ID)) return { skip: "não tem as espécies padrão (canino e felino)" };
  const defaults = buildDefaultBreeds();
  const breedIds = defaults.map(({ id }) => id);
  const types = Array.isArray(requestTypes) ? requestTypes.map((type) => (type && !hasItems(type.breedIds) ? { ...type, breedIds } : type)) : requestTypes;
  return { breeds: defaults, requestTypes: types };
}
