import { describe, expect, it } from "vitest";
import { findNeighborhoodName, hasDuplicateNeighborhoodName, neighborhoodChoices, neighborhoodKey, neighborhoodNames, newNeighborhoods, parseNeighborhoodLines } from "./neighborhoods";

const list = [
  { id: "a", name: "Pinheirinho", active: true },
  { id: "b", name: " Centro ", active: true },
  { id: "c", name: "Bairro Antigo", active: false },
  { id: "d", name: "" },
  { id: "e", name: "Centro", active: true },
];

describe("neighborhoodNames", () => {
  it("offers the active, named neighborhoods once each, in alphabetical order", () => {
    expect(neighborhoodNames(list)).toEqual(["Centro", "Pinheirinho"]);
  });

  it("answers an empty list for anything that is not a list", () => {
    expect(neighborhoodNames(undefined)).toEqual([]);
    expect(neighborhoodNames(null)).toEqual([]);
  });
});

describe("findNeighborhoodName", () => {
  it("matches ignoring case, accents and spacing, and answers the registered name", () => {
    expect(findNeighborhoodName(["São João", "Centro"], "  sao   joao ")).toBe("São João");
    expect(findNeighborhoodName(["Centro"], "Pinheirinho")).toBe("");
    expect(findNeighborhoodName(["Centro"], "")).toBe("");
    expect(findNeighborhoodName(["Centro"], undefined)).toBe("");
  });

  it("has one key for the same neighborhood written in different ways", () => {
    expect(neighborhoodKey("São  João")).toBe(neighborhoodKey("sao joao"));
  });
});

describe("parseNeighborhoodLines", () => {
  it("keeps one trimmed name per line without blanks or repeats", () => {
    expect(parseNeighborhoodLines(" Centro \r\n\nPinheirinho\ncentro\n  \nSão João\nSAO JOAO")).toEqual(["Centro", "Pinheirinho", "São João"]);
    expect(parseNeighborhoodLines("")).toEqual([]);
  });
});

describe("newNeighborhoods", () => {
  it("adds only the names that are not registered yet, active, for the municipality", () => {
    const added = newNeighborhoods([{ id: "a", name: "Centro" }], ["centro", "Pinheirinho", "Michel"], "m1", 10);
    expect(added).toEqual([
      { id: "neighborhood_10_0", name: "Pinheirinho", active: true, municipalityId: "m1" },
      { id: "neighborhood_10_1", name: "Michel", active: true, municipalityId: "m1" },
    ]);
  });
});

describe("hasDuplicateNeighborhoodName", () => {
  it("finds a repeated name but not the item being edited", () => {
    expect(hasDuplicateNeighborhoodName([{ id: "a", name: "Centro" }], "CENTRO")).toBe(true);
    expect(hasDuplicateNeighborhoodName([{ id: "a", name: "Centro" }], "Centro", "a")).toBe(false);
    expect(hasDuplicateNeighborhoodName([{ id: "a", name: "Centro" }], "Michel")).toBe(false);
  });
});

describe("neighborhoodChoices", () => {
  it("keeps a saved name that is no longer on the list so the field still shows it", () => {
    expect(neighborhoodChoices(["Centro"], "Bairro Antigo")).toEqual(["Centro", "Bairro Antigo"]);
    expect(neighborhoodChoices(["Centro"], "centro")).toEqual(["Centro"]);
    expect(neighborhoodChoices(["Centro"], "")).toEqual(["Centro"]);
  });
});
