import { describe, expect, it } from "vitest";
import { RequestStep, getVisibleSteps } from "../request-steps/request-steps";
import {
  getActiveIdentificationTypes,
  hasDuplicateIdentificationTypeName,
  resolveSelectedIdentificationType,
} from "./identification-types";
import type { IdentificationType } from "./identification-types";

const withTutor: IdentificationType = { id: "animal_com_tutor", name: "Animal com Tutor", active: true };
const withoutTutor: IdentificationType = {
  id: "animal_sem_tutor",
  name: "Animal sem Tutor",
  active: true,
  stepTutor: false,
  stepAgenda: true,
  stepDocuments: true,
};

describe("getActiveIdentificationTypes", () => {
  it("returns an empty list for null and undefined", () => {
    expect(getActiveIdentificationTypes(null)).toEqual([]);
    expect(getActiveIdentificationTypes(undefined)).toEqual([]);
  });

  it("drops inactive types and types without a usable name", () => {
    const items = [withTutor, { ...withoutTutor, active: false }, { id: "blank", name: "   " }, { id: "missing" } as IdentificationType];
    expect(getActiveIdentificationTypes(items)).toEqual([withTutor]);
  });

  it("treats a missing active flag as active and keeps the configured order", () => {
    const noFlag: IdentificationType = { id: "shelter", name: "Animal de abrigo" };
    expect(getActiveIdentificationTypes([noFlag, withTutor]).map((type) => type.id)).toEqual(["shelter", "animal_com_tutor"]);
  });
});

describe("resolveSelectedIdentificationType", () => {
  const active = [withTutor, withoutTutor];

  it("returns the selected type when it is active", () => {
    expect(resolveSelectedIdentificationType(active, "animal_sem_tutor")).toBe(withoutTutor);
  });

  it("falls back to the first active type for an empty or unknown id", () => {
    expect(resolveSelectedIdentificationType(active, "")).toBe(withTutor);
    expect(resolveSelectedIdentificationType(active, "unknown")).toBe(withTutor);
  });

  it("falls back to the first active type when the stored id is no longer in the active list", () => {
    expect(resolveSelectedIdentificationType([withTutor], "animal_sem_tutor")).toBe(withTutor);
  });

  it("returns null when there are no active types", () => {
    expect(resolveSelectedIdentificationType([], "animal_com_tutor")).toBeNull();
  });
});

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

describe("identification type combined with the request type", () => {
  const steps = (configs: Parameters<typeof getVisibleSteps>[0]["configs"]) =>
    getVisibleSteps({ internal: false, skipTutor: false, configs }).map((item) => item.step);

  it("hides the tutor step for a type without tutor", () => {
    expect(steps([{}, withoutTutor])).toEqual([RequestStep.ANIMAL, RequestStep.SCHEDULE, RequestStep.DOCUMENTS]);
  });

  it("requires both sides to allow a step", () => {
    expect(steps([{ stepAgenda: false }, withoutTutor])).toEqual([RequestStep.ANIMAL, RequestStep.DOCUMENTS]);
    expect(steps([{}, { ...withoutTutor, stepDocuments: false }])).toEqual([RequestStep.ANIMAL, RequestStep.SCHEDULE]);
  });

  it("ignores a missing identification type", () => {
    expect(steps([{}, null])).toEqual([RequestStep.ANIMAL, RequestStep.TUTOR, RequestStep.SCHEDULE, RequestStep.DOCUMENTS]);
  });
});
