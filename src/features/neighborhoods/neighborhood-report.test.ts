import { describe, expect, it } from "vitest";
import { NO_NEIGHBORHOOD_FILTER, animalNeighborhoodsOf, matchesNeighborhoodFilter, neighborhoodFilterOptions, neighborhoodsLabel, tutorNeighborhoodOf } from "./neighborhood-report";

describe("the neighborhoods of a request", () => {
  it("reads the neighborhood of the tutor's address", () => {
    expect(tutorNeighborhoodOf({ neighborhood: " Centro " })).toBe("Centro");
    expect(tutorNeighborhoodOf({})).toBe("");
  });

  it("lists the distinct neighborhoods of its animals, ignoring blanks, case and accents", () => {
    const request = { animals: [{ neighborhood: "São João" }, { neighborhood: "sao joao" }, { neighborhood: "" }, {}, { neighborhood: "Centro" }, null] };
    expect(animalNeighborhoodsOf(request)).toEqual(["São João", "Centro"]);
    expect(animalNeighborhoodsOf({})).toEqual([]);
  });
});

describe("matchesNeighborhoodFilter", () => {
  it("lets everything pass without a filter", () => {
    expect(matchesNeighborhoodFilter([], "")).toBe(true);
    expect(matchesNeighborhoodFilter(["Centro"], "")).toBe(true);
  });

  it("matches a neighborhood ignoring case and accents, and any of the animals' neighborhoods", () => {
    expect(matchesNeighborhoodFilter(["São João", "Centro"], "sao joao")).toBe(true);
    expect(matchesNeighborhoodFilter(["Centro"], "Pinheirinho")).toBe(false);
    expect(matchesNeighborhoodFilter([], "Centro")).toBe(false);
  });

  it("selects the requests without a neighborhood with the special option", () => {
    expect(matchesNeighborhoodFilter([], NO_NEIGHBORHOOD_FILTER)).toBe(true);
    expect(matchesNeighborhoodFilter(["Centro"], NO_NEIGHBORHOOD_FILTER)).toBe(false);
  });
});

describe("neighborhoodFilterOptions", () => {
  it("joins the registered neighborhoods and the ones found in the requests, once each, alphabetical", () => {
    const registered = [{ id: "a", name: "Pinheirinho", active: true }, { id: "b", name: "Antigo", active: false }];
    expect(neighborhoodFilterOptions([["centro"], ["Centro", "Michel"], []], registered)).toEqual(["centro", "Michel", "Pinheirinho"]);
    expect(neighborhoodFilterOptions([], undefined)).toEqual([]);
  });
});

describe("neighborhoodsLabel", () => {
  it("shows the names, or that none was informed", () => {
    expect(neighborhoodsLabel(["Centro", "Michel"])).toBe("Centro, Michel");
    expect(neighborhoodsLabel([])).toBe("Não informado");
  });
});
