import { describe, expect, it } from "vitest";
import { findSpeciesIdByName, getBreedOptions, getDuplicateBreedNames, parseBreedNames } from "./breeds";
import type { Breed } from "./breeds";

function breed(overrides: Partial<Breed> = {}): Breed {
  return { id: "b1", name: "Poodle", speciesId: "canino", requestTypeIds: ["castracao"], active: true, ...overrides };
}

const filter = { requestTypeId: "castracao", speciesId: "canino" };

describe("getBreedOptions", () => {
  it("returns an empty list for null and undefined", () => {
    expect(getBreedOptions(null, filter)).toEqual([]);
    expect(getBreedOptions(undefined, filter)).toEqual([]);
  });

  it("returns an empty list when the filter is incomplete", () => {
    const breeds = [breed()];
    expect(getBreedOptions(breeds, { speciesId: "canino" })).toEqual([]);
    expect(getBreedOptions(breeds, { requestTypeId: "castracao" })).toEqual([]);
    expect(getBreedOptions(breeds, { requestTypeId: "", speciesId: "" })).toEqual([]);
  });

  it("keeps only breeds of the species", () => {
    const poodle = breed();
    const siamese = breed({ id: "b2", name: "Siamês", speciesId: "felino" });
    expect(getBreedOptions([poodle, siamese], filter)).toEqual([poodle]);
  });

  it("keeps only breeds linked to the request type", () => {
    const poodle = breed();
    const otherType = breed({ id: "b2", name: "Beagle", requestTypeIds: ["ninhada"] });
    const noLinks = breed({ id: "b3", name: "Husky", requestTypeIds: [] });
    const missingLinks = { id: "b4", name: "Akita", speciesId: "canino" } as Breed;
    expect(getBreedOptions([poodle, otherType, noLinks, missingLinks], filter)).toEqual([poodle]);
  });

  it("drops inactive breeds and breeds without a usable name", () => {
    const poodle = breed();
    const inactive = breed({ id: "b2", name: "Beagle", active: false });
    const blank = breed({ id: "b3", name: "   " });
    expect(getBreedOptions([poodle, inactive, blank], filter)).toEqual([poodle]);
  });

  it("treats a missing active flag as active", () => {
    const noFlag = { id: "b1", name: "Poodle", speciesId: "canino", requestTypeIds: ["castracao"] } as Breed;
    expect(getBreedOptions([noFlag], filter)).toEqual([noFlag]);
  });

  it("sorts alphabetically ignoring case and accents", () => {
    const breeds = [
      breed({ id: "b1", name: "Yorkshire" }),
      breed({ id: "b2", name: "beagle" }),
      breed({ id: "b3", name: "Álamo Terrier" }),
      breed({ id: "b4", name: "Akita" }),
    ];
    expect(getBreedOptions(breeds, filter).map((item) => item.name)).toEqual(["Akita", "Álamo Terrier", "beagle", "Yorkshire"]);
  });

  it("does not change the input array", () => {
    const breeds = [breed({ id: "b1", name: "Yorkshire" }), breed({ id: "b2", name: "Akita" })];
    getBreedOptions(breeds, filter);
    expect(breeds.map((item) => item.id)).toEqual(["b1", "b2"]);
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

describe("parseBreedNames", () => {
  it("trims names and drops blank lines", () => {
    expect(parseBreedNames("  Poodle  \n\n   \nBeagle")).toEqual(["Poodle", "Beagle"]);
  });

  it("handles Windows line breaks", () => {
    expect(parseBreedNames("Poodle\r\nBeagle\r\n")).toEqual(["Poodle", "Beagle"]);
  });

  it("removes repeated names ignoring case and accents, keeping the first one", () => {
    expect(parseBreedNames("Siamês\nsiames\nPoodle\nSIAMÊS")).toEqual(["Siamês", "Poodle"]);
  });

  it("returns an empty list for empty text", () => {
    expect(parseBreedNames("")).toEqual([]);
    expect(parseBreedNames("  \n \n")).toEqual([]);
  });
});

describe("getDuplicateBreedNames", () => {
  const items = [breed({ id: "b1", name: "Poodle" }), breed({ id: "b2", name: "Siamês", speciesId: "felino" })];

  it("detects a repeated name in the same species ignoring case, accents and spaces", () => {
    expect(getDuplicateBreedNames(items, [" POODLE "], "canino")).toEqual([" POODLE "]);
    expect(getDuplicateBreedNames(items, ["siames"], "felino")).toEqual(["siames"]);
  });

  it("does not count a breed of another species", () => {
    expect(getDuplicateBreedNames(items, ["Siamês"], "canino")).toEqual([]);
  });

  it("ignores the item being edited", () => {
    expect(getDuplicateBreedNames(items, ["Poodle"], "canino", "b1")).toEqual([]);
  });

  it("returns the conflicting names in input order", () => {
    expect(getDuplicateBreedNames(items, ["Beagle", "Poodle", "Akita"], "canino")).toEqual(["Poodle"]);
    expect(getDuplicateBreedNames(items, ["Beagle"], "canino")).toEqual([]);
  });
});
