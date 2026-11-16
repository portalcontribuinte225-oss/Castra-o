import { describe, expect, it } from "vitest";
import { hasDuplicateIdentificationTypeName } from "./identification-types";
import type { IdentificationType } from "./identification-types";

const withTutor: IdentificationType = { id: "animal_com_tutor", name: "Animal com Tutor", active: true };
const withoutTutor: IdentificationType = { id: "animal_sem_tutor", name: "Animal sem Tutor", active: true, stepTutor: false };

describe("hasDuplicateIdentificationTypeName", () => {
  const items = [withTutor, withoutTutor];

  it("ignores case, accents and surrounding spaces", () => {
    expect(hasDuplicateIdentificationTypeName(items, "  ANIMAL COM tutór ")).toBe(true);
    expect(hasDuplicateIdentificationTypeName(items, "Animal comunitário")).toBe(false);
  });

  it("ignores the item being edited", () => {
    expect(hasDuplicateIdentificationTypeName(items, "Animal com Tutor", "animal_com_tutor")).toBe(false);
    expect(hasDuplicateIdentificationTypeName(items, "Animal com Tutor", "animal_sem_tutor")).toBe(true);
  });

  it("returns false for an empty name", () => {
    expect(hasDuplicateIdentificationTypeName(items, "   ")).toBe(false);
  });
});
