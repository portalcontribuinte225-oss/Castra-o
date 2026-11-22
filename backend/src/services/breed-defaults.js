export const BREEDS_CONFIG_KEY = "castragestao:breeds";

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
