import { describe, expect, it } from "vitest";
import { findSpeciesIdByName, getBreedOptions, groupBreedsBySpecies, hasDuplicateBreedName } from "./breeds";
import type { Breed } from "./breeds";

function breed(overrides: Partial<Breed> = {}): Breed {
  return { id: "b1", name: "Poodle", speciesId: "canino", active: true, ...overrides };
}

describe("getBreedOptions", () => {
  const filter = { breedIds: ["b1", "b2", "b3"], speciesId: "canino" };

  it("returns an empty list for null and undefined breeds", () => {
    expect(getBreedOptions(null, filter)).toEqual([]);
    expect(getBreedOptions(undefined, filter)).toEqual([]);
  });

  it("returns an empty list when the filter is incomplete", () => {
    const breeds = [breed()];
    expect(getBreedOptions(breeds, { speciesId: "canino" })).toEqual([]);
    expect(getBreedOptions(breeds, { breedIds: [], speciesId: "canino" })).toEqual([]);
    expect(getBreedOptions(breeds, { breedIds: ["b1"] })).toEqual([]);
    expect(getBreedOptions(breeds, { breedIds: ["b1"], speciesId: "" })).toEqual([]);
  });

  it("keeps only the breeds linked by the request type", () => {
    const linked = breed({ id: "b1" });
    const notLinked = breed({ id: "b9", name: "Beagle" });
    expect(getBreedOptions([linked, notLinked], { breedIds: ["b1"], speciesId: "canino" })).toEqual([linked]);
  });

  it("ignores linked ids that no longer exist", () => {
    const linked = breed({ id: "b1" });
    expect(getBreedOptions([linked], { breedIds: ["gone", "b1"], speciesId: "canino" })).toEqual([linked]);
  });

  it("keeps only breeds of the species", () => {
    const poodle = breed({ id: "b1" });
    const siamese = breed({ id: "b2", name: "Siamês", speciesId: "felino" });
    expect(getBreedOptions([poodle, siamese], filter)).toEqual([poodle]);
  });

  it("drops inactive breeds and breeds without a usable name", () => {
    const poodle = breed({ id: "b1" });
    const inactive = breed({ id: "b2", name: "Beagle", active: false });
    const blank = breed({ id: "b3", name: "   " });
    expect(getBreedOptions([poodle, inactive, blank], filter)).toEqual([poodle]);
  });

  it("treats a missing active flag as active", () => {
    const noFlag: Breed = { id: "b1", name: "Poodle", speciesId: "canino" };
    expect(getBreedOptions([noFlag], filter)).toEqual([noFlag]);
  });

  it("sorts alphabetically ignoring case and accents", () => {
    const breeds = [
      breed({ id: "b1", name: "Yorkshire" }),
      breed({ id: "b2", name: "beagle" }),
      breed({ id: "b3", name: "Álamo Terrier" }),
      breed({ id: "b4", name: "Akita" }),
    ];
    const options = getBreedOptions(breeds, { breedIds: ["b1", "b2", "b3", "b4"], speciesId: "canino" });
    expect(options.map((item) => item.name)).toEqual(["Akita", "Álamo Terrier", "beagle", "Yorkshire"]);
  });

  it("does not change the input array", () => {
    const breeds = [breed({ id: "b1", name: "Yorkshire" }), breed({ id: "b2", name: "Akita" })];
    getBreedOptions(breeds, filter);
    expect(breeds.map((item) => item.id)).toEqual(["b1", "b2"]);
  });
});

describe("groupBreedsBySpecies", () => {
  const species = [
    { id: "felino", name: "Felino", active: true },
    { id: "canino", name: "Canino" },
    { id: "ave", name: "Ave", active: false },
    { id: "roedor", name: "Roedor", active: true },
  ];

  it("groups active breeds by active species, both in alphabetical order", () => {
    const breeds = [
      breed({ id: "b1", name: "Yorkshire" }),
      breed({ id: "b2", name: "Akita" }),
      breed({ id: "b3", name: "Siamês", speciesId: "felino" }),
    ];
    const groups = groupBreedsBySpecies(breeds, species);
    expect(groups.map((group) => group.species.id)).toEqual(["canino", "felino"]);
    expect(groups[0].breeds.map((item) => item.name)).toEqual(["Akita", "Yorkshire"]);
    expect(groups[1].breeds.map((item) => item.name)).toEqual(["Siamês"]);
  });

  it("omits species without active breeds and inactive species", () => {
    const breeds = [breed({ id: "b1" }), breed({ id: "b2", name: "Periquito", speciesId: "ave" })];
    expect(groupBreedsBySpecies(breeds, species).map((group) => group.species.id)).toEqual(["canino"]);
  });

  it("ignores inactive breeds and breeds without a usable name", () => {
    const breeds = [breed({ id: "b1", active: false }), breed({ id: "b2", name: "  " })];
    expect(groupBreedsBySpecies(breeds, species)).toEqual([]);
  });

  it("returns an empty list for missing breeds or species", () => {
    expect(groupBreedsBySpecies(null, species)).toEqual([]);
    expect(groupBreedsBySpecies([breed()], undefined)).toEqual([]);
  });
});

describe("findSpeciesIdByName", () => {
  const species = [
    { id: "canino", name: "Canino", active: true },
    { id: "felino", name: "Felino" },
    { id: "ave", name: "Ave", active: false },
  ];

  it("returns the id of the active species with the same name", () => {
    expect(findSpeciesIdByName(species, "Canino")).toBe("canino");
    expect(findSpeciesIdByName(species, "Felino")).toBe("felino");
  });

  it("ignores inactive species", () => {
    expect(findSpeciesIdByName(species, "Ave")).toBeUndefined();
  });

  it("returns undefined for an unknown or empty name and for a missing list", () => {
    expect(findSpeciesIdByName(species, "Roedor")).toBeUndefined();
    expect(findSpeciesIdByName(species, "")).toBeUndefined();
    expect(findSpeciesIdByName(null, "Canino")).toBeUndefined();
  });
});

describe("hasDuplicateBreedName", () => {
  const items = [breed({ id: "b1", name: "Poodle" }), breed({ id: "b2", name: "Siamês", speciesId: "felino" })];

  it("detects a repeated name in the same species ignoring case, accents and spaces", () => {
    expect(hasDuplicateBreedName(items, " POODLE ", "canino")).toBe(true);
    expect(hasDuplicateBreedName(items, "siames", "felino")).toBe(true);
  });

  it("does not count a breed of another species", () => {
    expect(hasDuplicateBreedName(items, "Siamês", "canino")).toBe(false);
  });

  it("ignores the item being edited", () => {
    expect(hasDuplicateBreedName(items, "Poodle", "canino", "b1")).toBe(false);
  });

  it("returns false for an empty name", () => {
    expect(hasDuplicateBreedName(items, "   ", "canino")).toBe(false);
  });
});
