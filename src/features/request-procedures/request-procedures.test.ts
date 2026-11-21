import { describe, expect, it } from "vitest";
import type { AnyRecord } from "../../types";
import {
  animalHeader,
  applyProceduresToAll,
  blankAnimal,
  breedOptionsFor,
  duplicateAnimal,
  mergeProcedureDocuments,
  needsProcedure,
  procedureNames,
  procedureSignature,
  requestTypeFeeLabel,
  withProcedures,
  withProceduresAt,
} from "./request-procedures";
import type { BreedContext } from "./request-procedures";

const castration = { id: "castration", name: "Castração", breedIds: ["poodle", "siames"] };
const microchip = { id: "microchip", name: "Microchipagem", breedIds: ["shih-tzu"] };
const vaccine = { id: "vaccine", name: "Vacinação", charged: true, billingAmount: "R$ 15,00", breedIds: [] };
const speciesOptions = [{ id: "canino", name: "Canino", active: true }, { id: "felino", name: "Felino", active: true }];
const breeds = [
  { id: "poodle", name: "Poodle", speciesId: "canino", active: true },
  { id: "shih-tzu", name: "Shih Tzu", speciesId: "canino", active: true },
  { id: "siames", name: "Siamês", speciesId: "felino", active: true },
];
const context: BreedContext = { requestTypes: [castration, microchip, vaccine], breeds, speciesOptions };
const dog = (overrides: AnyRecord = {}): AnyRecord => ({ ...blankAnimal(), species: "Canino", ...overrides });

describe("blankAnimal", () => {
  it("starts empty, without procedures, and each call is its own object", () => {
    const first = blankAnimal();
    expect(first).toMatchObject({ name: "", species: "", sex: "", breedType: "", size: "", requestTypeIds: [] });
    first.requestTypeIds.push("castration");
    expect(blankAnimal().requestTypeIds).toEqual([]);
  });
});

describe("breedOptionsFor", () => {
  it("offers the breeds linked to any procedure of the animal, of its species", () => {
    expect(breedOptionsFor(dog({ requestTypeIds: ["castration"] }), context).map((breed) => breed.name)).toEqual(["Poodle"]);
    expect(breedOptionsFor(dog({ requestTypeIds: ["castration", "microchip"] }), context).map((breed) => breed.name)).toEqual(["Poodle", "Shih Tzu"]);
    expect(breedOptionsFor({ ...dog({ requestTypeIds: ["castration", "microchip"] }), species: "Felino" }, context).map((breed) => breed.name)).toEqual(["Siamês"]);
  });

  it("offers the species catalog when there are no available linked breeds", () => {
    for (const requestTypeIds of [[], ["vaccine"]]) {
      expect(breedOptionsFor(dog({ requestTypeIds }), context).map((breed) => breed.name)).toEqual(["Poodle", "Shih Tzu"]);
    }
    expect(breedOptionsFor({ ...dog({ requestTypeIds: ["microchip"] }), species: "Felino" }, context).map((breed) => breed.name)).toEqual(["Siamês"]);
    expect(breedOptionsFor(dog({ requestTypeIds: ["castration"] }), { ...context, breeds: [] })).toEqual([]);
    expect(breedOptionsFor({ ...dog({ requestTypeIds: ["castration"] }), species: "" }, context)).toEqual([]);
  });
});

describe("withProcedures", () => {
  it("sets the procedures and clears a defined breed they no longer offer", () => {
    const animal = dog({ requestTypeIds: ["castration"], breedType: "Definida", breedDescription: "Poodle" });
    expect(withProcedures(animal, ["castration", "microchip"], context).breedDescription).toBe("Poodle");
    expect(withProcedures(animal, ["microchip"], context)).toMatchObject({ requestTypeIds: ["microchip"], breedDescription: "" });
    expect(animal.requestTypeIds).toEqual(["castration"]);
  });

  it("leaves a typed breed alone when the procedures offer no list, and an undefined breed too", () => {
    const typed = dog({ breedType: "Definida", breedDescription: "Vira-lata caramelo" });
    expect(withProcedures(typed, ["vaccine"], context).breedDescription).toBe("Vira-lata caramelo");
    const undefinedBreed = dog({ breedType: "Indefinida", breedDescription: "Poodle", requestTypeIds: ["castration"] });
    expect(withProcedures(undefinedBreed, ["microchip"], context).breedDescription).toBe("Poodle");
  });

  it("changes only the animal at the given position", () => {
    const animals = [dog(), dog({ name: "Mia" })];
    const next = withProceduresAt(animals, 1, ["castration"], context);
    expect(next[0]).toBe(animals[0]);
    expect(next[1]).toMatchObject({ name: "Mia", requestTypeIds: ["castration"] });
  });
});

describe("duplicateAnimal", () => {
  it("adds an animal like the previous one, with species, size, breed, neighborhood and procedures, and the rest blank", () => {
    const animals = [dog({ name: "Bidu", sex: "Macho", size: "Pequeno", breedType: "Definida", breedDescription: "Poodle", coat: "Preta", age: "2 anos", neighborhood: "Centro",
      weight: "5", requestTypeIds: ["castration", "microchip"], dewormed: "Sim", microchip: "123" })];
    const next = duplicateAnimal(animals, 0);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(animals[0]);
    expect(next[1]).toMatchObject({ species: "Canino", size: "Pequeno", breedType: "Definida", breedDescription: "Poodle", neighborhood: "Centro", requestTypeIds: ["castration", "microchip"] });
    expect(next[1]).toMatchObject({ name: "", sex: "", coat: "", age: "", weight: "", dewormed: "", microchip: "", hasChip: "" });
    next[1].requestTypeIds.push("vaccine");
    expect(animals[0].requestTypeIds).toEqual(["castration", "microchip"]);
  });

  it("copies the last animal when asked for it, and does nothing without one", () => {
    const animals = [dog({ size: "Pequeno" }), dog({ size: "Grande", requestTypeIds: ["microchip"] })];
    expect(duplicateAnimal(animals, animals.length - 1)[2]).toMatchObject({ size: "Grande", requestTypeIds: ["microchip"] });
    expect(duplicateAnimal([], 0)).toEqual([]);
  });
});

describe("applyProceduresToAll", () => {
  it("gives every other animal the procedures of the source, keeping the rest of each", () => {
    const animals = [dog({ requestTypeIds: ["castration", "microchip"] }), dog({ name: "Mia", requestTypeIds: ["vaccine"] }), dog({ name: "Rex" })];
    const next = applyProceduresToAll(animals, 0, context);
    expect(next.map((animal) => animal.requestTypeIds)).toEqual([["castration", "microchip"], ["castration", "microchip"], ["castration", "microchip"]]);
    expect(next.map((animal) => animal.name)).toEqual(["", "Mia", "Rex"]);
    expect(next[0]).toBe(animals[0]);
    expect(next[1].requestTypeIds).not.toBe(next[2].requestTypeIds);
  });

  it("clears a defined breed the new procedures do not offer, and ignores a missing source", () => {
    const animals = [dog({ requestTypeIds: ["microchip"] }), dog({ breedType: "Definida", breedDescription: "Poodle", requestTypeIds: ["castration"] })];
    expect(applyProceduresToAll(animals, 0, context)[1]).toMatchObject({ requestTypeIds: ["microchip"], breedDescription: "" });
    expect(applyProceduresToAll(animals, 5, context)).toBe(animals);
  });
});

describe("procedureSignature and needsProcedure", () => {
  it("changes only when the set of procedures of the whole request changes", () => {
    const base = [dog({ requestTypeIds: ["castration"] }), dog({ requestTypeIds: ["microchip"] })];
    expect(procedureSignature(base)).toBe(procedureSignature([dog({ requestTypeIds: ["microchip", "castration"] })]));
    expect(procedureSignature(base)).not.toBe(procedureSignature([dog({ requestTypeIds: ["castration"] })]));
    expect(procedureSignature([])).toBe("");
  });

  it("asks for a procedure only when the municipality has types to choose from", () => {
    expect(needsProcedure(dog(), true)).toBe(true);
    expect(needsProcedure(dog({ requestTypeIds: ["castration"] }), true)).toBe(false);
    expect(needsProcedure(dog(), false)).toBe(false);
  });
});

describe("animalHeader", () => {
  it("shows only the number, the name and the species, never the procedures", () => {
    expect(animalHeader(dog({ name: "Bidu", requestTypeIds: ["castration"], sex: "Macho" }), 0)).toEqual({ title: "Animal 1", detail: "Bidu · Canino" });
    expect(animalHeader(dog(), 2)).toEqual({ title: "Animal 3", detail: "Canino" });
    expect(animalHeader(blankAnimal(), 1)).toEqual({ title: "Animal 2", detail: "" });
    expect(animalHeader({ ...blankAnimal(), name: "  ", species: "Felino" }, 0).detail).toBe("Felino");
  });
});

describe("requestTypeFeeLabel", () => {
  it("is free unless the type is charged, then the value", () => {
    expect(requestTypeFeeLabel(castration)).toBe("Gratuito");
    expect(requestTypeFeeLabel(vaccine)).toBe("R$ 15,00");
    expect(requestTypeFeeLabel({ charged: true, fee: "R$ 9,00" })).toBe("R$ 9,00");
    expect(requestTypeFeeLabel({ charged: true })).toBe("Cobrado");
  });
});

describe("mergeProcedureDocuments", () => {
  it("lists each document once, required when any procedure requires it", () => {
    const merged = mergeProcedureDocuments([
      [{ id: "residence", name: "Residência", required: false }, { id: "identity", name: "Identidade", required: true }],
      [{ id: "residence", name: "Residência (outro)", required: true }, { id: "vaccine-card", name: "Carteira", required: false }],
    ]);
    expect(merged.map(({ id }) => id)).toEqual(["residence", "identity", "vaccine-card"]);
    expect(merged.find(({ id }) => id === "residence")).toMatchObject({ name: "Residência", required: true });
    expect(merged.find(({ id }) => id === "vaccine-card").required).toBe(false);
    expect(mergeProcedureDocuments([])).toEqual([]);
  });
});

describe("procedureNames", () => {
  it("lists the names of the animal's procedures in the order chosen, skipping unknown ids", () => {
    expect(procedureNames(dog({ requestTypeIds: ["microchip", "gone", "castration"] }), context.requestTypes)).toEqual(["Microchipagem", "Castração"]);
    expect(procedureNames(dog(), context.requestTypes)).toEqual([]);
  });
});
